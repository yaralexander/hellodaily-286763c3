/* eslint-disable @typescript-eslint/no-explicit-any */
type ApiError = { message: string } | null;
type LocalUser = { id: string; email: string; user_metadata: { full_name?: string; name?: string; avatar_url?: string } };
type LocalSession = { user: LocalUser };
type Filter = { op: "eq" | "gte" | "lte"; column: string; value: any };

const listeners = new Set<(event: string, session: LocalSession | null) => void>();

async function request(path: string, init?: RequestInit) {
  const response = await fetch(path, {
    credentials: "same-origin", ...init,
    headers: init?.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json", ...init.headers } : init?.headers,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
  return payload;
}

function asSession(user: any): LocalSession | null {
  if (!user) return null;
  return { user: { id: user.id, email: user.email, user_metadata: { full_name: user.name, name: user.name, avatar_url: user.avatar_url } } };
}

class LocalQuery implements PromiseLike<{ data: any; error: ApiError }> {
  private action: "select" | "insert" | "update" | "delete" = "select";
  private body: any;
  private filters: Filter[] = [];
  private orderBy?: { column: string; ascending: boolean };
  private maxRows = 500;
  private one: "single" | "maybeSingle" | null = null;
  constructor(private table: string) {}

  select(_columns = "*") { return this; }
  insert(value: any) { this.action = "insert"; this.body = value; return this; }
  update(value: any) { this.action = "update"; this.body = value; return this; }
  delete() { this.action = "delete"; return this; }
  eq(column: string, value: any) { this.filters.push({ op: "eq", column, value }); return this; }
  gte(column: string, value: any) { this.filters.push({ op: "gte", column, value }); return this; }
  lte(column: string, value: any) { this.filters.push({ op: "lte", column, value }); return this; }
  order(column: string, options?: { ascending?: boolean }) { this.orderBy = { column, ascending: !!options?.ascending }; return this; }
  limit(value: number) { this.maxRows = value; return this; }
  single() { this.one = "single"; return this; }
  maybeSingle() { this.one = "maybeSingle"; return this; }

  private matches(row: any) {
    return this.filters.every(({ op, column, value }) => op === "eq" ? row[column] === value : op === "gte" ? row[column] >= value : row[column] <= value);
  }

  private async rows() {
    const params = new URLSearchParams({ limit: "500" });
    if (this.orderBy) { params.set("order", this.orderBy.column); params.set("ascending", String(this.orderBy.ascending)); }
    let rows = (await request(`/api/data/${this.table}?${params}`)).filter((row: any) => this.matches(row));
    if (this.orderBy) {
      const { column, ascending } = this.orderBy;
      rows = rows.sort((a: any, b: any) => String(a[column] ?? "").localeCompare(String(b[column] ?? "")) * (ascending ? 1 : -1));
    }
    return rows.slice(0, this.maxRows);
  }

  private async execute() {
    try {
      let data: any;
      if (this.action === "select") data = await this.rows();
      else if (this.action === "insert") data = await request(`/api/data/${this.table}`, { method: "POST", body: JSON.stringify(this.body) });
      else {
        const matches = await this.rows();
        if (this.action === "update") data = await Promise.all(matches.map((row: any) => request(`/api/data/${this.table}/${row.id}`, { method: "PATCH", body: JSON.stringify(this.body) })));
        else { await Promise.all(matches.map((row: any) => request(`/api/data/${this.table}/${row.id}`, { method: "DELETE" }))); data = null; }
      }
      if (this.one) {
        const rows = Array.isArray(data) ? data : data == null ? [] : [data];
        if (this.one === "single" && rows.length !== 1) throw new Error(`Expected one row, received ${rows.length}`);
        data = rows[0] ?? null;
      }
      return { data, error: null };
    } catch (error) { return { data: null, error: { message: error instanceof Error ? error.message : String(error) } }; }
  }

  then<TResult1 = { data: any; error: ApiError }, TResult2 = never>(onfulfilled?: ((value: { data: any; error: ApiError }) => TResult1 | PromiseLike<TResult1>) | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

async function getSession() {
  try { const { user } = await request("/api/auth/session"); return { data: { session: asSession(user) }, error: null }; }
  catch (error) { return { data: { session: null }, error: { message: error instanceof Error ? error.message : String(error) } }; }
}

export const supabase: any = {
  from: (table: string) => new LocalQuery(table),
  auth: {
    getSession,
    getUser: async () => { const result = await getSession(); return { data: { user: result.data.session?.user ?? null }, error: result.error }; },
    onAuthStateChange: (callback: (event: string, session: LocalSession | null) => void) => {
      listeners.add(callback); queueMicrotask(async () => callback("INITIAL_SESSION", (await getSession()).data.session));
      return { data: { subscription: { unsubscribe: () => listeners.delete(callback) } } };
    },
    signInWithPassword: async ({ email, password }: any) => authRequest("/api/auth/password", { email, password }, "SIGNED_IN"),
    signUp: async ({ email, password }: any) => authRequest("/api/auth/signup", { email, password }, "SIGNED_IN"),
    signOut: async () => {
      try { await request("/api/auth/signout", { method: "POST" }); listeners.forEach((fn) => fn("SIGNED_OUT", null)); return { error: null }; }
      catch (error) { return { error: { message: error instanceof Error ? error.message : String(error) } }; }
    },
  },
  functions: { invoke: async (name: string, options?: { body?: unknown }) => {
    try { return { data: await request(`/api/functions/${name}`, { method: "POST", body: JSON.stringify(options?.body ?? {}) }), error: null }; }
    catch (error) { return { data: null, error: { message: error instanceof Error ? error.message : String(error) } }; }
  } },
  storage: { from: (bucket: string) => ({
    upload: async (filePath: string, file: File) => {
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        let binary = ""; for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
        const data = await request("/api/uploads", { method: "POST", body: JSON.stringify({ path: filePath, bucket, base64: btoa(binary) }) });
        return { data, error: null };
      }
      catch (error) { return { data: null, error: { message: error instanceof Error ? error.message : String(error) } }; }
    },
    getPublicUrl: (filePath: string) => ({ data: { publicUrl: `/uploads/${bucket}/${filePath}` } }),
  }) },
};

async function authRequest(path: string, body: unknown, event: string) {
  try {
    const { user } = await request(path, { method: "POST", body: JSON.stringify(body) });
    const session = asSession(user); listeners.forEach((fn) => fn(event, session));
    return { data: { session, user: session?.user }, error: null };
  } catch (error) { return { data: null, error: { message: error instanceof Error ? error.message : String(error) } }; }
}

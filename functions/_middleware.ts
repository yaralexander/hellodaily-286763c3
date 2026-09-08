interface Env {
  BACKEND_ORIGIN?: string;
}

const proxiedPrefixes = ["/api/", "/account/", "/uploads/"];

export const onRequest: PagesFunction<Env> = async ({ request, env, next }) => {
  const incoming = new URL(request.url);
  if (!proxiedPrefixes.some((prefix) => incoming.pathname.startsWith(prefix))) {
    return next();
  }

  const backend = new URL(env.BACKEND_ORIGIN || "https://hd.finskienovosti.fi");
  backend.pathname = incoming.pathname;
  backend.search = incoming.search;

  const headers = new Headers(request.headers);
  headers.set("x-hellodaily-origin", incoming.origin);
  headers.delete("host");

  return fetch(new Request(backend, {
    method: request.method,
    headers,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
    redirect: "manual",
  }));
};

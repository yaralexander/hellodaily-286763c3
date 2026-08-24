# Hello Daily: SQLite deployment

The application no longer needs Supabase at runtime. It uses a local SQLite database and local cookie sessions.

## Coolify configuration

- Persistent storage: mount a volume at `/app/data`.
- Runtime variable: `DATA_DIR=/app/data`.
- Keep `SITE_URL`, `GOOGLE_OAUTH_CLIENT_ID`, and `GOOGLE_OAUTH_CLIENT_SECRET`.
- Add `OPENAI_API_KEY` and optionally `OPENAI_MODEL=gpt-4.1-mini`.
- Remove Supabase variables only after the data import and production verification.

The database is `/app/data/hellodaily.sqlite`. User uploads are under `/app/data/uploads`. A database snapshot is written daily to `/app/data/backups`.

## One-time Supabase import

Run before switching production traffic:

```sh
DATA_DIR=/path/to/data \
SUPABASE_URL=https://PROJECT.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=... \
npm run import:supabase
```

The importer preserves user UUIDs and copies the application tables. Never commit the service-role key.

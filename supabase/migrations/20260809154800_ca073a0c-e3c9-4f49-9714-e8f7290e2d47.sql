CREATE TABLE public.telegram_bot_settings (
  chat_id BIGINT PRIMARY KEY,
  lang TEXT NOT NULL DEFAULT 'ru' CHECK (lang IN ('ru','en')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.telegram_bot_settings TO service_role;
ALTER TABLE public.telegram_bot_settings ENABLE ROW LEVEL SECURITY;
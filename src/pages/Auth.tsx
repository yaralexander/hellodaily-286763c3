import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Mail, Lock, Eye, EyeOff, ArrowRight, Globe } from "lucide-react";
import { useThemeContext } from "@/contexts/ThemeContext";
import logoLight from "@/assets/logo-light.gif";
import logoDark from "@/assets/logo-dark.gif";
import bgLight from "@/assets/bg-light.jpg";
import bgDark from "@/assets/bg-dark.jpg";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useLanguage, Language } from "@/contexts/LanguageContext";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { theme } = useThemeContext();
  const { language, setLanguage, t } = useLanguage();

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate("/");
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success(language === "ru" ? "Проверьте email для подтверждения!" : "Check your email to confirm your account!");
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const handoff = params.get("oauth_handoff");
    const oauthError = params.get("oauth_error");

    if (oauthError) {
      toast.error(language === "ru" ? "Ошибка входа через Google" : "Failed to sign in with Google");
      navigate("/auth", { replace: true });
      return;
    }
    if (!handoff) return;

    setLoading(true);
    fetch(`/account/auth/session?handoff=${encodeURIComponent(handoff)}`, { credentials: "same-origin" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "OAuth session expired");
        const { error } = await supabase.auth.setSession(payload);
        if (error) throw error;
        navigate("/", { replace: true });
      })
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : "Failed to sign in with Google");
        navigate("/auth", { replace: true });
      })
      .finally(() => setLoading(false));
  }, [language, navigate]);

  const handleGoogleSignIn = () => {
    window.location.assign("/account/login/start");
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: `url(${theme === "dark" ? bgDark : bgLight})` }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm bg-card/50 dark:bg-card/50 backdrop-blur-2xl border border-border/50 dark:border-border/30 rounded-3xl p-6 shadow-xl shadow-black/10"
      >
        {/* Language Selector */}
        <div className="flex justify-center mb-4">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-secondary/40 backdrop-blur-lg border border-border/30">
            <button
              onClick={() => setLanguage("en")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${language === "en" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              🇬🇧 English
            </button>
            <button
              onClick={() => setLanguage("ru")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${language === "ru" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              🇷🇺 Русский
            </button>
          </div>
        </div>

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mx-auto mb-4">
            <img src={theme === "dark" ? logoDark : logoLight} alt="HelloDaily" className="h-10 object-contain" />
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {isLogin ? t.welcomeBack : t.createAccount}
          </p>
        </div>

        {/* Google Sign In */}
        <button
          onClick={handleGoogleSignIn}
          className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl bg-secondary/50 backdrop-blur-lg border border-border/40 hover:bg-accent/60 transition-colors mb-4"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          <span className="text-sm font-medium text-foreground">{t.continueWithGoogle}</span>
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground">{t.or}</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Email/Password Form */}
        <form onSubmit={handleEmailAuth} className="space-y-3">
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="email"
              placeholder={t.emailAddress}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full py-3 pl-10 pr-4 rounded-xl bg-secondary/40 backdrop-blur-lg border border-border/40 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type={showPassword ? "text" : "password"}
              placeholder={t.password}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full py-3 pl-10 pr-10 rounded-xl bg-secondary/40 backdrop-blur-lg border border-border/40 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? t.loading : isLogin ? t.signIn : t.createAccountBtn}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Skip Login */}
        <button
          onClick={() => { sessionStorage.setItem("testMode", "true"); navigate("/"); }}
          className="w-full py-3 rounded-xl border border-border/40 bg-secondary/30 backdrop-blur-lg text-sm font-medium text-muted-foreground hover:bg-secondary/50 transition-colors mt-3"
        >
          {t.testMode}
        </button>

        {/* Toggle */}
        <p className="text-center text-sm text-muted-foreground mt-6">
          {isLogin ? t.noAccount : t.haveAccount}{" "}
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-primary font-medium hover:underline"
          >
            {isLogin ? t.signUp : t.signIn}
          </button>
        </p>
      </motion.div>
    </div>
  );
};

export default Auth;

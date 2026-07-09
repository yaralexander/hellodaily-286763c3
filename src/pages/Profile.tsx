import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { User, LogOut, ChevronRight, Target, Ruler, Weight, Calendar, Save, Loader2, Camera, Sun, MoonIcon, MapPin, Clock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useThemeContext } from "@/contexts/ThemeContext";
import type { ThemeMode } from "@/hooks/useTheme";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import BottomNav from "@/components/BottomNav";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useLanguage } from "@/contexts/LanguageContext";
import NutritionGoalPicker from "@/components/scan/NutritionGoalPicker";

const Profile = () => {
  const { session, signOut } = useAuth();
  const { t } = useLanguage();
  const { settings: themeSettings, updateSettings: updateThemeSettings } = useThemeContext();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [profile, setProfile] = useState({
    display_name: "",
    age: "",
    gender: "",
    height_cm: "",
    weight_kg: "",
    activity_level: "moderate",
    health_goals: [] as string[],
  });

  const userId = session?.user?.id;

  const healthGoalOptions = [
    t.loseWeight, t.gainMuscle, t.improveSleepGoal, t.increaseEndurance,
    t.eatHealthier, t.reduceStress, t.buildFlexibility,
  ];

  useEffect(() => {
    if (!userId) return;
    const fetchProfile = async () => {
      const { data } = await supabase.from("profiles").select("*").eq("user_id", userId).single();
      if (data) {
        setProfile({
          display_name: data.display_name || "",
          age: data.age?.toString() || "",
          gender: data.gender || "",
          height_cm: data.height_cm?.toString() || "",
          weight_kg: data.weight_kg?.toString() || "",
          activity_level: (data as any).activity_level || "moderate",
          health_goals: data.health_goals || [],
        });
        if (data.avatar_url) setAvatarUrl(data.avatar_url);
      }
      setLoading(false);
    };
    fetchProfile();
  }, [userId]);

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: profile.display_name || null,
        age: profile.age ? parseInt(profile.age) : null,
        gender: profile.gender || null,
        height_cm: profile.height_cm ? parseFloat(profile.height_cm) : null,
        weight_kg: profile.weight_kg ? parseFloat(profile.weight_kg) : null,
        activity_level: profile.activity_level,
        health_goals: profile.health_goals.length > 0 ? profile.health_goals : null,
      })
      .eq("user_id", userId);

    setSaving(false);
    if (error) toast.error("Failed to save profile");
    else toast.success(t.saveProfile + "!");
  };

  const toggleGoal = (goal: string) => {
    setProfile((p) => ({
      ...p,
      health_goals: p.health_goals.includes(goal)
        ? p.health_goals.filter((g) => g !== goal)
        : [...p.health_goals, goal],
    }));
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    setUploadingAvatar(true);
    const fileExt = file.name.split(".").pop();
    const filePath = `${userId}/avatar.${fileExt}`;
    const { error: uploadError } = await supabase.storage.from("avatars").upload(filePath, file, { upsert: true });
    if (uploadError) { toast.error("Failed to upload photo"); setUploadingAvatar(false); return; }
    const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(filePath);
    const url = `${publicUrl}?t=${Date.now()}`;
    await supabase.from("profiles").update({ avatar_url: url }).eq("user_id", userId);
    setAvatarUrl(url);
    setUploadingAvatar(false);
    toast.success(t.saveProfile + "!");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24">
      <div className="max-w-lg mx-auto px-4 pt-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-foreground">{t.profile}</h1>
            <p className="text-xs text-muted-foreground">{session?.user?.email}</p>
          </div>
          <button onClick={signOut} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-destructive/10 text-destructive text-xs font-medium hover:bg-destructive/20 transition-colors">
            <LogOut className="w-3.5 h-3.5" />
            {t.signOut}
          </button>
        </motion.div>

        {/* Avatar & Name */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-5 mb-4 flex items-center gap-4">
          <div className="relative">
            <Avatar className="w-16 h-16 rounded-2xl">
              {avatarUrl ? <AvatarImage src={avatarUrl} alt="Profile" className="object-cover" /> : null}
              <AvatarFallback className="rounded-2xl bg-primary/10"><User className="w-8 h-8 text-primary" /></AvatarFallback>
            </Avatar>
            <button onClick={() => fileInputRef.current?.click()} disabled={uploadingAvatar} className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-primary flex items-center justify-center shadow-lg hover:opacity-90 transition-opacity">
              {uploadingAvatar ? <Loader2 className="w-3.5 h-3.5 text-primary-foreground animate-spin" /> : <Camera className="w-3.5 h-3.5 text-primary-foreground" />}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
          </div>
          <div className="flex-1">
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">{t.displayName}</label>
            <input value={profile.display_name} onChange={(e) => setProfile((p) => ({ ...p, display_name: e.target.value }))} placeholder={t.yourName} className="w-full bg-transparent text-lg font-bold text-foreground border-none outline-none placeholder:text-muted-foreground/50" />
          </div>
        </motion.div>

        {/* Body Metrics */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card p-5 mb-4">
          <h2 className="text-sm font-semibold text-foreground mb-4">{t.bodyMetrics}</h2>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-health-sleep/10 flex items-center justify-center"><Calendar className="w-4 h-4 text-health-sleep" /></div>
              <div className="flex-1">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider">{t.age}</label>
                <input type="number" value={profile.age} onChange={(e) => setProfile((p) => ({ ...p, age: e.target.value }))} placeholder="—" className="w-full bg-transparent text-sm font-medium text-foreground border-none outline-none placeholder:text-muted-foreground/50" />
              </div>
              <select value={profile.gender} onChange={(e) => setProfile((p) => ({ ...p, gender: e.target.value }))} className="bg-secondary text-foreground text-xs rounded-lg px-3 py-2 border-none outline-none">
                <option value="">{t.gender}</option>
                <option value="male">{t.male}</option>
                <option value="female">{t.female}</option>
                <option value="other">{t.other}</option>
              </select>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-health-activity/10 flex items-center justify-center"><Ruler className="w-4 h-4 text-health-activity" /></div>
              <div className="flex-1">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider">{t.height}</label>
                <div className="flex items-baseline gap-1">
                  <input type="number" value={profile.height_cm} onChange={(e) => setProfile((p) => ({ ...p, height_cm: e.target.value }))} placeholder="—" className="w-20 bg-transparent text-sm font-medium text-foreground border-none outline-none placeholder:text-muted-foreground/50" />
                  <span className="text-xs text-muted-foreground">cm</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-health-nutrition/10 flex items-center justify-center"><Weight className="w-4 h-4 text-health-nutrition" /></div>
              <div className="flex-1">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider">{t.weight}</label>
                <div className="flex items-baseline gap-1">
                  <input type="number" value={profile.weight_kg} onChange={(e) => setProfile((p) => ({ ...p, weight_kg: e.target.value }))} placeholder="—" className="w-20 bg-transparent text-sm font-medium text-foreground border-none outline-none placeholder:text-muted-foreground/50" />
                  <span className="text-xs text-muted-foreground">kg</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center"><Target className="w-4 h-4 text-primary" /></div>
              <div className="flex-1">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider">{t.activityLevel}</label>
                <select value={profile.activity_level} onChange={(e) => setProfile((p) => ({ ...p, activity_level: e.target.value }))} className="w-full bg-transparent text-sm font-medium text-foreground border-none outline-none">
                  <option value="sedentary">{t.sedentary}</option>
                  <option value="light">{t.light}</option>
                  <option value="moderate">{t.moderate}</option>
                  <option value="active">{t.active}</option>
                  <option value="very_active">{t.veryActive}</option>
                </select>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Health Goals */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-card p-5 mb-4">
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">{t.healthGoals}</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {healthGoalOptions.map((goal) => {
              const selected = profile.health_goals.includes(goal);
              return (
                <button key={goal} onClick={() => toggleGoal(goal)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${selected ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>
                  {goal}
                </button>
              );
            })}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32 }} className="mb-4">
          <NutritionGoalPicker />
        </motion.div>

        {/* Theme Settings */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="glass-card p-5 mb-4">
          <div className="flex items-center gap-2 mb-4">
            <Sun className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">{t.themeSettings}</h2>
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            {(["auto-sun", "auto-hours", "manual"] as ThemeMode[]).map((mode) => {
              const label = mode === "auto-sun" ? t.autoSunrise : mode === "auto-hours" ? t.autoHours : t.manualTheme;
              const selected = themeSettings.mode === mode;
              return (
                <button key={mode} onClick={() => updateThemeSettings({ mode })} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${selected ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>
                  {label}
                </button>
              );
            })}
          </div>
          {themeSettings.mode === "auto-sun" && (
            <div className="space-y-2">
              {themeSettings.lat != null ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <MapPin className="w-3.5 h-3.5 text-green-500" />
                  {t.locationDetected} ({themeSettings.lat.toFixed(1)}°, {themeSettings.lng?.toFixed(1)}°)
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{t.locationNotDetected}</span>
                  <button onClick={() => {
                    navigator.geolocation?.getCurrentPosition((pos) => {
                      updateThemeSettings({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                      toast.success(t.locationDetected);
                    }, () => toast.error("Geolocation denied"));
                  }} className="text-xs text-primary font-medium underline">{t.detectLocation}</button>
                </div>
              )}
            </div>
          )}
          {themeSettings.mode === "auto-hours" && (
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{t.lightFrom}</span>
              <select value={themeSettings.lightStart} onChange={(e) => updateThemeSettings({ lightStart: Number(e.target.value) })} className="bg-secondary text-foreground text-xs rounded-lg px-2 py-1 border-none outline-none">
                {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{String(i).padStart(2, "0")}:00</option>)}
              </select>
              <span className="text-xs text-muted-foreground">{t.lightTo}</span>
              <select value={themeSettings.lightEnd} onChange={(e) => updateThemeSettings({ lightEnd: Number(e.target.value) })} className="bg-secondary text-foreground text-xs rounded-lg px-2 py-1 border-none outline-none">
                {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{String(i).padStart(2, "0")}:00</option>)}
              </select>
            </div>
          )}
        </motion.div>

        <motion.button initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} onClick={handleSave} disabled={saving} className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 mb-4">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? t.saving : t.saveProfile}
        </motion.button>
      </div>

      <BottomNav />
    </div>
  );
};

export default Profile;

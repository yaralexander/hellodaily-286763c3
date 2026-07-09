import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Barcode, Package, Utensils, Loader2, History, Camera, ImagePlus, Type, Mic, Square } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import BarcodeScanner from "@/components/scan/BarcodeScanner";
import CameraInput from "@/components/scan/CameraInput";
import { useFoodScan, fileToBase64 } from "@/hooks/useFoodScan";
import NutritionGoalPicker from "@/components/scan/NutritionGoalPicker";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type PhotoTarget = "package" | "meal" | null;

const Scan = () => {
  const navigate = useNavigate();
  const { barcode, pkg, meal, text } = useFoodScan();
  const [scanning, setScanning] = useState(false);
  const [photoTarget, setPhotoTarget] = useState<PhotoTarget>(null);
  const [textOpen, setTextOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<any>(null);
  const busy = barcode.isPending || pkg.isPending || meal.isPending || text.isPending;
  const busyLabel = barcode.isPending ? "Looking up product…"
    : pkg.isPending ? "Reading the package…"
    : meal.isPending ? "Analyzing your meal…"
    : text.isPending ? "Analyzing your description…" : "";

  const handlePackage = async (file: File) => {
    const { base64, mimeType } = await fileToBase64(file);
    pkg.mutate({ imageBase64: base64, mimeType });
    setPhotoTarget(null);
  };
  const handleMeal = async (file: File) => {
    const { base64, mimeType } = await fileToBase64(file);
    meal.mutate({ imageBase64: base64, mimeType });
    setPhotoTarget(null);
  };

  const submitText = () => {
    const d = description.trim();
    if (!d) return;
    text.mutate(d);
    setDescription("");
    setTextOpen(false);
  };

  const startVoice = () => {
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      toast.message("Voice not supported here — try text input.");
      setTextOpen(true);
      return;
    }
    try {
      const rec = new SR();
      rec.lang = "en-US";
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.onresult = (ev: any) => {
        const transcript = Array.from(ev.results).map((r: any) => r[0]?.transcript).join(" ").trim();
        setRecording(false);
        if (transcript) {
          text.mutate(transcript);
        } else {
          toast.error("Didn't catch that — try again.");
        }
      };
      rec.onerror = () => { setRecording(false); toast.error("Voice error — try text input."); };
      rec.onend = () => setRecording(false);
      (recorderRef as any).current = rec;
      rec.start();
      setRecording(true);
      toast.info("Listening… say what you ate.");
    } catch {
      toast.error("Microphone access denied");
    }
  };
  const stopVoice = () => {
    try { (recorderRef.current as any)?.stop?.(); } catch { /* noop */ }
    setRecording(false);
  };

  const Tile = ({ icon: Icon, title, subtitle, accent, onClick, disabled }: any) => (
    <motion.button
      whileTap={{ scale: 0.98 }}
      disabled={disabled}
      onClick={onClick}
      className="w-full glass-card p-5 flex items-center gap-4 text-left disabled:opacity-50"
    >
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg" style={{ background: accent }}>
        <Icon className="w-6 h-6" />
      </div>
      <div className="flex-1">
        <p className="text-base font-bold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground leading-snug">{subtitle}</p>
      </div>
    </motion.button>
  );

  const targetTitle = photoTarget === "package" ? "Scan Package" : photoTarget === "meal" ? "Scan Meal" : "";
  const targetHandler = photoTarget === "package" ? handlePackage : photoTarget === "meal" ? handleMeal : () => {};

  return (
    <div className="min-h-screen pb-24">
      {scanning && (
        <BarcodeScanner
          onClose={() => setScanning(false)}
          onDetected={(code) => { setScanning(false); barcode.mutate(code); }}
        />
      )}

      <Sheet open={!!photoTarget} onOpenChange={(open) => !open && setPhotoTarget(null)}>
        <SheetContent side="bottom" className="glass-card border-t border-white/10 rounded-t-3xl pb-8">
          <SheetHeader className="text-center mb-6">
            <SheetTitle className="text-lg font-bold">{targetTitle}</SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground">Choose how you want to add the photo</SheetDescription>
          </SheetHeader>
          <div className="flex gap-4 justify-center">
            <CameraInput capture="environment" onSelected={targetHandler}>
              <button className="flex flex-col items-center gap-2 p-5 rounded-2xl bg-secondary/50 hover:bg-secondary transition-colors min-w-[120px]">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                  <Camera className="w-5 h-5" />
                </div>
                <span className="text-xs font-medium text-foreground">Take Photo</span>
              </button>
            </CameraInput>
            <CameraInput onSelected={targetHandler}>
              <button className="flex flex-col items-center gap-2 p-5 rounded-2xl bg-secondary/50 hover:bg-secondary transition-colors min-w-[120px]">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                  <ImagePlus className="w-5 h-5" />
                </div>
                <span className="text-xs font-medium text-foreground">Gallery</span>
              </button>
            </CameraInput>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={textOpen} onOpenChange={setTextOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Describe your food</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <p className="text-xs text-muted-foreground">
              Tell the AI what you ate — dish name, ingredients, and portion size. Example: "grilled chicken breast, 200g, with 100g of rice and a small salad".
            </p>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What did you eat?"
              rows={4}
              autoFocus
            />
          </div>
          <DialogFooter className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setTextOpen(false)}
              className="glass-card p-3 flex items-center justify-center gap-2 text-sm font-bold text-white bg-gradient-to-r from-rose-500 to-red-600"
            >
              Cancel
            </button>
            <button
              onClick={submitText}
              disabled={!description.trim() || text.isPending}
              className="glass-card p-3 flex items-center justify-center gap-2 text-sm font-bold text-white bg-gradient-to-r from-emerald-500 to-green-600 disabled:opacity-60"
            >
              {text.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Analyze
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="max-w-lg mx-auto px-4 pt-6">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-lg font-bold">Scan Food</h1>
          <button onClick={() => navigate("/scan/history")} className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center">
            <History className="w-4 h-4" />
          </button>
        </div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5 mb-3 text-center">
          <p className="text-[10px] uppercase tracking-[0.2em] text-primary/70 font-bold">Before You Eat AI™</p>
          <h2 className="text-xl font-extrabold text-foreground mt-1">Is it right for your goal?</h2>
          <p className="text-xs text-muted-foreground mt-2">Know in 5 seconds — every food is scored as a fit for your nutrition goal.</p>
        </motion.div>

        <div className="mb-5">
          <NutritionGoalPicker />
        </div>

        {busy && (
          <div className="glass-card p-5 mb-5 flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <p className="text-sm text-foreground">{busyLabel}</p>
          </div>
        )}

        <div className="space-y-3">
          <Tile
            icon={Barcode}
            title="Scan Barcode"
            subtitle="EAN / UPC · Open Food Facts + Fineli"
            accent="linear-gradient(135deg, hsl(217 91% 55%), hsl(262 60% 55%))"
            onClick={() => setScanning(true)}
            disabled={busy}
          />
          <Tile
            icon={Package}
            title="Scan Package"
            subtitle="Take a photo or pick from gallery"
            accent="linear-gradient(135deg, hsl(280 70% 55%), hsl(0 85% 55%))"
            onClick={() => setPhotoTarget("package")}
            disabled={busy}
          />
          <Tile
            icon={Utensils}
            title="Scan Meal"
            subtitle="Take a photo or pick from gallery"
            accent="linear-gradient(135deg, hsl(32 95% 50%), hsl(142 70% 42%))"
            onClick={() => setPhotoTarget("meal")}
            disabled={busy}
          />
          <Tile
            icon={Type}
            title="Text Input"
            subtitle="Describe your meal — AI estimates it"
            accent="linear-gradient(135deg, hsl(200 80% 50%), hsl(170 70% 45%))"
            onClick={() => setTextOpen(true)}
            disabled={busy}
          />
          <Tile
            icon={recording ? Square : Mic}
            title={recording ? "Stop Recording" : "Voice Input"}
            subtitle={recording ? "Tap to finish and transcribe" : "Say what you ate — hands-free"}
            accent="linear-gradient(135deg, hsl(340 80% 55%), hsl(15 85% 55%))"
            onClick={recording ? stopVoice : startVoice}
            disabled={busy && !recording}
          />
        </div>

        <p className="text-[10px] text-muted-foreground text-center mt-6 px-6">
          Informational only — not medical advice. Results are AI-generated estimates.
        </p>
      </div>
      <BottomNav />
    </div>
  );
};

export default Scan;

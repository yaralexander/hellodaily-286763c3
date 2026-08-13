import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { X, Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface Props {
  onDetected: (code: string) => void;
  onClose: () => void;
}

const BarcodeScanner = ({ onDetected, onClose }: Props) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);
  const { language } = useLanguage();
  const ru = language === "ru";

  useEffect(() => {
    const reader = new BrowserMultiFormatReader();
    let stopped = false;
    (async () => {
      try {
        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        const back = devices.find(d => /back|rear|environment/i.test(d.label)) || devices[0];
        if (!back) throw new Error(ru ? "Камера не найдена" : "No camera found");
        const controls = await reader.decodeFromVideoDevice(back.deviceId, videoRef.current!, (res, _e, c) => {
          if (res && !stopped) {
            stopped = true;
            c.stop();
            onDetected(res.getText());
          }
        });
        controlsRef.current = controls;
        setStarting(false);
      } catch (e: any) {
        setErr(e.message || (ru ? "Камера недоступна" : "Camera unavailable"));
        setStarting(false);
      }
    })();
    return () => { stopped = true; controlsRef.current?.stop(); };
  }, [onDetected, ru]);

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      <div className="flex items-center justify-between p-4 text-white">
        <h2 className="text-lg font-bold">{ru ? "Сканировать штрихкод" : "Scan barcode"}</h2>
        <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="flex-1 relative overflow-hidden">
        <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" muted playsInline />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-72 h-44 border-2 border-white/80 rounded-2xl relative">
            <div className="absolute inset-x-0 top-1/2 h-0.5 bg-red-500/80 animate-pulse" />
          </div>
        </div>
        {starting && (
          <div className="absolute inset-0 flex items-center justify-center text-white">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        )}
        {err && (
          <div className="absolute inset-x-4 bottom-8 p-4 bg-red-500/90 text-white rounded-xl text-sm">{err}</div>
        )}
      </div>
      <p className="p-4 text-center text-white/80 text-xs">{ru ? "Поместите штрихкод внутрь рамки" : "Align the barcode inside the frame"}</p>
    </div>
  );
};

export default BarcodeScanner;

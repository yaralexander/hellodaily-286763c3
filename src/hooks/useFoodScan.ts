import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

type ScanResponse = { scan: any; points_awarded: number; portion_estimate?: string };

export function useFoodScan() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const qc = useQueryClient();

  const invoke = async (fn: "scan-barcode" | "scan-package" | "scan-meal" | "scan-text", body: any): Promise<ScanResponse> => {
    const { data, error } = await supabase.functions.invoke(fn, { body: { ...body, lang: language } });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    return data as ScanResponse;
  };

  const onSuccess = (res: ScanResponse) => {
    toast.success(`+${res.points_awarded} wellness points!`);
    qc.invalidateQueries({ queryKey: ["food-logs"] });
    qc.invalidateQueries({ queryKey: ["eaten-scan-avg"] });
    navigate(`/scan/result/${res.scan.id}`);
  };
  const onError = (e: any) => toast.error(e.message || "Scan failed");

  const barcode = useMutation({ mutationFn: (barcode: string) => invoke("scan-barcode", { barcode }), onSuccess, onError });
  const pkg = useMutation({ mutationFn: (p: { imageBase64: string; mimeType: string }) => invoke("scan-package", p), onSuccess, onError });
  const meal = useMutation({ mutationFn: (p: { imageBase64: string; mimeType: string }) => invoke("scan-meal", p), onSuccess, onError });
  const text = useMutation({ mutationFn: (description: string) => invoke("scan-text", { description }), onSuccess, onError });

  return { barcode, pkg, meal, text };
}

export async function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const str = r.result as string;
      resolve({ base64: str.split(",")[1], mimeType: file.type || "image/jpeg" });
    };
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

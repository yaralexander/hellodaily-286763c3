import { useRef } from "react";

interface Props {
  onSelected: (file: File) => void;
  capture?: "user" | "environment";
  children: React.ReactNode;
  className?: string;
}

const CameraInput = ({ onSelected, capture, children, className }: Props) => {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        capture={capture}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onSelected(f);
          if (ref.current) ref.current.value = "";
        }}
      />
      <button type="button" onClick={() => ref.current?.click()} className={className}>{children}</button>
    </>
  );
};

export default CameraInput;

import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-gradient-to-r group-[.toast]:from-emerald-500 group-[.toast]:to-green-600 group-[.toast]:text-white group-[.toast]:font-bold",
          cancelButton: "group-[.toast]:bg-gradient-to-r group-[.toast]:from-rose-500 group-[.toast]:to-red-600 group-[.toast]:text-white group-[.toast]:font-bold",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };

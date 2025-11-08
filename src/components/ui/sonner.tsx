import { useEffect, useState } from "react";

// Re-export toast from shadcn location  
export { toast } from "@/hooks/use-toast";

// Lazy-load Sonner Toaster to avoid context issues
const Toaster = (props: any) => {
  const [SonnerToaster, setSonnerToaster] = useState<any>(null);

  useEffect(() => {
    let mounted = true;
    import("sonner").then((mod) => {
      if (mounted) setSonnerToaster(() => mod.Toaster);
    }).catch(() => {
      // Silently fail if sonner can't load
    });
    return () => {
      mounted = false;
    };
  }, []);

  if (!SonnerToaster) return null;

  return (
    <SonnerToaster
      theme="system"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };

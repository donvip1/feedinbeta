import { useEffect, useState } from "react";

// Re-export toast from the new shadcn location
export { toast } from "@/hooks/use-toast";

// Lazy-load Sonner's Toaster on client to avoid provider/context timing issues
const Toaster = (props: any) => {
  const [SonnerToaster, setSonnerToaster] = useState<any>(null);

  useEffect(() => {
    let mounted = true;
    import("sonner").then((mod) => {
      if (mounted) setSonnerToaster(() => mod.Toaster);
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

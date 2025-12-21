import { toast as sonnerToast } from "sonner";

// Minimal compatibility wrapper over our previous API
// Supports: toast({ title, description, variant }) and dismiss(id)

type ReactNode = any;

export type ToastOptions = {
  title?: ReactNode;
  description?: ReactNode;
  variant?: "default" | "destructive";
};

function asText(node: ReactNode): string | undefined {
  if (node == null) return undefined;
  if (typeof node === "string") return node;
  try {
    return String(node);
  } catch {
    return undefined;
  }
}

function toast({ title, description, variant = "default" }: ToastOptions) {
  const message = asText(title) ?? "";
  const opts = { description: asText(description) } as { description?: string };

  let id: string | number;
  if (variant === "destructive") {
    id = sonnerToast.error(message || "Error", opts);
  } else {
    id = sonnerToast(message || "Notification", opts);
  }

  return {
    id: String(id),
    dismiss: () => sonnerToast.dismiss(id),
    update: (_: any) => {},
  };
}

function dismiss(toastId?: string) {
  if (toastId) {
    sonnerToast.dismiss(toastId);
  } else {
    sonnerToast.dismiss();
  }
}

function useToast() {
  // Return stable object without hooks - toast is already a stable function
  return {
    toasts: [] as any[],
    toast,
    dismiss,
  };
}

export { useToast, toast };

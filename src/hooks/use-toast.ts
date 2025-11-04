import * as React from "react";
import { toast as sonner } from "sonner";

// Minimal compatibility layer for the former shadcn use-toast API
// Maps to Sonner and avoids React hook collisions across the app.

export type ToastVariant = "default" | "destructive" | "success" | "info" | "warning";

export interface ToastOptions {
  id?: string | number;
  title?: React.ReactNode;
  description?: React.ReactNode;
  variant?: ToastVariant;
  // Optional action button (mapped to Sonner action)
  action?: {
    label: string;
    onClick: () => void;
  };
  duration?: number;
}

const mapToSonner = (opts: ToastOptions) => {
  const description =
    typeof opts.description === "string" ? opts.description : undefined;
  const action = opts.action
    ? {
        label: opts.action.label,
        onClick: opts.action.onClick,
      }
    : undefined;

  const common = { description, action, duration: opts.duration, id: opts.id } as any;

  switch (opts.variant) {
    case "destructive":
      return sonner.error(opts.title || "", common);
    case "success":
      return sonner.success(opts.title || "", common);
    case "info":
      return sonner.info(opts.title || "", common);
    case "warning":
      return sonner.warning(opts.title || "", common);
    default:
      return sonner(opts.title || "", common);
  }
};

export const toast = Object.assign(
  (opts: ToastOptions) => mapToSonner(opts),
  {
    success: (title: string, extra?: Omit<ToastOptions, "title">) =>
      sonner.success(title, extra as any),
    error: (title: string, extra?: Omit<ToastOptions, "title">) =>
      sonner.error(title, extra as any),
    info: (title: string, extra?: Omit<ToastOptions, "title">) =>
      sonner.info(title, extra as any),
    warning: (title: string, extra?: Omit<ToastOptions, "title">) =>
      sonner.warning(title, extra as any),
    loading: (title: string, extra?: Omit<ToastOptions, "title">) =>
      sonner.loading(title, extra as any),
    dismiss: (id?: string | number) => sonner.dismiss(id as any),
  }
);

export function useToast() {
  return { toast };
}

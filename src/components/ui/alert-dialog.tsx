import React, { createContext, useContext } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

// Lightweight, hookless AlertDialog compatible with shadcn API

type Ctx = { open: boolean; onOpenChange?: (open: boolean) => void };
const Ctx = createContext<Ctx | null>(null);

const AlertDialog: React.FC<{ open?: boolean; onOpenChange?: (o: boolean) => void; children: React.ReactNode }> = ({ open = false, onOpenChange, children }) => (
  <Ctx.Provider value={{ open, onOpenChange }}>{children}</Ctx.Provider>
);

const AlertDialogTrigger = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }>(
  ({ children, onClick, asChild, ...props }, ref) => {
    const ctx = useContext(Ctx);
    if (asChild && React.isValidElement(children)) {
      const child = children as React.ReactElement<any>;
      return React.cloneElement(child, {
        ref,
        onClick: (e: any) => {
          child.props?.onClick?.(e);
          onClick?.(e);
          ctx?.onOpenChange?.(true);
        },
      });
    }
    return (
      <button
        ref={ref}
        onClick={(e) => {
          onClick?.(e);
          ctx?.onOpenChange?.(true);
        }}
        {...props}
      >
        {children}
      </button>
    );
  }
);
AlertDialogTrigger.displayName = "AlertDialogTrigger";

const Portal: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
};

const AlertDialogOverlay = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => {
  const ctx = useContext(Ctx);
  if (!ctx?.open) return null;
  return <div ref={ref} className={cn("fixed inset-0 z-50 bg-black/80", className)} {...props} />;
});
AlertDialogOverlay.displayName = "AlertDialogOverlay";

const AlertDialogContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, children, ...props }, ref) => {
  const ctx = useContext(Ctx);
  if (!ctx?.open) return null;
  const handleClose = () => ctx.onOpenChange?.(false);
  return (
    <Portal>
      <AlertDialogOverlay onClick={handleClose} />
      <div
        ref={ref}
        role="alertdialog"
        aria-modal="true"
        className={cn(
          "fixed left-1/2 top-1/2 z-[60] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-background p-6 shadow-lg",
          className
        )}
        {...props}
      >
        {children}
      </div>
    </Portal>
  );
});
AlertDialogContent.displayName = "AlertDialogContent";

const AlertDialogHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
  <div className={cn("flex flex-col space-y-2 text-center sm:text-left", className)} {...props} />
);
const AlertDialogFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
  <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)} {...props} />
);

const AlertDialogTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(({ className, ...props }, ref) => (
  <h2 ref={ref} className={cn("text-lg font-semibold", className)} {...props} />
));
const AlertDialogDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
));

const AlertDialogCancel = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(({ onClick, ...props }, ref) => {
  const ctx = useContext(Ctx);
  return (
    <button
      ref={ref}
      onClick={(e) => {
        onClick?.(e);
        ctx?.onOpenChange?.(false);
      }}
      {...props}
    />
  );
});
const AlertDialogAction = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(({ onClick, ...props }, ref) => (
  <button ref={ref} onClick={onClick} {...props} />
));

export {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogOverlay,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
};

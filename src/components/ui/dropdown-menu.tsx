import React from "react";
import { cn } from "@/lib/utils";

// Hookless dropdown using native <details>/<summary> pattern

const DropdownMenu: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <details className="relative inline-block select-none">
    {children}
  </details>
);

const DropdownMenuTrigger = React.forwardRef<HTMLElement, { asChild?: boolean; children: React.ReactNode }>(
  ({ asChild, children }, ref) => {
    if (asChild && React.isValidElement(children)) {
      // Wrap provided child inside summary preserving its props
      return (
        <summary ref={ref as any} className="list-none cursor-pointer inline-flex">
          {children}
        </summary>
      );
    }
    return (
      <summary ref={ref as any} className="list-none cursor-pointer inline-flex">
        {children}
      </summary>
    );
  }
);
DropdownMenuTrigger.displayName = "DropdownMenuTrigger";

const DropdownMenuContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { align?: "start" | "end" }>(
  ({ className, align = "start", ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "absolute z-50 mt-2 min-w-[8rem] rounded-md border bg-popover p-1 text-popover-foreground shadow-md",
        align === "end" ? "right-0" : "left-0",
        className
      )}
      {...props}
    />
  )
);
DropdownMenuContent.displayName = "DropdownMenuContent";

const DropdownMenuItem = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { inset?: boolean }>(
  ({ className, inset, children, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "w-full text-left text-sm rounded-sm px-2 py-1.5 hover:bg-accent hover:text-accent-foreground",
        inset && "pl-8",
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
);
DropdownMenuItem.displayName = "DropdownMenuItem";

// No-ops to satisfy existing imports
const DropdownMenuGroup = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
const DropdownMenuPortal = ({ children }: { children: React.ReactNode }) => <>{children}</>;
const DropdownMenuSub = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
const DropdownMenuSubContent = DropdownMenuContent;
const DropdownMenuSubTrigger = DropdownMenuTrigger as any;
const DropdownMenuRadioGroup = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
const DropdownMenuCheckboxItem = DropdownMenuItem as any;
const DropdownMenuRadioItem = DropdownMenuItem as any;
const DropdownMenuLabel = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { inset?: boolean }>(
  ({ className, inset, ...props }, ref) => (
    <div ref={ref} className={cn("px-2 py-1.5 text-sm font-semibold", inset && "pl-8", className)} {...props} />
  )
);
const DropdownMenuSeparator = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("-mx-1 my-1 h-px bg-muted", className)} {...props} />
));
const DropdownMenuShortcut = (props: React.HTMLAttributes<HTMLSpanElement>) => (
  <span className={cn("ml-auto text-xs tracking-widest opacity-60", props.className)} {...props} />
);

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
};

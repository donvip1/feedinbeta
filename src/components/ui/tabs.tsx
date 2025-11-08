import { useState, useCallback, createContext, useContext, forwardRef } from "react";
import { cn } from "@/lib/utils";

// Lightweight Tabs implementation to avoid Radix/React hook collisions

type TabsContextValue = {
  value: string;
  setValue: (v: string) => void;
};

const TabsContext = createContext<TabsContextValue | null>(null);

type TabsProps = {
  value?: string;
  defaultValue?: string;
  onValueChange?: (v: string) => void;
  className?: string;
  children?: React.ReactNode;
};

const Tabs: React.FC<TabsProps> = ({ value, defaultValue, onValueChange, className, children }) => {
  const isControlled = value !== undefined;
  const [internal, setInternal] = useState<string>(defaultValue || "");
  const current = isControlled ? (value as string) : internal;

  const setValue = useCallback((v: string) => {
    if (!isControlled) setInternal(v);
    onValueChange?.(v);
  }, [isControlled, onValueChange]);

  return (
    <div className={cn(className)}>
      <TabsContext.Provider value={{ value: current, setValue }}>
        {children}
      </TabsContext.Provider>
    </div>
  );
};

const TabsList = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground", className)} {...props} />
  )
);
TabsList.displayName = "TabsList";

type TabsTriggerProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string };
const TabsTrigger = forwardRef<HTMLButtonElement, TabsTriggerProps>(({ className, value, ...props }, ref) => {
  const ctx = useContext(TabsContext);
  const active = ctx?.value === value;
  return (
    <button
      ref={ref}
      data-state={active ? "active" : "inactive"}
      onClick={(e) => {
        props.onClick?.(e);
        ctx?.setValue(value);
      }}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
});
TabsTrigger.displayName = "TabsTrigger";

type TabsContentProps = React.HTMLAttributes<HTMLDivElement> & { value: string };
const TabsContent = forwardRef<HTMLDivElement, TabsContentProps>(({ className, value, ...props }, ref) => {
  const ctx = useContext(TabsContext);
  if (ctx?.value !== value) return null;
  return (
    <div
      ref={ref}
      className={cn("mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2", className)}
      {...props}
    />
  );
});
TabsContent.displayName = "TabsContent";

export { Tabs, TabsList, TabsTrigger, TabsContent };

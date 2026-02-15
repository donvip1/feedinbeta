import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
  return (
    <SonnerToaster 
      position="top-center" 
      richColors 
      closeButton={false}
      theme="system" 
      duration={2000}
      toastOptions={{
        className: "backdrop-blur-md rounded-2xl",
        style: {
          padding: '12px 16px',
        }
      }}
    />
  );
}


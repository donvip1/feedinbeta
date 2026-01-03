import { motion } from "framer-motion";
import { Loader2, Radio, Clock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type GateStatus = 'waiting' | 'connecting' | 'buffering' | 'error' | 'scheduled';

interface StreamReadyGateProps {
  status: GateStatus;
  message?: string;
  scheduledTime?: Date;
  onRetry?: () => void;
  onGoBack?: () => void;
  className?: string;
}

export const StreamReadyGate = ({
  status,
  message,
  scheduledTime,
  onRetry,
  onGoBack,
  className,
}: StreamReadyGateProps) => {
  const renderContent = () => {
    switch (status) {
      case 'waiting':
        return (
          <>
            <motion.div
              className="relative mb-6"
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 8, ease: "linear" }}
            >
              <div className="w-20 h-20 rounded-full border-4 border-primary/20" />
              <motion.div
                className="absolute inset-0 w-20 h-20 rounded-full border-4 border-transparent border-t-primary"
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
              />
              <Radio className="absolute inset-0 m-auto w-8 h-8 text-primary" />
            </motion.div>
            <h3 className="text-xl font-bold text-white mb-2">Stream Starting...</h3>
            <p className="text-muted-foreground text-center max-w-xs">
              {message || "Waiting for the host to start broadcasting. Please wait..."}
            </p>
          </>
        );

      case 'connecting':
        return (
          <>
            <Loader2 className="w-16 h-16 text-primary animate-spin mb-6" />
            <h3 className="text-xl font-bold text-white mb-2">Connecting...</h3>
            <p className="text-muted-foreground text-center max-w-xs">
              {message || "Establishing connection to the stream..."}
            </p>
          </>
        );

      case 'buffering':
        return (
          <>
            <motion.div
              className="w-16 h-16 border-4 border-primary/30 border-t-primary rounded-full mb-6"
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
            />
            <h3 className="text-xl font-bold text-white mb-2">Buffering...</h3>
            <p className="text-muted-foreground text-center max-w-xs">
              {message || "Loading stream data. This may take a moment on slower connections."}
            </p>
          </>
        );

      case 'scheduled':
        return (
          <>
            <Clock className="w-16 h-16 text-blue-400 mb-6" />
            <h3 className="text-xl font-bold text-white mb-2">Stream Scheduled</h3>
            <p className="text-muted-foreground text-center max-w-xs mb-4">
              {scheduledTime 
                ? `This stream is scheduled to start at ${scheduledTime.toLocaleTimeString()}`
                : "This stream hasn't started yet."}
            </p>
            {onGoBack && (
              <Button variant="outline" onClick={onGoBack}>
                Go Back
              </Button>
            )}
          </>
        );

      case 'error':
        return (
          <>
            <AlertCircle className="w-16 h-16 text-red-400 mb-6" />
            <h3 className="text-xl font-bold text-white mb-2">Connection Failed</h3>
            <p className="text-muted-foreground text-center max-w-xs mb-6">
              {message || "Unable to connect to the stream. The host may have ended the broadcast."}
            </p>
            <div className="flex gap-3">
              {onGoBack && (
                <Button variant="outline" onClick={onGoBack}>
                  Go Back
                </Button>
              )}
              {onRetry && (
                <Button onClick={onRetry}>
                  Try Again
                </Button>
              )}
            </div>
          </>
        );
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={cn(
        "absolute inset-0 bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center z-20",
        className
      )}
    >
      {renderContent()}
    </motion.div>
  );
};

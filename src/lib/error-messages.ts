/**
 * User-Friendly Error Messages
 * Transforms technical errors into encouraging, non-alarming messages
 */

interface FriendlyError {
  title: string;
  description: string;
  action?: string;
}

const errorPatterns: Array<{
  pattern: RegExp | string;
  friendly: FriendlyError;
}> = [
  // RLS/Permission errors (database)
  {
    pattern: /row.level security|rls|policy|new row violates/i,
    friendly: {
      title: "Access restricted",
      description: "This action requires different permissions. Try signing in again.",
      action: "login"
    }
  },
  {
    pattern: /permission denied|access denied|not authorized/i,
    friendly: {
      title: "Permission needed",
      description: "You don't have access to this content right now.",
      action: "login"
    }
  },
  // Database/Query errors
  {
    pattern: /PGRST|postgrest|relation.*does not exist/i,
    friendly: {
      title: "Content unavailable",
      description: "This content couldn't be loaded. Please try again.",
      action: "retry"
    }
  },
  {
    pattern: /duplicate key|unique constraint|already exists/i,
    friendly: {
      title: "Already exists",
      description: "This item already exists. Try a different option.",
      action: "none"
    }
  },
  {
    pattern: /foreign key|referenced.*not found/i,
    friendly: {
      title: "Item not found",
      description: "The related content is no longer available.",
      action: "retry"
    }
  },
  // Signal/WebRTC connection errors
  {
    pattern: /signal connection|abort handler|signaling|could not establish/i,
    friendly: {
      title: "Connecting...",
      description: "Taking a moment to establish connection. Please wait.",
      action: "retry"
    }
  },
  // LiveKit specific errors
  {
    pattern: /connection timeout|room timeout|join timeout/i,
    friendly: {
      title: "Connection taking longer",
      description: "Network is a bit slow. Hang tight, we're connecting you.",
      action: "retry"
    }
  },
  // NotAllowed/Permission errors (camera, mic)
  {
    pattern: /NotAllowedError|permission denied|access denied|not allowed/i,
    friendly: {
      title: "Permission needed",
      description: "Please allow access to your camera or microphone in browser settings.",
      action: "settings"
    }
  },
  // NotFound errors (no device)
  {
    pattern: /NotFoundError|no (microphone|camera) found|device not found/i,
    friendly: {
      title: "Device not found",
      description: "We couldn't find a camera or microphone. Check your device settings.",
      action: "settings"
    }
  },
  // Network errors
  {
    pattern: /network|offline|internet|fetch failed|failed to fetch/i,
    friendly: {
      title: "Connection interrupted",
      description: "We're having trouble reaching our servers. Check your connection and try again.",
      action: "retry"
    }
  },
  // Timeout errors
  {
    pattern: /timeout|timed out|took too long/i,
    friendly: {
      title: "Taking longer than expected",
      description: "The connection is a bit slow right now. We'll keep trying.",
      action: "retry"
    }
  },
  // WebSocket errors
  {
    pattern: /websocket|ws error|socket closed/i,
    friendly: {
      title: "Reconnecting...",
      description: "Live connection dropped. We're working on getting you back.",
      action: "retry"
    }
  },
  // LiveKit/Media errors
  {
    pattern: /livekit|room|track|media|audio|video|microphone|camera/i,
    friendly: {
      title: "Media connection issue",
      description: "Having trouble with the audio/video connection. Reconnecting...",
      action: "retry"
    }
  },
  // Server errors (5xx)
  {
    pattern: /500|502|503|504|server error|internal error/i,
    friendly: {
      title: "Temporarily unavailable",
      description: "Our servers are busy. Please try again in a moment.",
      action: "retry"
    }
  },
  // Rate limiting
  {
    pattern: /429|rate limit|too many requests/i,
    friendly: {
      title: "Slow down",
      description: "You're moving too fast! Please wait a moment before trying again.",
      action: "wait"
    }
  },
  // Authentication errors
  {
    pattern: /401|unauthorized|unauthenticated|jwt|token expired/i,
    friendly: {
      title: "Session expired",
      description: "Please sign in again to continue.",
      action: "login"
    }
  },
  {
    pattern: /403|forbidden/i,
    friendly: {
      title: "Access denied",
      description: "You don't have permission for this action.",
      action: "none"
    }
  },
  // SFU/Cloudflare specific
  {
    pattern: /sfu|cloudflare|406|invalid_session/i,
    friendly: {
      title: "Syncing connection",
      description: "Optimizing your connection for the best experience.",
      action: "retry"
    }
  },
  // Generic data loading
  {
    pattern: /failed to load|load error|loading failed/i,
    friendly: {
      title: "Couldn't load content",
      description: "Something went wrong loading this. Give it another try.",
      action: "retry"
    }
  }
];

// Default friendly message
const defaultFriendly: FriendlyError = {
  title: "Something went wrong",
  description: "We hit a small bump. Please try again.",
  action: "retry"
};

/**
 * Convert a technical error message to a user-friendly one
 */
export function getFriendlyError(error: string | Error): FriendlyError {
  const errorMessage = error instanceof Error ? error.message : error;
  
  for (const { pattern, friendly } of errorPatterns) {
    const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern, 'i');
    if (regex.test(errorMessage)) {
      return friendly;
    }
  }
  
  return defaultFriendly;
}

/**
 * Get just the friendly title
 */
export function getFriendlyErrorTitle(error: string | Error): string {
  return getFriendlyError(error).title;
}

/**
 * Get just the friendly description
 */
export function getFriendlyErrorDescription(error: string | Error): string {
  return getFriendlyError(error).description;
}

/**
 * Check if an error is network-related (temporary)
 */
export function isTemporaryError(error: string | Error): boolean {
  const errorMessage = error instanceof Error ? error.message : error;
  const temporaryPatterns = [
    /network|offline|fetch|timeout|websocket|signal|connection/i,
    /500|502|503|504|429/i,
    /sfu|livekit|room/i
  ];
  
  return temporaryPatterns.some(pattern => pattern.test(errorMessage));
}

/**
 * Wrapper for toast errors with friendly messages
 */
export function showFriendlyError(
  toast: (options: { title?: string; description?: string; variant?: string }) => void,
  error: string | Error
): void {
  const friendly = getFriendlyError(error);
  
  // Log the actual error for debugging
  console.error('[Error]', error instanceof Error ? error.message : error);
  
  toast({
    title: friendly.title,
    description: friendly.description,
    variant: isTemporaryError(error) ? 'default' : 'destructive'
  });
}

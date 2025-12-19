import React, { useEffect, useState, useCallback } from 'react';
import { useKeyboardHeight } from '@/hooks/useKeyboardHeight';

interface NativeAppShellProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * NativeAppShell - Wrapper component that provides native app-like behavior
 * - Fixed viewport that never resizes with keyboard
 * - Safe area insets for notches/home indicators
 * - Hardware-accelerated rendering
 * - Prevents overscroll bounce
 */
export const NativeAppShell: React.FC<NativeAppShellProps> = ({ 
  children, 
  className = '' 
}) => {
  const { keyboardHeight, isKeyboardOpen } = useKeyboardHeight();
  const [isNativePlatform, setIsNativePlatform] = useState(false);

  useEffect(() => {
    // Check if running on native platform
    const checkPlatform = async () => {
      try {
        const { Capacitor } = await import('@capacitor/core');
        setIsNativePlatform(Capacitor.isNativePlatform());
        
        if (Capacitor.isNativePlatform()) {
          // Configure status bar for native
          try {
            const { StatusBar, Style } = await import('@capacitor/status-bar');
            await StatusBar.setStyle({ style: Style.Dark });
            await StatusBar.setBackgroundColor({ color: '#000000' });
          } catch (e) {
            console.log('StatusBar plugin not available');
          }
        }
      } catch (e) {
        setIsNativePlatform(false);
      }
    };
    
    checkPlatform();
  }, []);

  // Prevent pull-to-refresh and overscroll
  useEffect(() => {
    const preventOverscroll = (e: TouchEvent) => {
      // Allow scrolling within scrollable elements
      const target = e.target as HTMLElement;
      const isScrollable = target.closest('[data-scrollable="true"]');
      
      if (!isScrollable) {
        e.preventDefault();
      }
    };

    document.body.addEventListener('touchmove', preventOverscroll, { passive: false });
    
    // Prevent iOS rubber-band effect
    document.body.style.overscrollBehavior = 'none';
    document.documentElement.style.overscrollBehavior = 'none';

    return () => {
      document.body.removeEventListener('touchmove', preventOverscroll);
    };
  }, []);

  return (
    <div 
      className={`native-app-shell ${className}`}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        overflow: 'hidden',
        WebkitOverflowScrolling: 'touch',
        // Use transform for GPU acceleration
        transform: 'translateZ(0)',
        WebkitTransform: 'translateZ(0)',
        // Safe area insets
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
    >
      {children}
    </div>
  );
};

/**
 * NativeChatLayout - Optimized layout specifically for chat interfaces
 * Header stays fixed, messages scroll, input adjusts with keyboard
 */
interface NativeChatLayoutProps {
  header: React.ReactNode;
  messages: React.ReactNode;
  input: React.ReactNode;
  headerHeight?: number;
  inputHeight?: number;
  showReply?: boolean;
  replyHeight?: number;
}

export const NativeChatLayout: React.FC<NativeChatLayoutProps> = ({
  header,
  messages,
  input,
  headerHeight = 60,
  inputHeight = 60,
  showReply = false,
  replyHeight = 60,
}) => {
  const { keyboardHeight, isKeyboardOpen } = useKeyboardHeight();
  
  const totalInputHeight = inputHeight + (showReply ? replyHeight : 0);
  const bottomOffset = isKeyboardOpen ? keyboardHeight : 0;
  
  return (
    <div className="native-chat-layout" style={{ 
      position: 'fixed',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: 'hsl(var(--background))',
    }}>
      {/* Fixed Header */}
      <div 
        className="chat-header-native"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: headerHeight,
          zIndex: 100,
          backgroundColor: 'hsl(var(--background))',
          borderBottom: '1px solid hsl(var(--border))',
          transform: 'translateZ(0)',
          WebkitTransform: 'translateZ(0)',
        }}
      >
        {header}
      </div>
      
      {/* Scrollable Messages Area */}
      <div 
        className="chat-messages-native"
        data-scrollable="true"
        style={{
          position: 'fixed',
          top: headerHeight,
          left: 0,
          right: 0,
          bottom: totalInputHeight + bottomOffset,
          overflowY: 'auto',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
          transform: 'translateZ(0)',
          WebkitTransform: 'translateZ(0)',
        }}
      >
        {messages}
      </div>
      
      {/* Fixed Input Area */}
      <div 
        className="chat-input-native"
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: bottomOffset,
          minHeight: totalInputHeight,
          zIndex: 90,
          backgroundColor: 'hsl(var(--background))',
          borderTop: '1px solid hsl(var(--border))',
          transform: 'translateZ(0)',
          WebkitTransform: 'translateZ(0)',
          transition: 'bottom 0.15s ease-out',
        }}
      >
        {input}
      </div>
    </div>
  );
};

export default NativeAppShell;

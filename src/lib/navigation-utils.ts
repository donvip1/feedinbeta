/**
 * Smart Navigation Utility
 * Provides intelligent back navigation based on current route context
 */

// Define parent-child route mappings
const ROUTE_HIERARCHY: Record<string, string> = {
  // Settings sub-pages -> /settings
  '/settings/account': '/settings',
  '/settings/privacy': '/settings',
  '/settings/notifications': '/settings',
  '/settings/sessions': '/settings',
  '/settings/blocked': '/settings',
  '/settings/language': '/settings',
  '/settings/currency': '/settings',
  '/settings/cache': '/settings',
  '/settings/help': '/settings',
  '/settings/investors': '/settings',
  '/settings/investment-docs': '/settings/investors',
  
  // Admin pages -> /settings
  '/admin/panel': '/settings',
  '/admin/analytics': '/settings',
  '/admin/deleted-posts': '/settings',
  
  // Creator pages -> /settings
  '/creator/dashboard': '/settings',
  
  // Wallet sub-pages -> /wallet
  '/wallet/credits': '/wallet',
  '/wallet/subscription': '/wallet',
  '/wallet/p2p': '/wallet',
  '/wallet/admin': '/settings',
  '/wallet/creator-payouts': '/settings',
  
  // P2P pages
  '/p2p/payment-methods': '/wallet/p2p',
  
  // Feed sub-pages -> /feed
  '/feed/trending': '/feed',
  '/feed/search': '/feed',
  '/saved': '/settings',
  
  // Social pages -> /feed or /settings
  '/friends': '/settings',
  '/groups': '/settings',
  
  // Live pages -> /live
  '/live': '/feed',
  
  // AI pages -> /ai/copilot
  '/ai/thesis': '/ai/copilot',
  '/ai/video': '/ai/copilot',
  '/ai/education': '/ai/copilot',
  '/ai/project': '/ai/copilot',
  '/ai/image-gen': '/ai/copilot',
  '/ai/enhance': '/ai/copilot',
  '/ai/learn': '/ai/copilot',
  
  // Music
  '/music': '/feed',
  
  // Promotions
  '/promotions': '/settings',
  '/moderation': '/settings',
  
  // Call pages
  '/call/history': '/messages',
  
  // Auth and misc
  '/auth': '/welcome',
  '/install': '/welcome',
};

/**
 * Get the appropriate back destination for a given route
 */
export function getBackDestination(currentPath: string): string {
  // Check for exact match first
  if (ROUTE_HIERARCHY[currentPath]) {
    return ROUTE_HIERARCHY[currentPath];
  }
  
  // Handle dynamic routes
  
  // Profile edit -> profile
  const profileEditMatch = currentPath.match(/^\/profile\/([^\/]+)\/edit$/);
  if (profileEditMatch) {
    return `/profile/${profileEditMatch[1]}`;
  }
  
  // Post detail -> feed
  if (currentPath.startsWith('/feed/post/')) {
    return '/feed';
  }
  
  // Hashtag search -> feed/search or feed
  if (currentPath.startsWith('/feed/hashtag/')) {
    return '/feed/search';
  }
  
  // Live stream detail -> live
  if (currentPath.startsWith('/live/stream/')) {
    return '/live';
  }
  
  // Space detail -> live
  if (currentPath.startsWith('/live/space/') || currentPath.startsWith('/space/')) {
    return '/live';
  }
  
  // Story detail -> feed
  if (currentPath.startsWith('/story/')) {
    return '/feed';
  }
  
  // P2P transaction -> p2p marketplace
  if (currentPath.startsWith('/wallet/p2p/')) {
    return '/wallet/p2p';
  }
  
  // Group detail -> groups
  if (currentPath.startsWith('/groups/')) {
    return '/groups';
  }
  
  // Call invite -> call
  if (currentPath.startsWith('/call/join/')) {
    return '/call';
  }
  
  // Promote -> feed (since we came from post)
  if (currentPath.startsWith('/promote/')) {
    return '/feed';
  }
  
  // Profile page -> feed
  if (currentPath.match(/^\/profile\/[^\/]+$/)) {
    return '/feed';
  }
  
  // Referral page -> welcome
  if (currentPath.startsWith('/ref/')) {
    return '/welcome';
  }
  
  // Default fallback - go back in history
  return '';
}

/**
 * Check if we should show back button on a given route
 */
export function shouldShowBackButton(currentPath: string): boolean {
  // Main routes that don't need back button
  const mainRoutes = [
    '/',
    '/welcome',
    '/feed',
    '/messages',
    '/wallet',
    '/ai/copilot',
    '/live',
    '/settings',
  ];
  
  // Check if it's a main route
  if (mainRoutes.includes(currentPath)) {
    return false;
  }
  
  // Profile pages (without /edit) show back button
  if (currentPath.match(/^\/profile\/[^\/]+$/)) {
    return true;
  }
  
  return true;
}

/**
 * Get breadcrumb path for a route
 */
export function getBreadcrumbs(currentPath: string): Array<{ label: string; path: string }> {
  const breadcrumbs: Array<{ label: string; path: string }> = [];
  let path = currentPath;
  
  while (path && path !== '/') {
    const destination = getBackDestination(path);
    if (destination && destination !== path) {
      breadcrumbs.unshift({
        label: getRouteLabel(destination),
        path: destination,
      });
      path = destination;
    } else {
      break;
    }
  }
  
  return breadcrumbs;
}

/**
 * Get human-readable label for a route
 */
function getRouteLabel(path: string): string {
  const labels: Record<string, string> = {
    '/': 'Home',
    '/welcome': 'Welcome',
    '/feed': 'Feed',
    '/messages': 'Messages',
    '/wallet': 'Wallet',
    '/settings': 'Settings',
    '/live': 'Live',
    '/ai/copilot': 'AI Copilot',
    '/groups': 'Groups',
    '/friends': 'Friends',
    '/wallet/p2p': 'P2P Marketplace',
    '/feed/search': 'Search',
    '/settings/investors': 'Investors',
  };
  
  return labels[path] || path;
}

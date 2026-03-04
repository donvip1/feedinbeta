// Cache version - increment this to force cache refresh on new deployments
const CACHE_VERSION = 'v1';
const CACHE_NAME = `feedin-${CACHE_VERSION}`;
const CACHE_STATIC = `${CACHE_NAME}-static`;
const CACHE_DYNAMIC = `${CACHE_NAME}-dynamic`;
const CACHE_IMAGES = `${CACHE_NAME}-images`;
const CACHE_MEDIA = `${CACHE_NAME}-media`;
const CACHE_API = `${CACHE_NAME}-api`;

// Build timestamp for version tracking
const BUILD_TIMESTAMP = Date.now();

// AGGRESSIVE: Assets to cache immediately for instant app loads
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/favicon.png',
  '/offline.html',
  '/robots.txt',
];

// Max cache sizes - increased for better offline experience
const MAX_DYNAMIC_CACHE = 150;
const MAX_IMAGE_CACHE = 500;
const MAX_MEDIA_CACHE = 100;
const MAX_API_CACHE = 50;

// Update check interval (30 seconds for faster updates on mobile)
const UPDATE_CHECK_INTERVAL = 30 * 1000;

// IMPORTANT: These API patterns should NEVER be cached - always network first
// This ensures mobile app always gets fresh data
const NEVER_CACHE_PATTERNS = [
  '/rest/v1/live_streams',
  '/rest/v1/live_spaces',
  '/rest/v1/live_space_speakers',
  '/rest/v1/notifications',
  '/rest/v1/messages',
  '/rest/v1/conversations',
  '/rest/v1/posts',
  '/rest/v1/stories',
  '/realtime/',
];

// API endpoints to cache for faster loads (only static-ish data)
const CACHEABLE_API_PATTERNS = [
  '/profiles',
  '/user_credits',
];

// Install - cache static assets and activate immediately
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker v' + CACHE_VERSION);
  event.waitUntil(
    caches.open(CACHE_STATIC).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    }).then(() => {
      // Skip waiting immediately to take over faster
      console.log('[SW] Skipping waiting to activate immediately');
      return self.skipWaiting();
    })
  );
});

// Activate - clean up old caches and take control immediately
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker v' + CACHE_VERSION);
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!cacheName.startsWith(`feedin-${CACHE_VERSION}`)) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Take control of all clients immediately - this is key for silent updates
      console.log('[SW] Claiming all clients');
      return self.clients.claim();
    }).then(() => {
      // Notify all clients that a new version is active
      return self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ 
            action: 'versionUpdate', 
            version: CACHE_VERSION,
            timestamp: BUILD_TIMESTAMP,
            silent: true
          });
        });
        console.log('[SW] Notified', clients.length, 'clients of update');
      });
    })
  );
});

// Periodic update check using message loop
let lastUpdateCheck = Date.now();

self.addEventListener('message', (event) => {
  if (event.data.action === 'skipWaiting') {
    console.log('[SW] Received skipWaiting message');
    self.skipWaiting().then(() => {
      return self.clients.claim();
    }).then(() => {
      console.log('[SW] Claimed all clients');
    });
  }
  
  if (event.data.action === 'clearCache') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => caches.delete(cacheName))
        );
      }).then(() => {
        return self.clients.matchAll();
      }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ action: 'cacheCleared' });
        });
      })
    );
  }

  if (event.data.action === 'checkForUpdate') {
    // Respond with current version info
    event.source.postMessage({
      action: 'versionInfo',
      version: CACHE_VERSION,
      timestamp: BUILD_TIMESTAMP,
      lastCheck: lastUpdateCheck
    });
    lastUpdateCheck = Date.now();
  }

  if (event.data.action === 'getVersion') {
    event.source.postMessage({
      action: 'versionInfo',
      version: CACHE_VERSION,
      timestamp: BUILD_TIMESTAMP
    });
  }
});

// Handle Push Notifications
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');
  
  let data = {};
  
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = {
      title: 'FeedIn',
      body: event.data ? event.data.text() : 'New notification',
    };
  }
  
  const isCall = data.type === 'incoming_call' || data.data?.type === 'incoming_call';
  
  const title = data.title || 'FeedIn';
  const options = {
    body: data.body || 'You have a new notification',
    icon: data.icon || '/favicon.png',
    badge: '/favicon.png',
    // Long vibration for calls, short for regular notifications
    vibrate: isCall ? [200, 100, 200, 100, 200, 100, 200, 100, 200] : [200, 100, 200],
    tag: data.tag || 'feedin-notification',
    renotify: true,
    // Keep call notifications visible until user interacts
    requireInteraction: isCall,
    data: {
      url: data.url || data.data?.url || '/',
      type: data.type || data.data?.type,
      callId: data.callId || data.data?.callId,
      callerId: data.callerId || data.data?.callerId,
      callType: data.callType || data.data?.callType,
      related_id: data.related_id,
      related_type: data.related_type,
      ...data,
    },
    actions: isCall 
      ? [
          { action: 'answer', title: '📞 Answer' },
          { action: 'decline', title: '❌ Decline' }
        ]
      : getActionsForType(data.type),
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Get appropriate actions based on notification type
function getActionsForType(type) {
  switch (type) {
    case 'message':
      return [
        { action: 'reply', title: 'Reply' },
        { action: 'dismiss', title: 'Dismiss' }
      ];
    case 'friend_request':
      return [
        { action: 'view', title: 'View' },
        { action: 'dismiss', title: 'Dismiss' }
      ];
    default:
      return [
        { action: 'open', title: 'Open' },
        { action: 'dismiss', title: 'Dismiss' }
      ];
  }
}

// Handle Notification Clicks
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.action);
  
  event.notification.close();
  
  const notificationData = event.notification.data || {};
  const isCall = notificationData.type === 'incoming_call';
  
  // Handle call notification actions
  if (isCall) {
    if (event.action === 'decline') {
      // Decline the call via API
      event.waitUntil(
        fetch(`${self.location.origin}/api/decline-call`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ callId: notificationData.callId })
        }).catch(err => console.log('[SW] Failed to decline call:', err))
      );
      return;
    }
    
    // Answer or just clicked - navigate to call page
    const callUrl = `/call?callId=${notificationData.callId}`;
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.focus();
            client.navigate(callUrl);
            return;
          }
        }
        return clients.openWindow(callUrl);
      })
    );
    return;
  }
  
  if (event.action === 'dismiss') {
    return;
  }
  
  let targetUrl = '/';
  
  // Determine the target URL based on notification type
  switch (notificationData.type) {
    case 'message':
      targetUrl = notificationData.related_id 
        ? `/messages?conversation=${notificationData.related_id}`
        : '/messages';
      break;
    case 'friend_request':
    case 'friend_request_accepted':
      targetUrl = '/friends';
      break;
    case 'like':
    case 'comment':
    case 'reply':
    case 'mention':
    case 'refeed':
    case 'quote':
      targetUrl = notificationData.related_id 
        ? `/post/${notificationData.related_id}`
        : '/feed';
      break;
    case 'follow':
      targetUrl = notificationData.related_id 
        ? `/profile/${notificationData.related_id}`
        : '/feed';
      break;
    case 'gift':
    case 'gift_received':
      targetUrl = notificationData.related_id 
        ? `/post/${notificationData.related_id}`
        : '/wallet';
      break;
    case 'live_invite':
    case 'live_gift':
      targetUrl = notificationData.related_id 
        ? `/live/${notificationData.related_id}`
        : '/live';
      break;
    case 'story_reply':
    case 'story_reaction':
      targetUrl = notificationData.related_id 
        ? `/story/${notificationData.related_id}`
        : '/feed';
      break;
    default:
      targetUrl = notificationData.url || '/';
  }
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if there's already a window/tab open
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.navigate(targetUrl);
          return;
        }
      }
      // Open new window if none exists
      return clients.openWindow(targetUrl);
    })
  );
});

// Background Sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);
  
  if (event.tag === 'sync-posts') {
    event.waitUntil(syncPosts());
  }
  
  if (event.tag === 'sync-messages') {
    event.waitUntil(syncMessages());
  }
});

async function syncPosts() {
  console.log('[SW] Syncing pending posts...');
}

async function syncMessages() {
  console.log('[SW] Syncing pending messages...');
}

// Fetch - smart caching strategy with API caching for faster loads
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  // CRITICAL: Never cache real-time/live data endpoints - always use network
  const shouldNeverCache = NEVER_CACHE_PATTERNS.some(pattern => 
    url.pathname.includes(pattern) || url.href.includes(pattern)
  );
  
  if (shouldNeverCache) {
    // Network only - no caching for live data
    return;
  }

  // Cache certain Supabase API responses (read-only) for instant page loads
  if (url.origin.includes('supabase.co') && url.pathname.includes('/rest/v1/')) {
    // Check if this is a cacheable endpoint
    const isCacheable = CACHEABLE_API_PATTERNS.some(pattern => 
      url.pathname.includes(pattern)
    );
    
    if (isCacheable) {
      event.respondWith(staleWhileRevalidate(request, CACHE_API, MAX_API_CACHE));
      return;
    }
    return; // Don't cache other API calls
  }

  // Skip edge functions
  if (url.pathname.includes('/functions/v1/')) {
    return;
  }

  if (request.destination === 'image') {
    event.respondWith(cacheFirstStrategy(request, CACHE_IMAGES, MAX_IMAGE_CACHE));
  } else if (
    request.destination === 'script' ||
    request.destination === 'style'
  ) {
    // Cache-first for JS/CSS for instant loads
    event.respondWith(cacheFirstWithRevalidate(request, CACHE_DYNAMIC, MAX_DYNAMIC_CACHE));
  } else if (request.destination === 'font') {
    event.respondWith(cacheFirstStrategy(request, CACHE_STATIC));
  } else if (request.destination === 'document') {
    // HTML pages - network first but fast fallback
    event.respondWith(networkFirstFast(request, CACHE_DYNAMIC, MAX_DYNAMIC_CACHE));
  } else {
    event.respondWith(staleWhileRevalidate(request, CACHE_DYNAMIC, MAX_DYNAMIC_CACHE));
  }
});

// Cache First Strategy - fastest for static assets
async function cacheFirstStrategy(request, cacheName, maxItems) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
      
      if (maxItems) {
        limitCacheSize(cacheName, maxItems);
      }
    }
    return response;
  } catch (error) {
    console.log('[SW] Fetch failed, returning offline fallback:', error);
    return caches.match('/offline.html');
  }
}

// Cache First with background revalidate - serve cached, update in background
async function cacheFirstWithRevalidate(request, cacheName, maxItems) {
  const cached = await caches.match(request);
  
  // Always fetch in background to update cache
  const fetchPromise = fetch(request).then(response => {
    if (response.ok) {
      const cache = caches.open(cacheName);
      cache.then(c => {
        c.put(request, response.clone());
        if (maxItems) limitCacheSize(cacheName, maxItems);
      });
    }
    return response;
  }).catch(() => null);

  // Return cached immediately if available
  if (cached) {
    return cached;
  }

  // Wait for network if no cache
  const response = await fetchPromise;
  return response || caches.match('/offline.html');
}

// Stale While Revalidate - serve cached, update in background
async function staleWhileRevalidate(request, cacheName, maxItems) {
  const cached = await caches.match(request);
  
  // Fetch fresh in background
  const fetchPromise = fetch(request).then(response => {
    if (response.ok) {
      const cache = caches.open(cacheName);
      cache.then(c => {
        c.put(request, response.clone());
        if (maxItems) limitCacheSize(cacheName, maxItems);
      });
    }
    return response;
  }).catch(err => {
    console.log('[SW] Background fetch failed:', err);
    return null;
  });

  // Return cached immediately, network will update for next time
  if (cached) {
    return cached;
  }

  // No cache, wait for network
  const response = await fetchPromise;
  return response || caches.match('/offline.html');
}

// Network First with fast timeout - quick fallback to cache
async function networkFirstFast(request, cacheName, maxItems) {
  const TIMEOUT = 2000; // 2 second timeout for fast fallback
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);
    
    const response = await fetch(request, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
      if (maxItems) limitCacheSize(cacheName, maxItems);
    }
    return response;
  } catch (error) {
    console.log('[SW] Network slow/failed, using cache:', error.message);
    const cached = await caches.match(request);
    return cached || caches.match('/offline.html');
  }
}

// Network First Strategy - legacy fallback
async function networkFirstStrategy(request, cacheName, maxItems) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
      
      if (maxItems) {
        limitCacheSize(cacheName, maxItems);
      }
    }
    return response;
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', error);
    const cached = await caches.match(request);
    return cached || caches.match('/offline.html');
  }
}

// Limit cache size - non-blocking
function limitCacheSize(cacheName, maxItems) {
  caches.open(cacheName).then(cache => {
    cache.keys().then(keys => {
      if (keys.length > maxItems) {
        const deleteCount = keys.length - maxItems;
        for (let i = 0; i < deleteCount; i++) {
          cache.delete(keys[i]);
        }
      }
    });
  });
}

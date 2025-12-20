// Cache version - increment this to force cache refresh on new deployments
const CACHE_VERSION = 'v6';
const CACHE_NAME = `feedin-${CACHE_VERSION}`;
const CACHE_STATIC = `${CACHE_NAME}-static`;
const CACHE_DYNAMIC = `${CACHE_NAME}-dynamic`;
const CACHE_IMAGES = `${CACHE_NAME}-images`;

// Build timestamp for version tracking
const BUILD_TIMESTAMP = Date.now();

// Assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/favicon.png',
  '/offline.html',
];

// Max cache sizes
const MAX_DYNAMIC_CACHE = 50;
const MAX_IMAGE_CACHE = 100;

// Update check interval (5 minutes)
const UPDATE_CHECK_INTERVAL = 5 * 60 * 1000;

// Install - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker v' + CACHE_VERSION);
  event.waitUntil(
    caches.open(CACHE_STATIC).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    }).then(() => {
      // Immediately take over (for faster updates)
      return self.skipWaiting();
    })
  );
});

// Activate - clean up old caches
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
      // Take control of all clients immediately
      return self.clients.claim();
    }).then(() => {
      // Notify all clients that a new version is active
      return self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ 
            action: 'versionUpdate', 
            version: CACHE_VERSION,
            timestamp: BUILD_TIMESTAMP
          });
        });
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
  
  const title = data.title || 'FeedIn';
  const options = {
    body: data.body || 'You have a new notification',
    icon: '/favicon.png',
    badge: '/favicon.png',
    vibrate: [200, 100, 200],
    tag: data.tag || 'feedin-notification',
    renotify: true,
    requireInteraction: false,
    data: {
      url: data.url || '/',
      type: data.type,
      related_id: data.related_id,
      related_type: data.related_type,
      ...data,
    },
    actions: getActionsForType(data.type),
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
  
  if (event.action === 'dismiss') {
    return;
  }
  
  const notificationData = event.notification.data || {};
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

// Fetch - smart caching strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  if (
    url.origin.includes('supabase.co') ||
    url.pathname.startsWith('/api/') ||
    url.pathname.includes('/functions/v1/')
  ) {
    return;
  }

  if (request.destination === 'image') {
    event.respondWith(cacheFirstStrategy(request, CACHE_IMAGES, MAX_IMAGE_CACHE));
  } else if (
    request.destination === 'script' ||
    request.destination === 'style'
  ) {
    event.respondWith(networkFirstStrategy(request, CACHE_DYNAMIC, MAX_DYNAMIC_CACHE));
  } else if (request.destination === 'font') {
    event.respondWith(cacheFirstStrategy(request, CACHE_STATIC));
  } else {
    event.respondWith(networkFirstStrategy(request, CACHE_DYNAMIC, MAX_DYNAMIC_CACHE));
  }
});

// Cache First Strategy
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
        await limitCacheSize(cacheName, maxItems);
      }
    }
    return response;
  } catch (error) {
    console.log('[SW] Fetch failed, returning offline fallback:', error);
    return caches.match('/offline.html');
  }
}

// Network First Strategy
async function networkFirstStrategy(request, cacheName, maxItems) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
      
      if (maxItems) {
        await limitCacheSize(cacheName, maxItems);
      }
    }
    return response;
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', error);
    const cached = await caches.match(request);
    return cached || caches.match('/offline.html');
  }
}

// Limit cache size
async function limitCacheSize(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  
  if (keys.length > maxItems) {
    const deleteCount = keys.length - maxItems;
    for (let i = 0; i < deleteCount; i++) {
      await cache.delete(keys[i]);
    }
  }
}

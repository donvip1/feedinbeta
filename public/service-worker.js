// Cache version - increment this to force cache refresh on new deployments
const CACHE_VERSION = 'v2';
const CACHE_NAME = `feedin-${CACHE_VERSION}`;
const CACHE_STATIC = `${CACHE_NAME}-static`;
const CACHE_DYNAMIC = `${CACHE_NAME}-dynamic`;
const CACHE_IMAGES = `${CACHE_NAME}-images`;

// Assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/favicon.png',
  '/offline.html', // Fallback page
];

// Max cache sizes
const MAX_DYNAMIC_CACHE = 50;
const MAX_IMAGE_CACHE = 100;

// Install - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(CACHE_STATIC).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    }).then(() => {
      return self.skipWaiting(); // Activate immediately
    })
  );
});

// Activate - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Delete any cache that doesn't match current version
          if (!cacheName.startsWith(`feedin-${CACHE_VERSION}`)) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      return self.clients.claim(); // Take control immediately
    })
  );
});

// Fetch - smart caching strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip API calls and Supabase requests (always fetch fresh)
  if (
    url.origin.includes('supabase.co') ||
    url.pathname.startsWith('/api/') ||
    url.pathname.includes('/functions/v1/')
  ) {
    return;
  }

  // Handle different asset types with appropriate strategies
  if (request.destination === 'image') {
    event.respondWith(cacheFirstStrategy(request, CACHE_IMAGES, MAX_IMAGE_CACHE));
  } else if (
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'font'
  ) {
    event.respondWith(cacheFirstStrategy(request, CACHE_STATIC));
  } else {
    // For HTML and other resources, use network first
    event.respondWith(networkFirstStrategy(request, CACHE_DYNAMIC, MAX_DYNAMIC_CACHE));
  }
});

// Cache First Strategy - for static assets
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
      
      // Limit cache size
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

// Network First Strategy - for dynamic content
async function networkFirstStrategy(request, cacheName, maxItems) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
      
      // Limit cache size
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

// Limit cache size by removing oldest entries
async function limitCacheSize(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  
  if (keys.length > maxItems) {
    // Delete oldest entries (FIFO)
    const deleteCount = keys.length - maxItems;
    for (let i = 0; i < deleteCount; i++) {
      await cache.delete(keys[i]);
    }
  }
}

// Handle messages from clients
self.addEventListener('message', (event) => {
  if (event.data.action === 'skipWaiting') {
    console.log('[SW] Received skipWaiting message');
    self.skipWaiting().then(() => {
      // Take control of all clients immediately
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
});

// Push Notification Support
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');
  
  if (!event.data) {
    console.log('[SW] Push event but no data');
    return;
  }

  try {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: data.icon || '/favicon.png',
      badge: data.badge || '/favicon.png',
      data: data.data || {},
      vibrate: [200, 100, 200],
      actions: [
        { action: 'open', title: 'Open' },
        { action: 'close', title: 'Close' }
      ],
      tag: data.tag || 'default',
      requireInteraction: false,
    };

    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  } catch (error) {
    console.error('[SW] Error handling push:', error);
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked');
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  // Open or focus the app
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if there's already a window open
      for (const client of clientList) {
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      // If no window is open, open a new one
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});

// Handle push subscription changes
self.addEventListener('pushsubscriptionchange', (event) => {
  console.log('[SW] Push subscription changed');
  event.waitUntil(
    self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: event.oldSubscription.options.applicationServerKey
    }).then((subscription) => {
      console.log('[SW] Resubscribed with new subscription');
      // Update subscription on the server
      return fetch('/api/push/update-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          oldEndpoint: event.oldSubscription.endpoint,
          newSubscription: subscription.toJSON()
        })
      });
    })
  );
});

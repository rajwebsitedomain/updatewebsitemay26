// ============================================================
// SERVICE WORKER WITH PDF CACHING
// ============================================================

const CACHE_NAME = 'my-site-v2';
const PDF_CACHE_NAME = 'pdf-cache-v1';

// Files to cache (add your files here)
const FILES_TO_CACHE = [
  '/',
  '/index.html',
  '/rajcv.pdf',           // ← ADD YOUR PDF HERE
  // Add other files...
];

// ----- INSTALL -----
self.addEventListener('install', event => {
  console.log('📦 Installing Service Worker...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('📦 Caching files...');
        return cache.addAll(FILES_TO_CACHE);
      })
      .then(() => self.skipWaiting())
      .catch(err => console.log('⚠️ Cache error:', err))
  );
});

// ----- ACTIVATE -----
self.addEventListener('activate', event => {
  console.log('🔧 Activating Service Worker...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME && cacheName !== PDF_CACHE_NAME) {
            console.log('🗑️ Removing old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
    .then(() => self.clients.claim())
  );
});

// ----- FETCH: Serve from cache first -----
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Special handling for PDF files
  if (url.pathname.endsWith('.pdf')) {
    event.respondWith(
      caches.match(event.request)
        .then(cachedResponse => {
          if (cachedResponse) {
            console.log('📄 PDF served from cache:', url.pathname);
            // Update cache in background
            fetch(event.request)
              .then(networkResponse => {
                if (networkResponse && networkResponse.status === 200) {
                  caches.open(PDF_CACHE_NAME).then(cache => {
                    cache.put(event.request, networkResponse.clone());
                  });
                }
              })
              .catch(() => {});
            return cachedResponse;
          }
          
          // Not in cache - fetch and cache
          return fetch(event.request)
            .then(networkResponse => {
              if (networkResponse && networkResponse.status === 200) {
                const clone = networkResponse.clone();
                caches.open(PDF_CACHE_NAME).then(cache => {
                  cache.put(event.request, clone);
                  console.log('📄 PDF cached:', url.pathname);
                });
              }
              return networkResponse;
            })
            .catch(() => {
              // Offline fallback
              return new Response('PDF not available offline', { status: 404 });
            });
        })
    );
    return;
  }

  // Normal files: cache first
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          // Update in background
          fetch(event.request)
            .then(networkResponse => {
              if (networkResponse && networkResponse.status === 200) {
                caches.open(CACHE_NAME).then(cache => {
                  cache.put(event.request, networkResponse.clone());
                });
              }
            })
            .catch(() => {});
          return cachedResponse;
        }
        
        return fetch(event.request)
          .then(networkResponse => {
            if (networkResponse && networkResponse.status === 200) {
              const clone = networkResponse.clone();
              caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, clone);
              });
            }
            return networkResponse;
          })
          .catch(() => {
            // Return offline page
            return caches.match('/offline.html') || new Response(
              '<h1>Offline</h1><p>Please check your connection.</p>',
              { headers: { 'Content-Type': 'text/html' } }
            );
          });
      })
  );
});

// ----- MESSAGE: Handle PDF caching requests from page -----
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'CACHE_PDFS') {
    const pdfUrls = event.data.urls || [];
    console.log('📦 Received PDF cache request:', pdfUrls);
    
    event.waitUntil(
      caches.open(PDF_CACHE_NAME).then(cache => {
        return Promise.all(
          pdfUrls.map(url => {
            return fetch(url)
              .then(response => {
                if (response && response.status === 200) {
                  cache.put(url, response.clone());
                  console.log('✅ PDF cached:', url);
                }
              })
              .catch(err => console.log('⚠️ Could not cache PDF:', url, err));
          })
        );
      })
    );
  }
});

// Minimal service worker: caches the app shell on install so the game
// still opens (and can be installed) without a network connection.
//
// Bumped to v3 + switched from cache.addAll (which is atomic - one
// missing file like a not-yet-added icon fails the ENTIRE install and
// silently leaves nothing cached) to per-file caching, so a missing
// icon just gets skipped instead of breaking offline support.
const CACHE_NAME="alien-td-v3";
const APP_SHELL=[
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install",e=>{
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache=>
      Promise.all(APP_SHELL.map(url=>
        cache.add(url).catch(err=>{
          console.warn("[AlienTD SW] Skipping uncacheable shell file:",url,err);
        })
      ))
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate",e=>{
  e.waitUntil(
    caches.keys().then(keys=>
      Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Cache-first for the app shell, falling back to network (and caching
// what we fetch) for anything else, e.g. the Google Font or music files.
self.addEventListener("fetch",e=>{
  if(e.request.method!=="GET") return;
  e.respondWith(
    caches.match(e.request).then(cached=>{
      if(cached) return cached;
      return fetch(e.request).then(response=>{
        if(response && response.ok){
          const copy=response.clone();
          caches.open(CACHE_NAME).then(cache=>cache.put(e.request,copy)).catch(()=>{});
        }
        return response;
      }).catch(()=>cached);
    })
  );
});

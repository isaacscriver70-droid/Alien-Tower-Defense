// Minimal service worker: caches the app shell on install so the game
// still opens (and can be installed) without a network connection.
//
// Updated for the multi-page split: every page + shared module gets
// listed explicitly (cache.add is atomic per URL below via the
// per-file .catch(), so one missing file never breaks the rest).
const CACHE_NAME="alien-td-v5-friends";
const APP_SHELL=[
  "./",
  "./index.html",
  "./game.html",
  "./bestiary.html",
  "./achievements.html",
  "./quests.html",
  "./leaderboard.html",
  "./inventory.html",
  "./summoning.html",
  "./crafting.html",
  "./friends.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./lobby.js",
  "./game.js",
  "./bestiary.js",
  "./achievements.js",
  "./quests-page.js",
  "./leaderboard.js",
  "./inventory.js",
  "./summoning.js",
  "./crafting.js",
  "./friends.js",
  "./shared/style.css",
  "./shared/data.js",
  "./shared/storage.js",
  "./shared/audio.js",
  "./shared/ui.js",
  "./shared/settings.js",
  "./shared/icons.js",
  "./shared/quests.js",
  "./shared/admin-meta.js"
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

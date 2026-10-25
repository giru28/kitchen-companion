
const PREFIX='kitchen-'+encodeURIComponent(new URL(self.registration.scope).pathname)+'-',CACHE=PREFIX+"878f80e04b31",FILES=["./","./index.html","./manifest.webmanifest","./icon.svg","./icon-192.png","./icon-512.png","./apple-touch-icon.png","./assets/index-CTAwJ_8w.css","./assets/index-CZDVy3h2.js"];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin)return;
 // Keep the HTML and hashed assets from one build together until the next worker activates.
 // Static assets have identical content across Origin header variants (for example Vite's Vary: Origin).
 e.respondWith(caches.open(CACHE).then(c=>c.match(e.request.mode==='navigate'?'./index.html':e.request,{ignoreVary:true})).then(r=>r||fetch(e.request)));
});
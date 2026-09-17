const CACHE='barbarik-v6';
const ASSETS=['./','./index.html','./manifest.json'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  if(e.request.destination==='document'){
    e.respondWith(fetch(e.request).then(async r=>{
      const text=await r.text();
      const replaced=text.replace(/<img class="rsLogo"[^>]*>/i,'<div class="rsLogo" aria-label="Rajput Solar" style="width:58px;height:52px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#39a9ff;text-align:center;line-height:1.05">Rajput<br>Solar</div>');
      return new Response(replaced,{status:r.status,statusText:r.statusText,headers:r.headers});
    }).catch(()=>caches.match('./index.html')));
    return;
  }
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).catch(()=>caches.match('./index.html'))));
});
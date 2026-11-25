const C="daata-production-v57-20261125";
const FILES=["./","index.html","mobile-preview.html","manifest.json","header.jpg","daata-mark-v8.svg","daata-icon-v8-192.png","daata-icon-v8-512.png","pso.png"];
self.addEventListener("install",e=>{self.skipWaiting();e.waitUntil(caches.open(C).then(c=>Promise.all(FILES.map(u=>c.add(u).catch(()=>{})))))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",e=>{
 if(e.request.method!=="GET")return;
 const u=new URL(e.request.url);
 if(u.hostname.includes("firestore.googleapis.com")||u.hostname.includes("identitytoolkit")||u.hostname.includes("securetoken"))return;
 e.respondWith(fetch(e.request).then(r=>{if(r&&r.ok){const c=r.clone();caches.open(C).then(x=>x.put(e.request,c))}return r}).catch(()=>caches.match(e.request,{ignoreSearch:true})))});

const C="pump-v3";
self.addEventListener("install",e=>{self.skipWaiting();e.waitUntil(caches.open(C).then(c=>c.addAll(["./","index.html","manifest.json","icon-192.png","logo.png","pso.png","header.jpg"])))});
self.addEventListener("activate",e=>e.waitUntil(clients.claim()));
self.addEventListener("fetch",e=>{
 const u=new URL(e.request.url);
 if(e.request.method!=="GET")return;
 if(u.origin===location.origin||u.hostname==="www.gstatic.com"){
  e.respondWith(caches.open(C).then(async c=>{
   const hit=await c.match(e.request);
   const net=fetch(e.request).then(r=>{if(r.ok)c.put(e.request,r.clone());return r}).catch(()=>hit);
   return hit||net;
  }));
 }
});

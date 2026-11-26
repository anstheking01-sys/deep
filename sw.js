// عامل خدمة بسيط: يخزّن ملفات الواجهة فقط (ليفتح التطبيق بسرعة)، ولا يخزّن أي بيانات من Supabase.
// الشبكة أولًا دائمًا، فلا تبقى نسخة قديمة بعد كل تحديث.
const CACHE='deep-shell-v18';
const SHELL=['./','index.html','css/style.css','manifest.webmanifest'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).catch(()=>{}));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
  const url=new URL(e.request.url);
  if(e.request.method!=='GET'||url.origin!==location.origin)return; // لا نلمس طلبات Supabase أو CDN
  e.respondWith(fetch(e.request).then(res=>{const copy=res.clone();caches.open(CACHE).then(c=>c.put(e.request,copy)).catch(()=>{});return res;}).catch(()=>caches.match(e.request).then(r=>r||caches.match('index.html'))));
});

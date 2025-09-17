const CACHE = 'barpos-v3';
self.addEventListener('install', e=>{
e.waitUntil(caches.open(CACHE).then(c=> c.addAll(['./','./index.html','./styles.css','./app.js','./icon-512.png','./manifest.webmanifest'])));
});
self.addEventListener('fetch', e=>{
e.respondWith(caches.match(e.request).then(r=> r || fetch(e.request)));
});

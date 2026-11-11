// 로분소 서비스 워커: 홈 화면 추가(PWA)와 오프라인에서 마지막 화면 열기 지원
// 매주 바뀌는 회차 데이터는 '네트워크 우선'(실패 시 캐시), CDN 라이브러리·글꼴·아이콘은 '캐시 우선'
const VER = "robunso-1"; // 화면 파일 구조를 바꿨으면 이 버전을 1 올려 옛 캐시를 비운다
const CORE = ["./", "index.html", "data.js", "dl.js", "rich.js", "version.json", "manifest.webmanifest", "icon-192.png", "icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VER).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VER).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  // 화면 이동(주소창 접근 등): 네트워크 우선 — 새 회차·새 화면이 바로 보이게, 실패 시 마지막 화면
  if (e.request.mode === "navigate") {
    e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(VER).then(c2 => c2.put("./", c)); return r; })
      .catch(() => caches.match("./")));
    return;
  }
  const isCore = CORE.some(p => p !== "./" && url.pathname.endsWith(p));
  const isCdn = url.hostname === "cdn.jsdelivr.net";
  if (!isCore && !isCdn) return; // 나머지는 그냥 통과
  if (isCore) {
    e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(VER).then(c2 => c2.put(e.request, c)); return r; })
      .catch(() => caches.match(e.request)));
  } else {
    e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(r => { const c = r.clone(); caches.open(VER).then(c2 => c2.put(e.request, c)); return r; })));
  }
});

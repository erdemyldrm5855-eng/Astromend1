/* ══════════════════════════════════════════════════════════
   home-init.js — Sayfa yüklendiğinde çalışacak başlangıç
   çağrıları. Diğer TÜM home-*.js dosyalarından SONRA
   yüklenmelidir (kullandığı fonksiyonlar onlarda tanımlı).
   ══════════════════════════════════════════════════════════ */

refreshHeader();
loadPosts();
loadStories();
checkNotifDot();
loadDailyPoll();

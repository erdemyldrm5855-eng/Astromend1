/* ══════════════════════════════════════════════════════════
   home-menu.js — Mobil hamburger menü (aç/kapa).
   Menüdeki linkler (.nav-link, [data-action]) home-core.js'in
   genel wiring'i tarafından zaten işlevsel hale getirilir —
   burada sadece menünün açılıp kapanmasını yönetiyoruz.
   ══════════════════════════════════════════════════════════ */

const hamburgerBtn = document.getElementById('hamburgerBtn');
const mobileMenu = document.getElementById('mobileMenu');
const mobileMenuOverlay = document.getElementById('mobileMenuOverlay');

function openMobileMenu() {
  if (!mobileMenu || !mobileMenuOverlay) return;
  mobileMenu.hidden = false;
  mobileMenuOverlay.hidden = false;
  hamburgerBtn?.classList.add('open');
}

function closeMobileMenu() {
  if (!mobileMenu || !mobileMenuOverlay) return;
  mobileMenu.hidden = true;
  mobileMenuOverlay.hidden = true;
  hamburgerBtn?.classList.remove('open');
}

hamburgerBtn?.addEventListener('click', () => {
  if (mobileMenu.hidden) openMobileMenu(); else closeMobileMenu();
});

mobileMenuOverlay?.addEventListener('click', closeMobileMenu);

mobileMenu?.querySelectorAll('.mobile-menu-link').forEach(link => {
  link.addEventListener('click', closeMobileMenu);
});

document.getElementById('mobileLogoutBtn')?.addEventListener('click', async () => {
  await fetch('/api/logout', { method: 'POST' });
  window.location.href = 'log.html';
});

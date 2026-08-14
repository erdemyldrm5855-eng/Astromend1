/* ══════════════════════════════════════════════════════════
   home-community.js — Topluluk listesi ve arama.
   home-core.js'e bağımlıdır (escapeHtml).
   ══════════════════════════════════════════════════════════ */

async function loadCommunity(q = '') {
  const el = document.getElementById('communityList');
  if (!el) return;
  el.innerHTML = '<p class="empty-note">Yükleniyor…</p>';
  try {
    const res = await fetch(`/api/community?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    if (!data.ok) { el.innerHTML = '<p class="empty-note">Yüklenemedi.</p>'; return; }
    if (!data.users.length) { el.innerHTML = `<p class="empty-note">${q ? 'Sonuç bulunamadı.' : 'Henüz kimse yok.'}</p>`; return; }
    el.innerHTML = data.users.map(u => `
      <div class="community-card">
        <div class="community-avatar">${u.avatar ? `<img src="${u.avatar}" alt="${escapeHtml(u.name)}">` : escapeHtml((u.name || '?')[0].toUpperCase())}</div>
        <div>
          <div class="community-name">${escapeHtml(u.name)}</div>
          <div class="community-sign">${u.sign ? `${u.signSymbol} ${escapeHtml(u.sign)}` : 'Burç bilgisi yok'}</div>
          ${u.bio ? `<div class="community-bio">${escapeHtml(u.bio)}</div>` : ''}
        </div>
      </div>`).join('');
  } catch {
    el.innerHTML = '<p class="empty-note">Sunucuya ulaşılamadı.</p>';
  }
}

let communitySearchTimer;
document.getElementById('communitySearch')?.addEventListener('input', (e) => {
  clearTimeout(communitySearchTimer);
  const val = e.target.value;
  communitySearchTimer = setTimeout(() => loadCommunity(val), 250);
});

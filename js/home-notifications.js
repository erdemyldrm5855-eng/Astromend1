/* ══════════════════════════════════════════════════════════
   home-notifications.js — Bildirim zili ve açılır listesi.
   home-core.js'e bağımlıdır (escapeHtml, timeAgo).
   ══════════════════════════════════════════════════════════ */

function notifText(n) {
  if (n.type === 'like') {
    return `<strong>${escapeHtml(n.fromUserName)}</strong> gönderini beğendi${n.postExcerpt ? `: "${escapeHtml(n.postExcerpt)}"` : ''}`;
  }
  return `<strong>${escapeHtml(n.fromUserName)}</strong> gönderine yanıt verdi: "${escapeHtml(n.commentText || '')}"`;
}

async function loadNotifications() {
  const listEl = document.getElementById('notifList');
  const dot = document.getElementById('notifDot');
  if (!listEl) return;
  try {
    const res = await fetch('/api/notifications');
    const data = await res.json();
    if (!data.ok) { listEl.innerHTML = '<p class="empty-note">Yüklenemedi.</p>'; return; }
    if (dot) dot.hidden = data.unreadCount === 0;

    if (!data.notifications.length) {
      listEl.innerHTML = '<p class="empty-note">Henüz bildirimin yok.</p>';
      return;
    }
    listEl.innerHTML = data.notifications.map(n => `
      <div class="notif-item ${n.read ? '' : 'unread'}">
        <div class="notif-avatar">${escapeHtml((n.fromUserName || '?')[0].toUpperCase())}</div>
        <div>
          <div class="notif-text">${notifText(n)}</div>
          <div class="notif-time">${timeAgo(n.createdAt)}</div>
        </div>
      </div>`).join('');
  } catch {
    listEl.innerHTML = '<p class="empty-note">Sunucuya ulaşılamadı.</p>';
  }
}

document.getElementById('notifBtn')?.addEventListener('click', async (e) => {
  e.stopPropagation();
  const dropdown = document.getElementById('notifDropdown');
  if (!dropdown) return;
  const wasHidden = dropdown.hidden;
  dropdown.hidden = !wasHidden;
  if (wasHidden) {
    await loadNotifications();
    try {
      await fetch('/api/notifications/read-all', { method: 'POST' });
      const dot = document.getElementById('notifDot');
      if (dot) dot.hidden = true;
      document.querySelectorAll('.notif-item.unread').forEach(el => el.classList.remove('unread'));
    } catch { /* sessiz geç */ }
  }
});

document.addEventListener('click', (e) => {
  const dropdown = document.getElementById('notifDropdown');
  const wrap = document.querySelector('.notif-wrap');
  if (dropdown && !dropdown.hidden && wrap && !wrap.contains(e.target)) {
    dropdown.hidden = true;
  }
});

async function checkNotifDot() {
  const dot = document.getElementById('notifDot');
  if (!dot) return;
  try {
    const res = await fetch('/api/notifications');
    const data = await res.json();
    if (data.ok) dot.hidden = data.unreadCount === 0;
  } catch { /* sessiz geç */ }
}

/* ══════════════════════════════════════════════════════════
   home-synastry.js — Sinastri (ilişki uyumu): kendi bölümü,
   kullanıcı adı ile arama (e-posta yok) + sinastri geçmişi.
   home-core.js'e bağımlıdır (escapeHtml, timeAgo).
   ══════════════════════════════════════════════════════════ */

let synSelectedPartnerId = null;
let synSearchTimer;

const synNameInput = document.getElementById('synName');
const synAutocomplete = document.getElementById('synAutocomplete');

synNameInput?.addEventListener('input', () => {
  synSelectedPartnerId = null;
  clearTimeout(synSearchTimer);
  const q = synNameInput.value.trim();
  if (!q) { synAutocomplete.hidden = true; synAutocomplete.innerHTML = ''; return; }

  synSearchTimer = setTimeout(async () => {
    try {
      const res = await fetch(`/api/community?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (!data.ok || !data.users.length) {
        synAutocomplete.innerHTML = '<div class="autocomplete-empty">Kullanıcı bulunamadı.</div>';
        synAutocomplete.hidden = false;
        return;
      }
      synAutocomplete.innerHTML = data.users.map(u => `
        <div class="autocomplete-item" data-id="${u.id}" data-name="${escapeHtml(u.name)}">
          <div class="autocomplete-avatar">${u.avatar ? `<img src="${u.avatar}" alt="">` : escapeHtml((u.name || '?')[0].toUpperCase())}</div>
          <div>${escapeHtml(u.name)} ${u.sign ? `<span class="post-sign">${u.signSymbol || ''} ${escapeHtml(u.sign)}</span>` : ''}</div>
        </div>`).join('');
      synAutocomplete.hidden = false;
      synAutocomplete.querySelectorAll('.autocomplete-item').forEach(item => {
        item.addEventListener('click', () => {
          synSelectedPartnerId = item.dataset.id;
          synNameInput.value = item.dataset.name;
          synAutocomplete.hidden = true;
        });
      });
    } catch { /* sessiz geç */ }
  }, 250);
});

document.addEventListener('click', (e) => {
  if (synAutocomplete && !synAutocomplete.hidden && synNameInput && !synNameInput.contains(e.target) && !synAutocomplete.contains(e.target)) {
    synAutocomplete.hidden = true;
  }
});

document.getElementById('synSubmit')?.addEventListener('click', async () => {
  const date = document.getElementById('synDate').value;
  const resultEl = document.getElementById('synResult');
  resultEl.innerHTML = '';

  if (!synSelectedPartnerId && !date) {
    resultEl.innerHTML = '<p class="modal-error">Listeden bir kullanıcı seç ya da doğum tarihini gir.</p>';
    return;
  }

  try {
    const res = await fetch('/api/synastry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ partnerId: synSelectedPartnerId || undefined, partnerBirthDate: date || undefined })
    });
    const data = await res.json();
    if (!data.ok) { resultEl.innerHTML = `<p class="modal-error">${escapeHtml(data.error)}</p>`; return; }
    const r = data.result;
    resultEl.innerHTML = `
      <div class="synastry-result">
        <div>${r.sign1.symbol} ${escapeHtml(r.sign1.name)} + ${r.sign2.symbol} ${escapeHtml(r.sign2.name)} (${escapeHtml(data.partnerName)})</div>
        <div class="synastry-score">%${r.score}</div>
        <div class="synastry-text">${escapeHtml(r.text)}</div>
      </div>`;
    loadSynastryHistory();
  } catch {
    resultEl.innerHTML = '<p class="modal-error">Sunucuya ulaşılamadı.</p>';
  }
});

/* ── Sinastri Geçmişi ── */
function synastryHistoryCardHtml(h) {
  return `
    <div class="chart-card history-card">
      <div class="cc-label">${timeAgo(h.createdAt)}</div>
      <div class="cc-val">${h.sign1.symbol} ${escapeHtml(h.sign1.name)} + ${h.sign2.symbol} ${escapeHtml(h.sign2.name)}</div>
      <div class="cc-text">${escapeHtml(h.partnerName)} ile uyum: <strong>%${h.score}</strong> — ${escapeHtml(h.text)}</div>
      <span class="history-delete" data-history-id="${h.id}" title="Sil">✕</span>
    </div>`;
}

async function loadSynastryHistory() {
  const body = document.getElementById('synastryHistoryBody');
  if (!body) return;
  body.innerHTML = '<p class="empty-note">Yükleniyor…</p>';

  try {
    const res = await fetch('/api/synastry-history');
    const data = await res.json();
    if (!data.ok) { body.innerHTML = '<p class="empty-note">Yüklenemedi.</p>'; return; }
    if (!data.history.length) {
      body.innerHTML = '<p class="empty-note">Henüz bir sinastri hesaplaman yok. Yukarıdan ilk uyum kontrolünü yap.</p>';
      return;
    }
    body.innerHTML = data.history.map(synastryHistoryCardHtml).join('');
    body.querySelectorAll('[data-history-id]').forEach(el => {
      el.addEventListener('click', async () => {
        if (!confirm('Bu geçmiş kaydı silinsin mi?')) return;
        await fetch(`/api/synastry-history/${el.dataset.historyId}`, { method: 'DELETE' });
        loadSynastryHistory();
      });
    });
  } catch {
    body.innerHTML = '<p class="empty-note">Sunucuya ulaşılamadı.</p>';
  }
}

function loadSynastryView() {
  synSelectedPartnerId = null;
  if (synNameInput) synNameInput.value = '';
  const dateEl = document.getElementById('synDate');
  if (dateEl) dateEl.value = '';
  const resultEl = document.getElementById('synResult');
  if (resultEl) resultEl.innerHTML = '';
  loadSynastryHistory();
}

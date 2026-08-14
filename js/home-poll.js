/* ══════════════════════════════════════════════════════════
   home-poll.js — Günün Anketi (oylama).
   home-core.js'e bağımlıdır (escapeHtml).
   ══════════════════════════════════════════════════════════ */

async function loadDailyPoll() {
  const qEl = document.getElementById('pollQuestion');
  const metaEl = document.getElementById('pollMeta');
  const optsEl = document.getElementById('pollOptions');
  if (!qEl) return;
  try {
    const res = await fetch('/api/daily-poll');
    const data = await res.json();
    if (!data.ok) { qEl.textContent = 'Anket yüklenemedi.'; return; }

    qEl.textContent = data.question;
    metaEl.textContent = `${data.total} kişi oy kullandı`;

    optsEl.innerHTML = data.options.map(o => `
      <div class="poll-row ${data.myVote === o.key ? 'voted' : (data.myVote ? '' : 'votable')}" data-poll-key="${o.key}">
        <div class="poll-row-top"><span>${escapeHtml(o.label)}</span><span>${o.percent}%</span></div>
        <div class="poll-bar"><i style="width:${o.percent}%"></i></div>
      </div>`).join('');

    if (!data.myVote) {
      optsEl.querySelectorAll('[data-poll-key]').forEach(el => {
        el.addEventListener('click', () => votePoll(el.dataset.pollKey));
      });
    }
  } catch {
    qEl.textContent = 'Sunucuya ulaşılamadı.';
  }
}

async function votePoll(key) {
  try {
    const res = await fetch('/api/daily-poll/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ option: key })
    });
    if (res.ok) loadDailyPoll();
  } catch { /* sessiz geç */ }
}

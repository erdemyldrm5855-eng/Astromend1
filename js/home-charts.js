/* ══════════════════════════════════════════════════════════
   home-charts.js — Bugünün Gökyüzü, Haritalar (Natal/Transit),
   Tüm Haritalar (12 burç + geçmiş), Solar Return.
   home-core.js'e bağımlıdır (escapeHtml, AI_MESSAGES).
   ══════════════════════════════════════════════════════════ */

function signCardHtml(label, sign, text) {
  if (!sign) return `<div class="chart-card"><div class="cc-label">${label}</div><p class="empty-note">Veri yok</p></div>`;
  return `
    <div class="chart-card">
      <div class="cc-label">${label}</div>
      <div class="cc-val">${sign.symbol} ${sign.name}</div>
      ${text ? `<div class="cc-text">${escapeHtml(text)}</div>` : ''}
    </div>`;
}

/* ── Bugünün Gökyüzü (kendi bölümü, her zaman o anki güne göre) ── */
async function loadTodaySkyView() {
  const titleEl = document.getElementById('todaySkyTitle');
  const body = document.getElementById('todaySkyBody');
  if (!body) return;

  if (titleEl) {
    const dateStr = new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' });
    titleEl.textContent = `Bugünün Gökyüzü — ${dateStr}`;
  }

  body.innerHTML = '<p class="empty-note">Yükleniyor…</p>';
  try {
    const res = await fetch('/api/transit');
    const data = await res.json();
    if (!data.ok) { body.innerHTML = '<p class="empty-note">Yüklenemedi.</p>'; return; }

    const moonPhaseHtml = `
      <div class="chart-card">
        <div class="cc-label">Ay Evresi</div>
        <div class="cc-val">${data.moonPhase.emoji} ${escapeHtml(data.moonPhase.name)}</div>
      </div>`;

    let html =
      signCardHtml('Güneş', data.transit.sun, data.interpretations?.sun?.sun) +
      signCardHtml('Ay', data.transit.moon, data.interpretations?.moon?.moon) +
      moonPhaseHtml;

    if (data.todayNote) {
      html += `
        <div class="chart-card">
          <div class="cc-label">Senin İçin Bugün</div>
          <div class="cc-text">${escapeHtml(data.todayNote)}</div>
        </div>`;
    }

    if (data.planets?.length) {
      html += `<h3 class="chart-section-title" style="grid-column:1/-1; margin-top:14px;">Gökteki Yıldızlar (Gezegenler)</h3>`;
      html += data.planets.map(p => `
        <div class="chart-card">
          <div class="cc-label">${p.symbol} ${escapeHtml(p.name)}${p.retrograde ? ' <span class="retro-badge">Retro ℞</span>' : ''}</div>
          <div class="cc-val">${p.sign.symbol} ${escapeHtml(p.sign.name)}</div>
          <div class="cc-text">Temsil ettiği: ${escapeHtml(p.meaning)}${p.retrograde ? ' — şu an görünürde geri gidiyor, bu alanlarda yavaşlama/gözden geçirme dönemi olabilir.' : '.'}</div>
        </div>`).join('');
    }

    body.innerHTML = html;
  } catch {
    body.innerHTML = '<p class="empty-note">Sunucuya ulaşılamadı.</p>';
  }
}

/* ── Haritalar (Natal / Bugünün Transiti) ── */
async function loadChartView() {
  const natalEl = document.getElementById('natalCards');
  const transitEl = document.getElementById('transitCards');

  try {
    const res = await fetch('/api/chart');
    const data = await res.json();
    if (!data.ok) {
      natalEl.innerHTML = `<p class="empty-note">${escapeHtml(data.error || 'Doğum haritası hesaplanamadı.')}</p>`;
    } else {
      const ascHtml = data.chart.ascendant
        ? signCardHtml('Yükselen', data.chart.ascendant, data.interpretations.ascendant?.asc)
        : `<div class="chart-card"><div class="cc-label">Yükselen</div><p class="empty-note">Doğum saatini Profilim'den eklersen yükselenini de hesaplarız.</p></div>`;
      natalEl.innerHTML =
        signCardHtml('Güneş', data.chart.sun, data.interpretations.sun?.sun) +
        signCardHtml('Ay', data.chart.moon, data.interpretations.moon?.moon) +
        ascHtml;
    }
  } catch {
    natalEl.innerHTML = '<p class="empty-note">Sunucuya ulaşılamadı.</p>';
  }

  try {
    const res = await fetch('/api/transit');
    const data = await res.json();
    if (data.ok) {
      const moonPhaseHtml = `
        <div class="chart-card">
          <div class="cc-label">Ay Evresi</div>
          <div class="cc-val">${data.moonPhase.emoji} ${escapeHtml(data.moonPhase.name)}</div>
        </div>`;
      transitEl.innerHTML =
        signCardHtml('Bugün Güneş', data.transit.sun, data.interpretations?.sun?.sun) +
        signCardHtml('Bugün Ay', data.transit.moon, data.interpretations?.moon?.moon) +
        moonPhaseHtml;
    } else {
      transitEl.innerHTML = '<p class="empty-note">Transit hesaplanamadı.</p>';
    }
  } catch {
    transitEl.innerHTML = '<p class="empty-note">Sunucuya ulaşılamadı.</p>';
  }
}

/* ── Tüm Haritalar — 12 burcun genel özellikleri ── */
function allSignCardHtml(s) {
  return `
    <div class="chart-card">
      <div class="cc-label">${s.element}</div>
      <div class="cc-val">${s.symbol} ${escapeHtml(s.name)}</div>
      <div class="cc-text">
        <strong>Güneş:</strong> ${escapeHtml(s.interpretation.sun)}<br>
        <strong>Ay:</strong> ${escapeHtml(s.interpretation.moon)}<br>
        <strong>Yükselen:</strong> ${escapeHtml(s.interpretation.asc)}
      </div>
    </div>`;
}

async function loadAllChartsView() {
  const body = document.getElementById('allChartsBody');
  body.innerHTML = '<p class="empty-note">Yükleniyor…</p>';

  try {
    const res = await fetch('/api/all-signs');
    const data = await res.json();
    if (!data.ok) { body.innerHTML = '<p class="empty-note">Yüklenemedi.</p>'; return; }
    body.innerHTML = data.signs.map(allSignCardHtml).join('');
  } catch {
    body.innerHTML = '<p class="empty-note">Sunucuya ulaşılamadı.</p>';
  }

  loadChartHistory();
}

function formatHistoryDate(dateStr) {
  const d = new Date(`${dateStr}T12:00:00`);
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' });
}

function chartHistoryCardHtml(day) {
  return `
    <div class="chart-card">
      <div class="cc-label">${escapeHtml(formatHistoryDate(day.date))} · Ay ${day.moon.symbol} ${escapeHtml(day.moon.name)} burcundaydı</div>
      <div class="cc-val">${day.moonPhase.emoji} ${escapeHtml(day.moonPhase.name)}</div>
      <div class="cc-text">${escapeHtml(day.note)}</div>
    </div>`;
}

async function loadChartHistory() {
  const body = document.getElementById('chartHistoryBody');
  if (!body) return;
  body.innerHTML = '<p class="empty-note">Yükleniyor…</p>';

  try {
    const res = await fetch('/api/chart-history');
    const data = await res.json();
    if (!data.ok) { body.innerHTML = `<p class="empty-note">${escapeHtml(data.error || 'Yüklenemedi.')}</p>`; return; }
    body.innerHTML = data.history.map(chartHistoryCardHtml).join('');
  } catch {
    body.innerHTML = '<p class="empty-note">Sunucuya ulaşılamadı.</p>';
  }
}

/* ── Solar Return — kişisel panel ── */
async function loadSolarReturnView() {
  const body = document.getElementById('solarReturnBody');
  body.innerHTML = '<p class="empty-note">Yükleniyor…</p>';

  try {
    const [meRes, srRes] = await Promise.all([fetch('/api/me'), fetch('/api/solar-return')]);
    const me = await meRes.json();
    const sr = await srRes.json();

    if (!sr.ok) {
      body.innerHTML = `<p class="empty-note">${escapeHtml(sr.error || 'Hesaplanamadı.')}</p>`;
      return;
    }

    const sign = me.ok ? me.user.sign : null;
    const note = sign
      ? `${sign} burcu olarak bu dönem, ${(AI_MESSAGES[sign] || '').toLowerCase()}`
      : 'Sana özel bir yorum için Profilim sayfasından doğum tarihini ekle.';

    body.innerHTML = `
      <div class="sr-card">
        <div>
          <div class="sr-label">Bir sonraki doğum gününe (kişisel yeni yılına) kalan</div>
          <div class="sr-days">${sr.solarReturn.days} gün</div>
        </div>
        <div class="sr-date">${sr.solarReturn.date}</div>
      </div>
      <div class="chart-card" style="margin-top:14px;">
        <div class="cc-label">Senin için ne anlama geliyor?</div>
        <div class="cc-text">${escapeHtml(note)}</div>
      </div>`;
  } catch {
    body.innerHTML = '<p class="empty-note">Sunucuya ulaşılamadı.</p>';
  }
}

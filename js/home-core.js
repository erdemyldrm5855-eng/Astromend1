/* ══════════════════════════════════════════════════════════
   home-core.js — Ortak yardımcılar, view (sayfa) geçişleri,
   oturum/kişiselleştirme ve modal altyapısı.
   Diğer tüm home-*.js dosyaları bu dosyaya bağımlıdır, bu yüzden
   home.html'de İLK bu dosya yüklenmelidir.
   ══════════════════════════════════════════════════════════ */

const AI_MESSAGES = {
  'Koç':     'Bugün enerjin ve cesaretin öne çıkıyor. Yeni bir adım atmak için doğru zaman.',
  'Boğa':    'Bugün kararlılığın seni hedefine yaklaştırıyor. Sabırlı kalmak sana avantaj sağlıyor.',
  'İkizler': 'Bugün iletişim gücün zirvede. Merak ettiğin konuları araştırmak sana iyi gelecek.',
  'Yengeç':  'Bugün duygusal derinliğin artıyor. İç dünyana zaman ayırmak ve sezgilerine güvenmek sana iyi gelecek.',
  'Aslan':   'Bugün özgüvenin parlıyor. Liderlik etmen gereken bir an seni bekliyor olabilir.',
  'Başak':   'Bugün detaylara olan dikkatin işine yarıyor. Küçük bir düzenleme büyük fark yaratabilir.',
  'Terazi':  'Bugün denge arayışın öne çıkıyor. İlişkilerinde uyumu gözetmek sana huzur getirecek.',
  'Akrep':   'Bugün içgörün güçlü. Yüzeyin altındakini görmek için doğru gün.',
  'Yay':     'Bugün maceraperest yanın canlanıyor. Ufkunu genişletecek bir fırsat kapıda olabilir.',
  'Oğlak':   'Bugün disiplinin meyvesini veriyor. Uzun vadeli hedeflerine bir adım daha yaklaşıyorsun.',
  'Kova':    'Bugün özgün fikirlerin parlıyor. Farklı düşünmekten çekinme.',
  'Balık':   'Bugün hayal gücün ve sezgilerin güçlü. İçindeki sesi dinlemek sana yol gösterecek.'
};

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'az önce';
  if (mins < 60) return `${mins} dakika önce`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} saat önce`;
  const days = Math.floor(hours / 24);
  return `${days} gün önce`;
}

/* ══ Görünüm (view) geçişleri ══ */
const VIEWS = ['feed', 'today-sky', 'chart', 'all-charts', 'solar-return', 'synastry', 'assistant', 'community', 'profile'];

function showView(name) {
  VIEWS.forEach(v => {
    const el = document.getElementById('view-' + v);
    if (el) el.hidden = v !== name;
  });
  document.querySelectorAll('.nav-link[data-view]').forEach(el => {
    el.classList.toggle('active', el.dataset.view === name);
  });

  // Sağ panel (hikayeler, AI yorumu, günün anketi) sadece Ana Sayfa'da görünür
  const rrail = document.querySelector('.rrail');
  const layout = document.querySelector('.layout');
  if (rrail) rrail.hidden = name !== 'feed';
  if (layout) layout.classList.toggle('no-rrail', name !== 'feed');

  if (name === 'today-sky') loadTodaySkyView();
  if (name === 'chart') loadChartView();
  if (name === 'all-charts') loadAllChartsView();
  if (name === 'solar-return') loadSolarReturnView();
  if (name === 'synastry') loadSynastryView();
  if (name === 'community') {
    const searchEl = document.getElementById('communitySearch');
    if (searchEl) searchEl.value = '';
    loadCommunity();
  }
  if (name === 'profile') {
    loadProfileForm();
    loadProfileStats();
    loadMyPosts();
  }
  if (name === 'assistant' && !document.getElementById('chatLog').children.length) {
    addChatBubble('Merhaba! Burcunla ilgili aşk, kariyer ya da bugünün hakkında soru sorabilirsin. ✦', 'bot');
  }
}

document.querySelectorAll('.nav-link[data-view]').forEach(el => {
  el.addEventListener('click', (e) => {
    e.preventDefault();
    showView(el.dataset.view);
    const scrollTargetId = el.dataset.scrollTo;
    if (scrollTargetId) {
      setTimeout(() => {
        document.getElementById(scrollTargetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);
    }
  });
});

const ACTION_VIEW = {
  natal: 'chart',
  transit: 'chart',
  'all-charts': 'all-charts',
  'solar-return': 'solar-return'
};

document.querySelectorAll('[data-action]').forEach(el => {
  el.addEventListener('click', (e) => {
    e.preventDefault();
    const action = el.dataset.action;
    showView(ACTION_VIEW[action] || 'chart');
  });
});

/* ══ Oturum / kişiselleştirme ══ */
async function refreshHeader() {
  try {
    const res = await fetch('/api/me');
    const data = await res.json();
    if (!res.ok || !data.ok) {
      window.location.href = 'log.html';
      return;
    }

    const { name, sign, signSymbol, avatar } = data.user;
    const greetEl = document.getElementById('greetName');
    if (greetEl) greetEl.textContent = `Merhaba, ${name.split(' ')[0]} 👋`;

    const topbarAvatarEl = document.getElementById('topbarAvatar');
    if (topbarAvatarEl) {
      topbarAvatarEl.innerHTML = avatar
        ? `<img src="${avatar}" alt="Profilim">`
        : `<span>${escapeHtml((name || '?').trim()[0].toUpperCase())}</span>`;
    }

    const todayPill = document.getElementById('todayPill');
    if (todayPill) {
      todayPill.textContent = new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
    }

    if (sign) {
      const subEl = document.getElementById('greetSub');
      if (subEl) subEl.textContent = `Bugün yıldızlar seninle, ${sign}.`;

      const sunValEl = document.getElementById('sunSignVal');
      if (sunValEl) sunValEl.textContent = `${sign} ${signSymbol || ''}`.trim();

      const aiEl = document.getElementById('aiComment');
      if (aiEl && AI_MESSAGES[sign]) aiEl.textContent = AI_MESSAGES[sign];
    }

    try {
      const tRes = await fetch('/api/transit');
      const tData = await tRes.json();
      if (tData.ok) {
        const sunT = document.getElementById('sunTransitVal');
        const moonT = document.getElementById('moonTransitVal');
        if (sunT) sunT.textContent = `${tData.transit.sun.symbol} ${tData.transit.sun.name}`;
        if (moonT) moonT.textContent = `${tData.transit.moon.symbol} ${tData.transit.moon.name}`;
      }
    } catch { /* opsiyonel, sessiz geç */ }
  } catch {
    // Sunucuya ulaşılamıyorsa sayfayı olduğu gibi bırak.
  }
}

document.getElementById('logoutBtn')?.addEventListener('click', async () => {
  await fetch('/api/logout', { method: 'POST' });
  window.location.href = 'log.html';
});

/* ══ Modal altyapısı (Sinastri, Hikaye vb. tüm modallar bunu kullanır) ══ */
function openModal(html) {
  document.getElementById('modalBody').innerHTML = html;
  document.getElementById('modalOverlay').hidden = false;
}
function closeModal() {
  document.getElementById('modalOverlay').hidden = true;
}
document.getElementById('modalClose')?.addEventListener('click', closeModal);
document.getElementById('modalOverlay')?.addEventListener('click', (e) => {
  if (e.target.id === 'modalOverlay') closeModal();
});

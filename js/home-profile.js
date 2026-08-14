/* ══════════════════════════════════════════════════════════
   home-profile.js — Profilim: profil fotoğrafı, başlık/istatistik
   özeti ve düzenleme formu.
   home-core.js'e bağımlıdır (escapeHtml, refreshHeader).
   ══════════════════════════════════════════════════════════ */

let profileAvatarDataUrl = null; // mevcut/yeni seçilen fotoğraf; null = fotoğraf yok

function renderProfileAvatar(name, avatar) {
  const previewEl = document.getElementById('profileAvatarPreview');
  const removeBtn = document.getElementById('removeAvatarBtn');
  if (!previewEl) return;
  const initial = (name || '?').trim()[0]?.toUpperCase() || '?';
  previewEl.innerHTML = avatar ? `<img src="${avatar}" alt="Profil fotoğrafı">` : `<span>${escapeHtml(initial)}</span>`;
  if (removeBtn) removeBtn.hidden = !avatar;
}

async function loadProfileForm() {
  try {
    const res = await fetch('/api/me');
    const data = await res.json();
    if (!data.ok) return;

    document.getElementById('pf-name').value = data.user.name || '';
    document.getElementById('pf-birthDate').value = data.user.birthDate || '';
    document.getElementById('pf-birthTime').value = data.user.birthTime || '';
    document.getElementById('pf-birthPlace').value = data.user.birthPlace || '';
    document.getElementById('pf-bio').value = data.user.bio || '';

    profileAvatarDataUrl = data.user.avatar || null;
    renderProfileAvatar(data.user.name, profileAvatarDataUrl);

    const nameEl = document.getElementById('profileHeaderName');
    if (nameEl) nameEl.textContent = data.user.name || '—';

    const signEl = document.getElementById('profileHeaderSign');
    if (signEl) signEl.textContent = data.user.sign ? `${data.user.signSymbol || ''} ${data.user.sign}`.trim() : 'Burç bilgisi yok';

    const sinceEl = document.getElementById('profileHeaderSince');
    if (sinceEl && data.user.createdAt) {
      const d = new Date(data.user.createdAt);
      sinceEl.textContent = `${d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })} tarihinden beri üye`;
    }
  } catch { /* sessiz geç */ }
}

async function loadProfileStats() {
  const postCountEl = document.getElementById('statPostCount');
  const likeCountEl = document.getElementById('statLikeCount');
  if (!postCountEl || !likeCountEl) return;
  try {
    const res = await fetch('/api/posts?mine=1');
    const data = await res.json();
    if (!data.ok) return;
    postCountEl.textContent = data.posts.length;
    likeCountEl.textContent = data.posts.reduce((sum, p) => sum + (p.likeCount || 0), 0);
  } catch { /* sessiz geç */ }
}

document.getElementById('profileAvatarInput')?.addEventListener('change', function () {
  const file = this.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    alert('Lütfen bir resim dosyası seç.');
    this.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = () => openAvatarEditor(reader.result);
  reader.readAsDataURL(file);
  this.value = ''; // ayni dosyayi tekrar secebilmek icin sifirla
});

/* ══ Fotoğraf düzenleyici (kırp + yakınlaştır) ══ */
function openAvatarEditor(dataUrl) {
  openModal(`
    <h3>✦ Fotoğrafı Düzenle</h3>
    <p class="field-hint">Sürükleyerek konumlandır, kaydırıcıyla yakınlaştır.</p>
    <div class="avatar-editor-stage" id="avatarEditorStage">
      <img id="avatarEditorImg" src="${dataUrl}" draggable="false" alt="">
    </div>
    <input type="range" id="avatarEditorZoom" class="avatar-editor-zoom" min="1" max="3" step="0.01" value="1">
    <button class="submit-btn" id="avatarEditorSave">Fotoğrafı Kaydet</button>
    <div id="avatarEditorMsg" class="profile-msg"></div>
  `);

  const stage = document.getElementById('avatarEditorStage');
  const imgEl = document.getElementById('avatarEditorImg');
  const zoomSlider = document.getElementById('avatarEditorZoom');
  const stageSize = 260;

  let natW, natH, baseScale, totalScale, posX, posY;
  let dragging = false, dragStartX, dragStartY, startX, startY;

  function applyTransform() {
    imgEl.style.width = `${natW * totalScale}px`;
    imgEl.style.height = `${natH * totalScale}px`;
    imgEl.style.left = `${posX}px`;
    imgEl.style.top = `${posY}px`;
  }

  function clampPosition() {
    const W = natW * totalScale, H = natH * totalScale;
    posX = Math.min(0, Math.max(stageSize - W, posX));
    posY = Math.min(0, Math.max(stageSize - H, posY));
  }

  function init() {
    natW = imgEl.naturalWidth;
    natH = imgEl.naturalHeight;
    baseScale = Math.max(stageSize / natW, stageSize / natH);
    totalScale = baseScale;
    posX = (stageSize - natW * totalScale) / 2;
    posY = (stageSize - natH * totalScale) / 2;
    applyTransform();
  }

  if (imgEl.complete && imgEl.naturalWidth) init();
  else imgEl.addEventListener('load', init, { once: true });

  zoomSlider.addEventListener('input', () => {
    const cx = posX + (natW * totalScale) / 2;
    const cy = posY + (natH * totalScale) / 2;
    totalScale = baseScale * parseFloat(zoomSlider.value);
    posX = cx - (natW * totalScale) / 2;
    posY = cy - (natH * totalScale) / 2;
    clampPosition();
    applyTransform();
  });

  stage.addEventListener('pointerdown', (e) => {
    dragging = true;
    dragStartX = e.clientX; dragStartY = e.clientY;
    startX = posX; startY = posY;
    stage.setPointerCapture(e.pointerId);
  });
  stage.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    posX = startX + (e.clientX - dragStartX);
    posY = startY + (e.clientY - dragStartY);
    clampPosition();
    applyTransform();
  });
  stage.addEventListener('pointerup', () => { dragging = false; });
  stage.addEventListener('pointercancel', () => { dragging = false; });

  document.getElementById('avatarEditorSave').addEventListener('click', async function () {
    const saveBtn = this;
    const msgEl = document.getElementById('avatarEditorMsg');
    msgEl.textContent = '';
    msgEl.classList.remove('error');

    const outputSize = 400;
    const canvas = document.createElement('canvas');
    canvas.width = outputSize;
    canvas.height = outputSize;
    const ctx = canvas.getContext('2d');
    const sx = (0 - posX) / totalScale;
    const sy = (0 - posY) / totalScale;
    const sSize = stageSize / totalScale;
    ctx.drawImage(imgEl, sx, sy, sSize, sSize, 0, 0, outputSize, outputSize);

    const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.85);

    saveBtn.disabled = true;
    msgEl.textContent = 'Kaydediliyor…';
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar: croppedDataUrl })
      });
      const data = await res.json();
      if (!data.ok) {
        msgEl.textContent = data.error || 'Kaydedilemedi.';
        msgEl.classList.add('error');
        saveBtn.disabled = false;
        return;
      }
      // Sunucuya gerçekten kaydedildi — şimdi önizlemeyi/üst bar avatarını güncelle ve modalı kapat.
      profileAvatarDataUrl = croppedDataUrl;
      renderProfileAvatar(document.getElementById('pf-name').value, profileAvatarDataUrl);
      refreshHeader();
      closeModal();
    } catch {
      msgEl.textContent = 'Sunucuya ulaşılamadı.';
      msgEl.classList.add('error');
      saveBtn.disabled = false;
    }
  });
}

document.getElementById('removeAvatarBtn')?.addEventListener('click', () => {
  profileAvatarDataUrl = null;
  document.getElementById('profileAvatarInput').value = '';
  renderProfileAvatar(document.getElementById('pf-name').value, null);
});

document.getElementById('profileForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const msgEl = document.getElementById('profileMsg');
  msgEl.textContent = '';
  msgEl.classList.remove('error');

  const body = {
    name: document.getElementById('pf-name').value.trim(),
    birthDate: document.getElementById('pf-birthDate').value,
    birthTime: document.getElementById('pf-birthTime').value,
    birthPlace: document.getElementById('pf-birthPlace').value.trim(),
    bio: document.getElementById('pf-bio').value.trim(),
    avatar: profileAvatarDataUrl
  };

  try {
    const res = await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!data.ok) {
      msgEl.textContent = data.error || 'Kaydedilemedi.';
      msgEl.classList.add('error');
      return;
    }
    msgEl.textContent = 'Kaydedildi ✦';
    refreshHeader();
    loadProfileForm();
  } catch {
    msgEl.textContent = 'Sunucuya ulaşılamadı.';
    msgEl.classList.add('error');
  }
});

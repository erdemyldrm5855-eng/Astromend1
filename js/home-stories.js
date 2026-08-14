/* ══════════════════════════════════════════════════════════
   home-stories.js — Hikayeler (Instagram benzeri, 24 saatlik).
   home-core.js'e bağımlıdır (escapeHtml, timeAgo, openModal, closeModal).
   ══════════════════════════════════════════════════════════ */

async function loadStories() {
  const el = document.getElementById('storiesContainer');
  if (!el) return;
  try {
    const res = await fetch('/api/stories');
    const data = await res.json();
    if (!data.ok) { el.innerHTML = ''; return; }

    let html = `<div class="story" id="storyCompose"><div class="ring"><div class="plus">+</div></div><p>Paylaş</p></div>`;
    html += data.stories.map(s => `
      <div class="story" data-story-id="${s.id}">
        <div class="ring">${s.image
          ? `<img src="${s.image}" class="story-photo">`
          : s.authorAvatar
            ? `<img src="${s.authorAvatar}" class="story-photo">`
            : `<div class="story-avatar">${escapeHtml((s.authorName || '?')[0].toUpperCase())}</div>`}</div>
        <p>${escapeHtml(s.isMine ? 'Sen' : s.authorName.split(' ')[0])}</p>
      </div>`).join('');
    el.innerHTML = html;

    document.getElementById('storyCompose')?.addEventListener('click', openStoryComposeModal);
    el.querySelectorAll('[data-story-id]').forEach(node => {
      node.addEventListener('click', () => {
        const story = data.stories.find(s => s.id === node.dataset.storyId);
        if (story) openStoryViewModal(story);
      });
    });
  } catch {
    el.innerHTML = '';
  }
}

function openStoryComposeModal() {
  openModal(`
    <h3>✦ Hikaye Paylaş</h3>
    <label>Fotoğraf <span class="field-hint">(opsiyonel, maks. ~3MB)</span>
      <input type="file" id="storyImageInput" accept="image/png,image/jpeg,image/gif,image/webp">
    </label>
    <div id="storyImagePreview"></div>
    <label>Not <span class="field-hint">(opsiyonel)</span>
      <textarea id="storyText" maxlength="200" rows="3" placeholder="Bugün gökyüzü..."></textarea>
    </label>
    <button class="submit-btn" id="storySubmit">Paylaş</button>
    <div id="storyModalMsg"></div>
  `);

  let imageDataUrl = null;
  const fileInput = document.getElementById('storyImageInput');
  const preview = document.getElementById('storyImagePreview');
  const msgEl = document.getElementById('storyModalMsg');

  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    preview.innerHTML = '';
    imageDataUrl = null;
    msgEl.innerHTML = '';
    if (!file) return;
    if (file.size > 3.5 * 1024 * 1024) {
      msgEl.innerHTML = '<p class="modal-error">Fotoğraf çok büyük, en fazla ~3MB olmalı.</p>';
      fileInput.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      imageDataUrl = reader.result;
      preview.innerHTML = `<img src="${imageDataUrl}" class="story-preview-img">`;
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('storySubmit').addEventListener('click', async () => {
    const text = document.getElementById('storyText').value.trim();
    msgEl.innerHTML = '';
    if (!text && !imageDataUrl) { msgEl.innerHTML = '<p class="modal-error">Metin ya da fotoğraf eklemelisin.</p>'; return; }

    try {
      const res = await fetch('/api/stories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, image: imageDataUrl })
      });
      const data = await res.json();
      if (!data.ok) { msgEl.innerHTML = `<p class="modal-error">${escapeHtml(data.error || 'Paylaşılamadı.')}</p>`; return; }
      closeModal();
      loadStories();
    } catch {
      msgEl.innerHTML = '<p class="modal-error">Sunucuya ulaşılamadı.</p>';
    }
  });
}

function openStoryViewModal(story) {
  openModal(`
    <h3>${story.authorSignSymbol || '✦'} ${escapeHtml(story.authorName)}${story.authorSign ? ` · ${escapeHtml(story.authorSign)}` : ''}</h3>
    ${story.image ? `<img src="${story.image}" class="story-view-img">` : ''}
    ${story.text ? `<p class="story-view-text">${escapeHtml(story.text)}</p>` : ''}
    <p class="story-view-time">${timeAgo(story.createdAt)}</p>
    ${story.isMine ? `<button class="submit-btn" id="storyDeleteBtn" style="background:#C0392B;">Sil</button>` : ''}
  `);

  document.getElementById('storyDeleteBtn')?.addEventListener('click', async () => {
    if (!confirm('Hikayeni silmek istediğine emin misin?')) return;
    try {
      await fetch(`/api/stories/${story.id}`, { method: 'DELETE' });
      closeModal();
      loadStories();
    } catch { /* sessiz geç */ }
  });
}

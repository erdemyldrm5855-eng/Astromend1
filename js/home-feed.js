/* ══════════════════════════════════════════════════════════
   home-feed.js — Akış: gönderi paylaşma (metin+fotoğraf),
   beğeni, yorum/yanıt, gönderi listeleme (Ana Sayfa + Profilim).
   home-core.js'e bağımlıdır (escapeHtml, timeAgo).
   ══════════════════════════════════════════════════════════ */

function renderPost(p) {
  const initial = p.authorName ? p.authorName.trim()[0].toUpperCase() : '?';
  const avatarHtml = p.authorAvatar
    ? `<img src="${p.authorAvatar}" alt="${escapeHtml(p.authorName)}">`
    : escapeHtml(initial);
  const signBadge = p.authorSign ? `<span class="post-sign">${p.authorSignSymbol || ''} ${escapeHtml(p.authorSign)}</span>` : '';
  const deleteBtn = p.isMine ? `<span class="post-delete" data-delete-id="${p.id}" title="Sil">✕</span>` : '';
  return `
    <article class="post">
      <div class="post-head">
        <div class="post-avatar-fallback">${avatarHtml}</div>
        <div>
          <div class="post-name">${escapeHtml(p.authorName)} ${signBadge}</div>
          <div class="post-time">${timeAgo(p.createdAt)}</div>
        </div>
        ${deleteBtn}
      </div>
      ${p.text ? `<p class="post-text">${escapeHtml(p.text)}</p>` : ''}
      ${p.image ? `<img src="${p.image}" class="post-image">` : ''}
      <div class="post-foot">
        <span data-like-id="${p.id}" class="${p.likedByMe ? 'liked' : ''}">${p.likedByMe ? '♥' : '♡'} ${p.likeCount}</span>
        <span data-comment-toggle="${p.id}">💬 <span class="comment-count">${p.commentCount || 0}</span></span>
      </div>
      <div class="comments-section" id="comments-${p.id}">
        <div class="comments-list" id="commentsList-${p.id}"></div>
        <form class="comment-form" data-comment-form="${p.id}">
          <input type="text" placeholder="Yanıt yaz..." maxlength="300">
          <button type="submit">Gönder</button>
        </form>
      </div>
    </article>`;
}

function wirePostInteractions(container) {
  container.querySelectorAll('[data-like-id]').forEach(el => {
    el.addEventListener('click', () => toggleLike(el.dataset.likeId));
  });
  container.querySelectorAll('[data-delete-id]').forEach(el => {
    el.addEventListener('click', () => deletePost(el.dataset.deleteId));
  });
  container.querySelectorAll('[data-comment-toggle]').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.dataset.commentToggle;
      const section = document.getElementById(`comments-${id}`);
      if (!section) return;
      const isOpening = !section.classList.contains('open');
      section.classList.toggle('open', isOpening);
      if (isOpening) loadComments(id);
    });
  });
  container.querySelectorAll('[data-comment-form]').forEach(form => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = form.dataset.commentForm;
      const input = form.querySelector('input');
      const text = input.value.trim();
      if (!text) return;
      try {
        const res = await fetch(`/api/posts/${id}/comments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text })
        });
        const data = await res.json();
        if (!data.ok) { alert(data.error || 'Yanıt gönderilemedi.'); return; }
        input.value = '';
        loadComments(id);
        document.querySelectorAll(`[data-comment-toggle="${id}"] .comment-count`).forEach(el => {
          el.textContent = String((parseInt(el.textContent, 10) || 0) + 1);
        });
      } catch {
        alert('Sunucuya ulaşılamadı.');
      }
    });
  });
}

async function loadComments(postId) {
  const listEl = document.getElementById(`commentsList-${postId}`);
  if (!listEl) return;
  listEl.innerHTML = '<p class="empty-note">Yükleniyor…</p>';
  try {
    const res = await fetch(`/api/posts/${postId}/comments`);
    const data = await res.json();
    if (!data.ok) { listEl.innerHTML = '<p class="empty-note">Yüklenemedi.</p>'; return; }
    if (!data.comments.length) { listEl.innerHTML = '<p class="empty-note">Henüz yanıt yok. İlk yanıtı sen yaz.</p>'; return; }
    listEl.innerHTML = data.comments.map(c => `
      <div class="comment-item">
        <div class="comment-avatar">${c.authorAvatar ? `<img src="${c.authorAvatar}" alt="${escapeHtml(c.authorName)}">` : escapeHtml((c.authorName || '?')[0].toUpperCase())}</div>
        <div>
          <div class="comment-name">${escapeHtml(c.authorName)} ${c.authorSign ? `<span class="post-sign">${c.authorSignSymbol || ''} ${escapeHtml(c.authorSign)}</span>` : ''}</div>
          <div class="comment-text">${escapeHtml(c.text)}</div>
          <div class="comment-time">${timeAgo(c.createdAt)}</div>
        </div>
      </div>`).join('');
  } catch {
    listEl.innerHTML = '<p class="empty-note">Sunucuya ulaşılamadı.</p>';
  }
}

async function loadPosts() {
  const container = document.getElementById('postsContainer');
  if (!container) return;
  container.innerHTML = '<p class="empty-note">Yükleniyor…</p>';
  try {
    const res = await fetch('/api/posts');
    const data = await res.json();
    if (!data.ok) { container.innerHTML = '<p class="empty-note">Gönderiler yüklenemedi.</p>'; return; }
    if (!data.posts.length) { container.innerHTML = '<p class="empty-note">Henüz gönderi yok. İlk paylaşımı sen yap!</p>'; return; }

    container.innerHTML = data.posts.map(renderPost).join('');
    wirePostInteractions(container);
  } catch {
    container.innerHTML = '<p class="empty-note">Sunucuya ulaşılamadı.</p>';
  }
}

async function loadMyPosts() {
  const container = document.getElementById('myPostsContainer');
  if (!container) return;
  container.innerHTML = '<p class="empty-note">Yükleniyor…</p>';
  try {
    const res = await fetch('/api/posts?mine=1');
    const data = await res.json();
    if (!data.ok) { container.innerHTML = '<p class="empty-note">Yüklenemedi.</p>'; return; }
    if (!data.posts.length) { container.innerHTML = '<p class="empty-note">Henüz gönderin yok.</p>'; return; }

    container.innerHTML = data.posts.map(renderPost).join('');
    wirePostInteractions(container);
  } catch {
    container.innerHTML = '<p class="empty-note">Sunucuya ulaşılamadı.</p>';
  }
}

async function toggleLike(id) {
  try {
    const res = await fetch(`/api/posts/${id}/like`, { method: 'POST' });
    if (!res.ok) return;
    const data = await res.json();
    if (!data.ok) return;
    // Sadece bu gönderinin beğeni durumunu güncelle — liste yeniden yüklenmez,
    // sayfa "yenileniyor" hissi vermez, açık yorum bölümleri kapanmaz.
    document.querySelectorAll(`[data-like-id="${id}"]`).forEach(el => {
      el.classList.toggle('liked', data.likedByMe);
      el.textContent = `${data.likedByMe ? '♥' : '♡'} ${data.likeCount}`;
      if (data.likedByMe) {
        el.classList.remove('like-pop');
        void el.offsetWidth; // reflow — animasyonun her tıklamada yeniden oynaması için
        el.classList.add('like-pop');
      }
    });
  } catch { /* sessiz geç */ }
}

async function deletePost(id) {
  if (!confirm('Bu gönderiyi silmek istediğine emin misin?')) return;
  try {
    const res = await fetch(`/api/posts/${id}`, { method: 'DELETE' });
    if (!res.ok) return;
    // Listeyi yeniden yüklemek yerine sadece silinen gönderiyi DOM'dan kaldır.
    document.querySelectorAll(`[data-delete-id="${id}"]`).forEach(btn => {
      btn.closest('article.post')?.remove();
    });
  } catch { /* sessiz geç */ }
}

/* ══ Gönderi oluşturma kutusu (Paylaş) ══ */
const composeText = document.getElementById('composeText');
const composeCount = document.getElementById('composeCount');
const composeBtn = document.getElementById('composeBtn');
const composeImageInput = document.getElementById('composeImageInput');
const composeImagePreview = document.getElementById('composeImagePreview');
let composeImageDataUrl = null;

composeText?.addEventListener('input', () => {
  composeCount.textContent = `${composeText.value.length}/500`;
});

composeImageInput?.addEventListener('change', () => {
  const file = composeImageInput.files[0];
  if (!file) return;
  if (file.size > 3.5 * 1024 * 1024) {
    alert('Fotoğraf çok büyük, en fazla ~3MB olmalı.');
    composeImageInput.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    composeImageDataUrl = reader.result;
    composeImagePreview.innerHTML = `
      <img src="${composeImageDataUrl}">
      <button type="button" class="remove-image-btn" id="removeComposeImage">✕</button>`;
    document.getElementById('removeComposeImage').addEventListener('click', () => {
      composeImageDataUrl = null;
      composeImageInput.value = '';
      composeImagePreview.innerHTML = '';
    });
  };
  reader.readAsDataURL(file);
});

composeBtn?.addEventListener('click', async () => {
  const text = composeText.value.trim();
  if (!text && !composeImageDataUrl) return;
  composeBtn.disabled = true;
  try {
    const res = await fetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, image: composeImageDataUrl })
    });
    const data = await res.json();
    if (!data.ok) { alert(data.error || 'Gönderi paylaşılamadı.'); return; }
    composeText.value = '';
    composeCount.textContent = '0/500';
    composeImageDataUrl = null;
    composeImageInput.value = '';
    composeImagePreview.innerHTML = '';
    loadPosts();
  } finally {
    composeBtn.disabled = false;
  }
});

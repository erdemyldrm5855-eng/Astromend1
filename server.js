require('dotenv').config();
const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const astro = require('./lib/astro');
const db = require('./lib/db');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'astromend-dev-secret-change-me';
const STORY_LIFETIME_MS = 24 * 60 * 60 * 1000;

// ── Satır → JS nesnesi dönüştürücüler (snake_case → camelCase) ──
function rowToUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.password_hash,
    birthDate: row.birth_date,
    birthTime: row.birth_time,
    birthPlace: row.birth_place,
    bio: row.bio,
    avatar: row.avatar,
    createdAt: row.created_at
  };
}
function rowToPost(row) {
  return {
    id: row.id,
    authorId: row.author_id,
    authorName: row.author_name,
    authorAvatar: row.author_avatar,
    authorSign: row.author_sign,
    authorSignSymbol: row.author_sign_symbol,
    text: row.text,
    image: row.image,
    createdAt: row.created_at
  };
}
function rowToComment(row) {
  return {
    id: row.id,
    postId: row.post_id,
    authorId: row.author_id,
    authorName: row.author_name,
    authorAvatar: row.author_avatar,
    authorSign: row.author_sign,
    authorSignSymbol: row.author_sign_symbol,
    text: row.text,
    createdAt: row.created_at
  };
}
function rowToStory(row) {
  return {
    id: row.id,
    authorId: row.author_id,
    authorName: row.author_name,
    authorAvatar: row.author_avatar,
    authorSign: row.author_sign,
    authorSignSymbol: row.author_sign_symbol,
    text: row.text,
    image: row.image,
    createdAt: row.created_at
  };
}

async function getFullUser(id) {
  const { rows } = await db.query('SELECT * FROM users WHERE id = $1', [id]);
  return rows[0] ? rowToUser(rows[0]) : null;
}
function userSign(user) {
  return user && user.birthDate ? astro.getZodiacSignFromDate(user.birthDate) : null;
}
function excerpt(text, n = 50) {
  if (!text) return '';
  return text.length > n ? text.slice(0, n).trim() + '…' : text;
}
async function createNotification({ userId, type, fromUserId, fromUserName, postId, postExcerpt, commentText }) {
  if (!userId || userId === fromUserId) return; // kendine bildirim yok
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  await db.query(
    `INSERT INTO notifications (id, user_id, type, from_user_id, from_user_name, post_id, post_excerpt, comment_text, read)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,false)`,
    [id, userId, type, fromUserId, fromUserName, postId || null, postExcerpt || null, commentText || null]
  );
}
async function ensureTodayPoll() {
  const key = new Date().toISOString().slice(0, 10);
  const { rows } = await db.query('SELECT * FROM daily_polls WHERE poll_date = $1', [key]);
  if (rows.length) return rows[0];

  const content = astro.getDailyPollContent(new Date());
  const { rows: inserted } = await db.query(
    `INSERT INTO daily_polls (poll_date, question, options) VALUES ($1,$2,$3)
     ON CONFLICT (poll_date) DO UPDATE SET poll_date = EXCLUDED.poll_date
     RETURNING *`,
    [key, content.question, JSON.stringify(content.options)]
  );
  return inserted[0];
}

app.use(express.json({ limit: '6mb' }));
app.use(cookieParser());

function isValidImageDataUrl(str) {
  return typeof str === 'string'
    && /^data:image\/(png|jpe?g|gif|webp);base64,/.test(str)
    && str.length < 5_000_000; // ~3.5MB ham dosya
}

// ── Oturum kontrolü (JWT httpOnly cookie) ──
app.use((req, res, next) => {
  const token = req.cookies.token;
  req.user = null;
  if (token) {
    try {
      req.user = jwt.verify(token, JWT_SECRET);
    } catch {
      req.user = null;
    }
  }
  next();
});

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ ok: false, error: 'Giriş yapmalısın.' });
  next();
}

function issueSession(res, user) {
  const token = jwt.sign(
    { id: user.id, name: user.name, email: user.email },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
  res.cookie('token', token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
}

// ── Kimlik doğrulama ──
app.post('/api/register', async (req, res) => {
  const { name, email, password, birthDate } = req.body || {};

  if (!name || !email || !password || !birthDate) {
    return res.status(400).json({ ok: false, error: 'Ad, e-posta, şifre ve doğum tarihi zorunlu.' });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ ok: false, error: 'Şifre en az 6 karakter olmalı.' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const { rows: existing } = await db.query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
  if (existing.length) {
    return res.status(409).json({ ok: false, error: 'Bu e-posta ile zaten bir hesap var.' });
  }

  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const trimmedName = String(name).trim();
  const passwordHash = bcrypt.hashSync(password, 10);

  await db.query(
    `INSERT INTO users (id, name, email, password_hash, birth_date) VALUES ($1,$2,$3,$4,$5)`,
    [id, trimmedName, normalizedEmail, passwordHash, birthDate]
  );

  issueSession(res, { id, name: trimmedName, email: normalizedEmail });
  res.json({ ok: true, user: { name: trimmedName, email: normalizedEmail } });
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ ok: false, error: 'E-posta ve şifre gerekli.' });
  }

  const { rows } = await db.query('SELECT * FROM users WHERE email = $1', [String(email).trim().toLowerCase()]);
  const row = rows[0];
  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    return res.status(401).json({ ok: false, error: 'E-posta veya şifre hatalı.' });
  }

  issueSession(res, { id: row.id, name: row.name, email: row.email });
  res.json({ ok: true, user: { name: row.name, email: row.email } });
});

app.post('/api/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

app.get('/api/me', async (req, res) => {
  if (!req.user) return res.status(401).json({ ok: false });
  const user = await getFullUser(req.user.id);
  if (!user) return res.status(401).json({ ok: false });

  const sign = userSign(user);
  res.json({
    ok: true,
    user: {
      name: user.name,
      email: user.email,
      birthDate: user.birthDate,
      birthTime: user.birthTime || null,
      birthPlace: user.birthPlace || null,
      bio: user.bio || null,
      avatar: user.avatar || null,
      createdAt: user.createdAt,
      sign: sign ? sign.name : null,
      signSymbol: sign ? sign.symbol : null
    }
  });
});

// ── Profil ──
app.put('/api/profile', requireAuth, async (req, res) => {
  const { name, birthDate, birthTime, birthPlace, bio, avatar } = req.body || {};

  if (avatar !== undefined && avatar && !isValidImageDataUrl(avatar)) {
    return res.status(400).json({ ok: false, error: 'Geçersiz ya da çok büyük bir profil fotoğrafı (maks. ~3MB, png/jpg/gif/webp).' });
  }

  const sets = [];
  const values = [];
  let i = 1;

  if (name && String(name).trim()) { sets.push(`name = $${i++}`); values.push(String(name).trim()); }
  if (birthDate) { sets.push(`birth_date = $${i++}`); values.push(birthDate); }
  if (birthTime !== undefined) {
    sets.push(`birth_time = $${i++}`);
    values.push(birthTime && /^\d{2}:\d{2}$/.test(birthTime) ? birthTime : null);
  }
  if (birthPlace !== undefined) {
    sets.push(`birth_place = $${i++}`);
    values.push(birthPlace ? String(birthPlace).trim().slice(0, 80) : null);
  }
  if (bio !== undefined) {
    sets.push(`bio = $${i++}`);
    values.push(bio ? String(bio).trim().slice(0, 280) : null);
  }
  if (avatar !== undefined) {
    sets.push(`avatar = $${i++}`);
    values.push(avatar || null);
  }

  if (!sets.length) return res.json({ ok: true });

  values.push(req.user.id);
  await db.query(`UPDATE users SET ${sets.join(', ')} WHERE id = $${i}`, values);
  res.json({ ok: true });
});

// ── Doğum haritası (natal) ──
app.get('/api/chart', requireAuth, async (req, res) => {
  const user = await getFullUser(req.user.id);
  if (!user || !user.birthDate) {
    return res.status(400).json({ ok: false, error: 'Doğum tarihin eksik. Önce Profilim sayfasından ekle.' });
  }
  const chart = astro.getNatalChart(user.birthDate, user.birthTime);
  res.json({
    ok: true,
    chart,
    interpretations: {
      sun: astro.SIGN_INTERPRETATIONS[chart.sun.name],
      moon: astro.SIGN_INTERPRETATIONS[chart.moon.name],
      ascendant: chart.ascendant ? astro.SIGN_INTERPRETATIONS[chart.ascendant.name] : null
    }
  });
});

// ── Transit (bugünün gökyüzü) ──
app.get('/api/transit', requireAuth, async (req, res) => {
  const user = await getFullUser(req.user.id);
  const natal = user && user.birthDate ? astro.getNatalChart(user.birthDate, user.birthTime) : null;
  const transit = astro.getTransit();
  const moonPhase = astro.getMoonPhase();
  res.json({
    ok: true,
    transit,
    moonPhase,
    planets: astro.getPlanetPositions(),
    natal,
    todayNote: natal ? astro.describeDayMood(transit.moon.name, natal.sun.name) : null,
    interpretations: {
      sun: astro.SIGN_INTERPRETATIONS[transit.sun.name],
      moon: astro.SIGN_INTERPRETATIONS[transit.moon.name]
    }
  });
});

// ── Sinastri (ilişki uyumu) ──
app.post('/api/synastry', requireAuth, async (req, res) => {
  const { partnerBirthDate, partnerId } = req.body || {};
  const user = await getFullUser(req.user.id);
  if (!user || !user.birthDate) {
    return res.status(400).json({ ok: false, error: 'Önce kendi doğum tarihini Profilim sayfasından ekle.' });
  }

  let partnerDate = partnerBirthDate;
  let partnerName = 'Partnerin';
  if (partnerId) {
    const partner = await getFullUser(partnerId);
    if (!partner) return res.status(404).json({ ok: false, error: 'Kullanıcı bulunamadı.' });
    if (!partner.birthDate) return res.status(400).json({ ok: false, error: 'Bu kullanıcı henüz doğum tarihini eklememiş.' });
    partnerDate = partner.birthDate;
    partnerName = partner.name;
  }
  if (!partnerDate) {
    return res.status(400).json({ ok: false, error: 'Partnerin kullanıcı adını seç ya da doğum tarihini gir.' });
  }

  const mySign = astro.getZodiacSignFromDate(user.birthDate);
  const theirSign = astro.getZodiacSignFromDate(partnerDate);
  const result = astro.synastry(mySign.name, theirSign.name);

  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  await db.query(
    `INSERT INTO synastry_history (id, user_id, partner_name, sign1, sign2, score, result_text)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [id, req.user.id, partnerName, result.sign1, result.sign2, result.score, result.text]
  );

  res.json({ ok: true, partnerName, result });
});

// ── Sinastri Geçmişi ──
app.get('/api/synastry-history', requireAuth, async (req, res) => {
  const { rows } = await db.query(
    `SELECT * FROM synastry_history WHERE user_id = $1 ORDER BY created_at DESC`,
    [req.user.id]
  );
  res.json({
    ok: true,
    history: rows.map(r => ({
      id: r.id,
      partnerName: r.partner_name,
      sign1: r.sign1,
      sign2: r.sign2,
      score: r.score,
      text: r.result_text,
      createdAt: r.created_at
    }))
  });
});

app.delete('/api/synastry-history/:id', requireAuth, async (req, res) => {
  const { rowCount } = await db.query(
    `DELETE FROM synastry_history WHERE id = $1 AND user_id = $2`,
    [req.params.id, req.user.id]
  );
  if (!rowCount) return res.status(404).json({ ok: false });
  res.json({ ok: true });
});

// ── Tüm Haritalar (12 burcun genel özellikleri) ──
app.get('/api/all-signs', requireAuth, (req, res) => {
  const signs = astro.SIGNS.map(s => ({
    ...s,
    interpretation: astro.SIGN_INTERPRETATIONS[s.name]
  }));
  res.json({ ok: true, signs });
});

// ── Geçmiş Haritalarım (son 7 günün transiti, kendi burcuna göre yorumlanmış) ──
app.get('/api/chart-history', requireAuth, async (req, res) => {
  const user = await getFullUser(req.user.id);
  if (!user || !user.birthDate) {
    return res.status(400).json({ ok: false, error: 'Doğum tarihin eksik. Önce Profilim sayfasından ekle.' });
  }
  const mySign = astro.getZodiacSignFromDate(user.birthDate);

  const history = astro.getTransitHistory(7).map(day => ({
    date: day.date,
    sun: day.sun,
    moon: day.moon,
    moonPhase: day.moonPhase,
    note: astro.describeDayMood(day.moon.name, mySign.name)
  }));

  res.json({ ok: true, mySign, history });
});

// ── Solar Return ──
app.get('/api/solar-return', requireAuth, async (req, res) => {
  const user = await getFullUser(req.user.id);
  if (!user || !user.birthDate) {
    return res.status(400).json({ ok: false, error: 'Doğum tarihin eksik. Önce Profilim sayfasından ekle.' });
  }
  res.json({ ok: true, solarReturn: astro.daysUntilNextBirthday(user.birthDate) });
});

// ── Topluluk (isim/burca göre aranabilir) ──
app.get('/api/community', requireAuth, async (req, res) => {
  const q = (req.query.q || '').toString().trim().toLocaleLowerCase('tr');
  const { rows } = await db.query(
    `SELECT id, name, bio, avatar, birth_date FROM users WHERE birth_date IS NOT NULL`
  );
  const users = rows
    .map(u => {
      const sign = astro.getZodiacSignFromDate(u.birth_date);
      return { id: u.id, name: u.name, bio: u.bio || null, avatar: u.avatar || null, sign: sign ? sign.name : null, signSymbol: sign ? sign.symbol : null };
    })
    .filter(u => {
      if (!q) return true;
      const name = u.name.toLocaleLowerCase('tr');
      const sign = (u.sign || '').toLocaleLowerCase('tr');
      return name.includes(q) || sign.includes(q);
    });
  res.json({ ok: true, users });
});

// ── AI Asistan (kural tabanlı; gerçek zamanlı bir LLM değil) ──
app.post('/api/ai-assistant', requireAuth, async (req, res) => {
  const { message } = req.body || {};
  const user = await getFullUser(req.user.id);
  const sign = userSign(user);
  const reply = astro.answerAssistant(message, sign ? sign.name : null, user ? user.name : null);
  res.json({ ok: true, reply });
});

// ── Hikayeler (Instagram benzeri, 24 saat görünür) ──
app.get('/api/stories', requireAuth, async (req, res) => {
  const cutoffIso = new Date(Date.now() - STORY_LIFETIME_MS).toISOString();
  const { rows } = await db.query(
    `SELECT DISTINCT ON (author_id) *
     FROM stories
     WHERE created_at >= $1
     ORDER BY author_id, created_at DESC`,
    [cutoffIso]
  );
  const stories = rows
    .map(rowToStory)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(s => ({ ...s, isMine: s.authorId === req.user.id }));

  res.json({ ok: true, stories });
});

app.post('/api/stories', requireAuth, async (req, res) => {
  const { text, image } = req.body || {};
  const trimmedText = text ? String(text).trim().slice(0, 200) : '';
  const hasImage = !!image;

  if (hasImage && !isValidImageDataUrl(image)) {
    return res.status(400).json({ ok: false, error: 'Geçersiz ya da çok büyük bir fotoğraf (maks. ~3MB, png/jpg/gif/webp).' });
  }
  if (!trimmedText && !hasImage) {
    return res.status(400).json({ ok: false, error: 'Hikaye boş olamaz — metin ya da fotoğraf ekle.' });
  }

  const user = await getFullUser(req.user.id);
  const sign = userSign(user);
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  const { rows } = await db.query(
    `INSERT INTO stories (id, author_id, author_name, author_avatar, author_sign, author_sign_symbol, text, image)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [id, req.user.id, user.name, user.avatar || null, sign ? sign.name : null, sign ? sign.symbol : null, trimmedText, hasImage ? image : null]
  );

  res.json({ ok: true, story: { ...rowToStory(rows[0]), isMine: true } });
});

app.delete('/api/stories/:id', requireAuth, async (req, res) => {
  const { rows } = await db.query('SELECT author_id FROM stories WHERE id = $1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ ok: false });
  if (rows[0].author_id !== req.user.id) {
    return res.status(403).json({ ok: false, error: 'Sadece kendi hikayeni silebilirsin.' });
  }
  await db.query('DELETE FROM stories WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

// ── Gönderiler (Twitter benzeri akış) ──
app.get('/api/posts', requireAuth, async (req, res) => {
  const mineOnly = req.query.mine === '1';
  const { rows } = await db.query(
    mineOnly
      ? `SELECT * FROM posts WHERE author_id = $1 ORDER BY created_at DESC`
      : `SELECT * FROM posts ORDER BY created_at DESC`,
    mineOnly ? [req.user.id] : []
  );

  if (!rows.length) return res.json({ ok: true, posts: [] });

  const postIds = rows.map(r => r.id);
  const [likesRes, commentsRes] = await Promise.all([
    db.query(`SELECT post_id, user_id FROM post_likes WHERE post_id = ANY($1)`, [postIds]),
    db.query(`SELECT post_id, COUNT(*)::int AS cnt FROM comments WHERE post_id = ANY($1) GROUP BY post_id`, [postIds])
  ]);

  const likesByPost = new Map();
  for (const l of likesRes.rows) {
    if (!likesByPost.has(l.post_id)) likesByPost.set(l.post_id, new Set());
    likesByPost.get(l.post_id).add(l.user_id);
  }
  const commentCountByPost = new Map(commentsRes.rows.map(c => [c.post_id, c.cnt]));

  const posts = rows.map(row => {
    const p = rowToPost(row);
    const likeSet = likesByPost.get(p.id) || new Set();
    return {
      ...p,
      isMine: p.authorId === req.user.id,
      likedByMe: likeSet.has(req.user.id),
      likeCount: likeSet.size,
      commentCount: commentCountByPost.get(p.id) || 0
    };
  });

  res.json({ ok: true, posts });
});

app.post('/api/posts', requireAuth, async (req, res) => {
  const { text, image } = req.body || {};
  const trimmedText = text ? String(text).trim().slice(0, 500) : '';
  const hasImage = !!image;

  if (hasImage && !isValidImageDataUrl(image)) {
    return res.status(400).json({ ok: false, error: 'Geçersiz ya da çok büyük bir fotoğraf (maks. ~3MB, png/jpg/gif/webp).' });
  }
  if (!trimmedText && !hasImage) {
    return res.status(400).json({ ok: false, error: 'Boş gönderi paylaşamazsın — metin ya da fotoğraf ekle.' });
  }

  const user = await getFullUser(req.user.id);
  const sign = userSign(user);
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  const { rows } = await db.query(
    `INSERT INTO posts (id, author_id, author_name, author_avatar, author_sign, author_sign_symbol, text, image)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [id, req.user.id, user.name, user.avatar || null, sign ? sign.name : null, sign ? sign.symbol : null, trimmedText, hasImage ? image : null]
  );

  res.json({ ok: true, post: { ...rowToPost(rows[0]), isMine: true, likedByMe: false, likeCount: 0, commentCount: 0 } });
});

app.post('/api/posts/:id/like', requireAuth, async (req, res) => {
  const { rows: postRows } = await db.query('SELECT * FROM posts WHERE id = $1', [req.params.id]);
  if (!postRows.length) return res.status(404).json({ ok: false });
  const post = postRows[0];

  const { rows: existingLike } = await db.query(
    'SELECT 1 FROM post_likes WHERE post_id = $1 AND user_id = $2', [req.params.id, req.user.id]
  );
  const isLiking = existingLike.length === 0;

  if (isLiking) {
    await db.query('INSERT INTO post_likes (post_id, user_id) VALUES ($1,$2)', [req.params.id, req.user.id]);
  } else {
    await db.query('DELETE FROM post_likes WHERE post_id = $1 AND user_id = $2', [req.params.id, req.user.id]);
  }

  const { rows: countRows } = await db.query('SELECT COUNT(*)::int AS cnt FROM post_likes WHERE post_id = $1', [req.params.id]);
  const likeCount = countRows[0].cnt;

  if (isLiking) {
    const user = await getFullUser(req.user.id);
    await createNotification({
      userId: post.author_id,
      type: 'like',
      fromUserId: req.user.id,
      fromUserName: user.name,
      postId: post.id,
      postExcerpt: excerpt(post.text)
    });
  }

  res.json({ ok: true, likedByMe: isLiking, likeCount });
});

app.delete('/api/posts/:id', requireAuth, async (req, res) => {
  const { rows } = await db.query('SELECT author_id FROM posts WHERE id = $1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ ok: false });
  if (rows[0].author_id !== req.user.id) {
    return res.status(403).json({ ok: false, error: 'Sadece kendi gönderini silebilirsin.' });
  }
  await db.query('DELETE FROM posts WHERE id = $1', [req.params.id]); // ilişkili beğeni/yorumlar CASCADE ile silinir
  res.json({ ok: true });
});

// ── Gönderi yanıtları (yorumlar) ──
app.get('/api/posts/:id/comments', requireAuth, async (req, res) => {
  const { rows } = await db.query(
    'SELECT * FROM comments WHERE post_id = $1 ORDER BY created_at ASC', [req.params.id]
  );
  res.json({ ok: true, comments: rows.map(rowToComment) });
});

app.post('/api/posts/:id/comments', requireAuth, async (req, res) => {
  const { text } = req.body || {};
  if (!text || !String(text).trim()) {
    return res.status(400).json({ ok: false, error: 'Yanıt boş olamaz.' });
  }

  const { rows: postRows } = await db.query('SELECT * FROM posts WHERE id = $1', [req.params.id]);
  if (!postRows.length) return res.status(404).json({ ok: false });
  const post = postRows[0];

  const user = await getFullUser(req.user.id);
  const sign = userSign(user);
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const trimmedText = String(text).trim().slice(0, 300);

  const { rows } = await db.query(
    `INSERT INTO comments (id, post_id, author_id, author_name, author_avatar, author_sign, author_sign_symbol, text)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [id, post.id, req.user.id, user.name, user.avatar || null, sign ? sign.name : null, sign ? sign.symbol : null, trimmedText]
  );

  await createNotification({
    userId: post.author_id,
    type: 'comment',
    fromUserId: req.user.id,
    fromUserName: user.name,
    postId: post.id,
    postExcerpt: excerpt(post.text),
    commentText: excerpt(trimmedText, 80)
  });

  res.json({ ok: true, comment: rowToComment(rows[0]) });
});

// ── Bildirimler ──
app.get('/api/notifications', requireAuth, async (req, res) => {
  const { rows } = await db.query(
    `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
    [req.user.id]
  );
  const notifications = rows.map(r => ({
    id: r.id,
    userId: r.user_id,
    type: r.type,
    fromUserId: r.from_user_id,
    fromUserName: r.from_user_name,
    postId: r.post_id,
    postExcerpt: r.post_excerpt,
    commentText: r.comment_text,
    createdAt: r.created_at,
    read: r.read
  }));
  const unreadCount = notifications.filter(n => !n.read).length;
  res.json({ ok: true, notifications, unreadCount });
});

app.post('/api/notifications/read-all', requireAuth, async (req, res) => {
  await db.query(`UPDATE notifications SET read = true WHERE user_id = $1 AND read = false`, [req.user.id]);
  res.json({ ok: true });
});

// ── Günün Anketi (Ay burcu/evresine göre her gün otomatik oluşur) ──
app.get('/api/daily-poll', requireAuth, async (req, res) => {
  const poll = await ensureTodayPoll();
  const { rows: voteRows } = await db.query('SELECT user_id, option_key FROM poll_votes WHERE poll_date = $1', [poll.poll_date]);

  const counts = {};
  poll.options.forEach(o => { counts[o.key] = 0; });
  voteRows.forEach(v => { if (counts[v.option_key] !== undefined) counts[v.option_key]++; });
  const total = voteRows.length;
  const myVoteRow = voteRows.find(v => v.user_id === req.user.id);

  res.json({
    ok: true,
    date: poll.poll_date,
    question: poll.question,
    total,
    myVote: myVoteRow ? myVoteRow.option_key : null,
    options: poll.options.map(o => ({
      ...o,
      count: counts[o.key],
      percent: total ? Math.round((counts[o.key] / total) * 100) : 0
    }))
  });
});

app.post('/api/daily-poll/vote', requireAuth, async (req, res) => {
  const { option } = req.body || {};
  const poll = await ensureTodayPoll();

  if (!poll.options.some(o => o.key === option)) {
    return res.status(400).json({ ok: false, error: 'Geçersiz seçenek.' });
  }

  await db.query(
    `INSERT INTO poll_votes (poll_date, user_id, option_key) VALUES ($1,$2,$3)
     ON CONFLICT (poll_date, user_id) DO UPDATE SET option_key = EXCLUDED.option_key`,
    [poll.poll_date, req.user.id, option]
  );
  res.json({ ok: true });
});

// ── home.html: girişsiz erişilemez ──
app.get('/html/home.html', (req, res, next) => {
  if (!req.user) return res.redirect('/html/log.html');
  next();
});

// ── Statik dosyalar (sadece public klasörler — .env ve server.js dışarı açılmaz) ──
app.use('/html', express.static(path.join(__dirname, 'html')));
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));

app.get('/', (req, res) => {
  res.redirect(req.user ? '/html/home.html' : '/html/log.html');
});

// ── Beklenmeyen hatalar için JSON yanıt ──
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ ok: false, error: 'Sunucu hatası.' });
});

app.listen(PORT, () => {
  console.log(`Astromend sunucusu çalışıyor: http://localhost:${PORT}`);
});

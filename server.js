const express = require('express');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const astro = require('./lib/astro');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'astromend-dev-secret-change-me';

// ── Basit dosya tabanlı "veritabanı" ──
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const POSTS_FILE = path.join(DATA_DIR, 'posts.json');
const STORIES_FILE = path.join(DATA_DIR, 'stories.json');
const COMMENTS_FILE = path.join(DATA_DIR, 'comments.json');
const NOTIFICATIONS_FILE = path.join(DATA_DIR, 'notifications.json');
const POLLS_FILE = path.join(DATA_DIR, 'polls.json');
const SYNASTRY_HISTORY_FILE = path.join(DATA_DIR, 'synastry-history.json');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, '[]');
if (!fs.existsSync(POSTS_FILE)) fs.writeFileSync(POSTS_FILE, '[]');
if (!fs.existsSync(STORIES_FILE)) fs.writeFileSync(STORIES_FILE, '[]');
if (!fs.existsSync(COMMENTS_FILE)) fs.writeFileSync(COMMENTS_FILE, '[]');
if (!fs.existsSync(NOTIFICATIONS_FILE)) fs.writeFileSync(NOTIFICATIONS_FILE, '[]');
if (!fs.existsSync(POLLS_FILE)) fs.writeFileSync(POLLS_FILE, '[]');
if (!fs.existsSync(SYNASTRY_HISTORY_FILE)) fs.writeFileSync(SYNASTRY_HISTORY_FILE, '[]');

function readUsers() {
  return JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
}
function writeUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}
function readPosts() {
  return JSON.parse(fs.readFileSync(POSTS_FILE, 'utf-8'));
}
function writePosts(posts) {
  fs.writeFileSync(POSTS_FILE, JSON.stringify(posts, null, 2));
}
function readStories() {
  return JSON.parse(fs.readFileSync(STORIES_FILE, 'utf-8'));
}
function writeStories(stories) {
  fs.writeFileSync(STORIES_FILE, JSON.stringify(stories, null, 2));
}
function readComments() {
  return JSON.parse(fs.readFileSync(COMMENTS_FILE, 'utf-8'));
}
function writeComments(comments) {
  fs.writeFileSync(COMMENTS_FILE, JSON.stringify(comments, null, 2));
}
function readNotifications() {
  return JSON.parse(fs.readFileSync(NOTIFICATIONS_FILE, 'utf-8'));
}
function writeNotifications(list) {
  fs.writeFileSync(NOTIFICATIONS_FILE, JSON.stringify(list, null, 2));
}
function readPolls() {
  return JSON.parse(fs.readFileSync(POLLS_FILE, 'utf-8'));
}
function writePolls(polls) {
  fs.writeFileSync(POLLS_FILE, JSON.stringify(polls, null, 2));
}
function todayKey() {
  return new Date().toISOString().slice(0, 10);
}
function readSynastryHistory() {
  return JSON.parse(fs.readFileSync(SYNASTRY_HISTORY_FILE, 'utf-8'));
}
function writeSynastryHistory(list) {
  fs.writeFileSync(SYNASTRY_HISTORY_FILE, JSON.stringify(list, null, 2));
}
function ensureTodayPoll(polls) {
  const key = todayKey();
  let poll = polls.find(p => p.date === key);
  if (!poll) {
    const content = astro.getDailyPollContent(new Date());
    poll = { date: key, question: content.question, options: content.options, votes: {} };
    polls.push(poll);
  }
  return poll;
}
function getFullUser(id) {
  return readUsers().find(u => u.id === id) || null;
}
function userSign(user) {
  return user && user.birthDate ? astro.getZodiacSignFromDate(user.birthDate) : null;
}
function excerpt(text, n = 50) {
  if (!text) return '';
  return text.length > n ? text.slice(0, n).trim() + '…' : text;
}
function createNotification({ userId, type, fromUserId, fromUserName, postId, postExcerpt, commentText }) {
  if (!userId || userId === fromUserId) return; // kendine bildirim yok
  const list = readNotifications();
  list.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    userId, type, fromUserId, fromUserName, postId,
    postExcerpt: postExcerpt || null,
    commentText: commentText || null,
    createdAt: new Date().toISOString(),
    read: false
  });
  writeNotifications(list);
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
app.post('/api/register', (req, res) => {
  const { name, email, password, birthDate } = req.body || {};

  if (!name || !email || !password || !birthDate) {
    return res.status(400).json({ ok: false, error: 'Ad, e-posta, şifre ve doğum tarihi zorunlu.' });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ ok: false, error: 'Şifre en az 6 karakter olmalı.' });
  }

  const users = readUsers();
  if (users.some(u => u.email.toLowerCase() === String(email).toLowerCase())) {
    return res.status(409).json({ ok: false, error: 'Bu e-posta ile zaten bir hesap var.' });
  }

  const user = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    name: String(name).trim(),
    email: String(email).trim().toLowerCase(),
    passwordHash: bcrypt.hashSync(password, 10),
    birthDate: birthDate || null,
    birthTime: null,
    birthPlace: null,
    bio: null,
    avatar: null,
    createdAt: new Date().toISOString()
  };
  users.push(user);
  writeUsers(users);

  issueSession(res, user);
  res.json({ ok: true, user: { name: user.name, email: user.email } });
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ ok: false, error: 'E-posta ve şifre gerekli.' });
  }

  const users = readUsers();
  const user = users.find(u => u.email.toLowerCase() === String(email).trim().toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ ok: false, error: 'E-posta veya şifre hatalı.' });
  }

  issueSession(res, user);
  res.json({ ok: true, user: { name: user.name, email: user.email } });
});

app.post('/api/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

app.get('/api/me', (req, res) => {
  if (!req.user) return res.status(401).json({ ok: false });
  const user = getFullUser(req.user.id);
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
app.put('/api/profile', requireAuth, (req, res) => {
  const { name, birthDate, birthTime, birthPlace, bio, avatar } = req.body || {};
  const users = readUsers();
  const idx = users.findIndex(u => u.id === req.user.id);
  if (idx === -1) return res.status(401).json({ ok: false });

  if (name && String(name).trim()) users[idx].name = String(name).trim();
  if (birthDate) users[idx].birthDate = birthDate;
  if (birthTime !== undefined) {
    users[idx].birthTime = birthTime && /^\d{2}:\d{2}$/.test(birthTime) ? birthTime : null;
  }
  if (birthPlace !== undefined) {
    users[idx].birthPlace = birthPlace ? String(birthPlace).trim().slice(0, 80) : null;
  }
  if (bio !== undefined) {
    users[idx].bio = bio ? String(bio).trim().slice(0, 280) : null;
  }

  if (avatar !== undefined) {
    if (!avatar) {
      users[idx].avatar = null;
    } else if (isValidImageDataUrl(avatar)) {
      users[idx].avatar = avatar;
    } else {
      return res.status(400).json({ ok: false, error: 'Geçersiz ya da çok büyük bir profil fotoğrafı (maks. ~3MB, png/jpg/gif/webp).' });
    }
  }

  writeUsers(users);
  res.json({ ok: true });
});

// ── Doğum haritası (natal) ──
app.get('/api/chart', requireAuth, (req, res) => {
  const user = getFullUser(req.user.id);
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
app.get('/api/transit', requireAuth, (req, res) => {
  const user = getFullUser(req.user.id);
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
app.post('/api/synastry', requireAuth, (req, res) => {
  const { partnerBirthDate, partnerId } = req.body || {};
  const user = getFullUser(req.user.id);
  if (!user || !user.birthDate) {
    return res.status(400).json({ ok: false, error: 'Önce kendi doğum tarihini Profilim sayfasından ekle.' });
  }

  let partnerDate = partnerBirthDate;
  let partnerName = 'Partnerin';
  if (partnerId) {
    const partner = readUsers().find(u => u.id === partnerId);
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

  const history = readSynastryHistory();
  history.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    userId: req.user.id,
    partnerName,
    sign1: result.sign1,
    sign2: result.sign2,
    score: result.score,
    text: result.text,
    createdAt: new Date().toISOString()
  });
  writeSynastryHistory(history);

  res.json({ ok: true, partnerName, result });
});

// ── Sinastri Geçmişi ──
app.get('/api/synastry-history', requireAuth, (req, res) => {
  const list = readSynastryHistory()
    .filter(h => h.userId === req.user.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ ok: true, history: list });
});

app.delete('/api/synastry-history/:id', requireAuth, (req, res) => {
  const list = readSynastryHistory();
  const idx = list.findIndex(h => h.id === req.params.id && h.userId === req.user.id);
  if (idx === -1) return res.status(404).json({ ok: false });
  list.splice(idx, 1);
  writeSynastryHistory(list);
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
app.get('/api/chart-history', requireAuth, (req, res) => {
  const user = getFullUser(req.user.id);
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
app.get('/api/solar-return', requireAuth, (req, res) => {
  const user = getFullUser(req.user.id);
  if (!user || !user.birthDate) {
    return res.status(400).json({ ok: false, error: 'Doğum tarihin eksik. Önce Profilim sayfasından ekle.' });
  }
  res.json({ ok: true, solarReturn: astro.daysUntilNextBirthday(user.birthDate) });
});

// ── Topluluk (isim/burca göre aranabilir) ──
app.get('/api/community', requireAuth, (req, res) => {
  const q = (req.query.q || '').toString().trim().toLocaleLowerCase('tr');
  const users = readUsers()
    .filter(u => u.birthDate)
    .map(u => {
      const sign = astro.getZodiacSignFromDate(u.birthDate);
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
app.post('/api/ai-assistant', requireAuth, (req, res) => {
  const { message } = req.body || {};
  const user = getFullUser(req.user.id);
  const sign = userSign(user);
  const reply = astro.answerAssistant(message, sign ? sign.name : null, user ? user.name : null);
  res.json({ ok: true, reply });
});

// ── Hikayeler (Instagram benzeri, 24 saat görünür) ──
const STORY_LIFETIME_MS = 24 * 60 * 60 * 1000;

app.get('/api/stories', requireAuth, (req, res) => {
  const cutoff = Date.now() - STORY_LIFETIME_MS;
  const active = readStories().filter(s => new Date(s.createdAt).getTime() >= cutoff);

  const latestByAuthor = new Map();
  for (const s of active) {
    const existing = latestByAuthor.get(s.authorId);
    if (!existing || new Date(s.createdAt) > new Date(existing.createdAt)) {
      latestByAuthor.set(s.authorId, s);
    }
  }

  const stories = Array.from(latestByAuthor.values())
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(s => ({ ...s, isMine: s.authorId === req.user.id }));

  res.json({ ok: true, stories });
});

app.post('/api/stories', requireAuth, (req, res) => {
  const { text, image } = req.body || {};
  const trimmedText = text ? String(text).trim().slice(0, 200) : '';
  const hasImage = !!image;

  if (hasImage && !isValidImageDataUrl(image)) {
    return res.status(400).json({ ok: false, error: 'Geçersiz ya da çok büyük bir fotoğraf (maks. ~3MB, png/jpg/gif/webp).' });
  }
  if (!trimmedText && !hasImage) {
    return res.status(400).json({ ok: false, error: 'Hikaye boş olamaz — metin ya da fotoğraf ekle.' });
  }

  const user = getFullUser(req.user.id);
  const sign = userSign(user);

  const stories = readStories();
  const story = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    authorId: req.user.id,
    authorName: user.name,
    authorAvatar: user.avatar || null,
    authorSign: sign ? sign.name : null,
    authorSignSymbol: sign ? sign.symbol : null,
    text: trimmedText,
    image: hasImage ? image : null,
    createdAt: new Date().toISOString()
  };
  stories.push(story);
  writeStories(stories);
  res.json({ ok: true, story: { ...story, isMine: true } });
});

app.delete('/api/stories/:id', requireAuth, (req, res) => {
  const stories = readStories();
  const idx = stories.findIndex(s => s.id === req.params.id);
  if (idx === -1) return res.status(404).json({ ok: false });
  if (stories[idx].authorId !== req.user.id) {
    return res.status(403).json({ ok: false, error: 'Sadece kendi hikayeni silebilirsin.' });
  }
  stories.splice(idx, 1);
  writeStories(stories);
  res.json({ ok: true });
});

// ── Gönderiler (Twitter benzeri akış) ──
app.get('/api/posts', requireAuth, (req, res) => {
  let posts = readPosts().slice().reverse();
  if (req.query.mine === '1') posts = posts.filter(p => p.authorId === req.user.id);

  const comments = readComments();
  res.json({
    ok: true,
    posts: posts.map(p => ({
      ...p,
      isMine: p.authorId === req.user.id,
      likedByMe: p.likes.includes(req.user.id),
      likeCount: p.likes.length,
      commentCount: comments.filter(c => c.postId === p.id).length
    }))
  });
});

app.post('/api/posts', requireAuth, (req, res) => {
  const { text, image } = req.body || {};
  const trimmedText = text ? String(text).trim().slice(0, 500) : '';
  const hasImage = !!image;

  if (hasImage && !isValidImageDataUrl(image)) {
    return res.status(400).json({ ok: false, error: 'Geçersiz ya da çok büyük bir fotoğraf (maks. ~3MB, png/jpg/gif/webp).' });
  }
  if (!trimmedText && !hasImage) {
    return res.status(400).json({ ok: false, error: 'Boş gönderi paylaşamazsın — metin ya da fotoğraf ekle.' });
  }

  const user = getFullUser(req.user.id);
  const sign = userSign(user);

  const posts = readPosts();
  const post = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    authorId: req.user.id,
    authorName: user.name,
    authorAvatar: user.avatar || null,
    authorSign: sign ? sign.name : null,
    authorSignSymbol: sign ? sign.symbol : null,
    text: trimmedText,
    image: hasImage ? image : null,
    createdAt: new Date().toISOString(),
    likes: []
  };
  posts.push(post);
  writePosts(posts);
  res.json({ ok: true, post: { ...post, isMine: true, likedByMe: false, likeCount: 0 } });
});

app.post('/api/posts/:id/like', requireAuth, (req, res) => {
  const posts = readPosts();
  const post = posts.find(p => p.id === req.params.id);
  if (!post) return res.status(404).json({ ok: false });

  const idx = post.likes.indexOf(req.user.id);
  const isLiking = idx === -1;
  if (isLiking) post.likes.push(req.user.id);
  else post.likes.splice(idx, 1);
  writePosts(posts);

  if (isLiking) {
    const user = getFullUser(req.user.id);
    createNotification({
      userId: post.authorId,
      type: 'like',
      fromUserId: req.user.id,
      fromUserName: user.name,
      postId: post.id,
      postExcerpt: excerpt(post.text)
    });
  }

  res.json({ ok: true, likedByMe: isLiking, likeCount: post.likes.length });
});

app.delete('/api/posts/:id', requireAuth, (req, res) => {
  const posts = readPosts();
  const idx = posts.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ ok: false });
  if (posts[idx].authorId !== req.user.id) {
    return res.status(403).json({ ok: false, error: 'Sadece kendi gönderini silebilirsin.' });
  }
  posts.splice(idx, 1);
  writePosts(posts);

  const comments = readComments().filter(c => c.postId !== req.params.id);
  writeComments(comments);

  res.json({ ok: true });
});

// ── Gönderi yanıtları (yorumlar) ──
app.get('/api/posts/:id/comments', requireAuth, (req, res) => {
  const comments = readComments().filter(c => c.postId === req.params.id);
  res.json({ ok: true, comments });
});

app.post('/api/posts/:id/comments', requireAuth, (req, res) => {
  const { text } = req.body || {};
  if (!text || !String(text).trim()) {
    return res.status(400).json({ ok: false, error: 'Yanıt boş olamaz.' });
  }

  const post = readPosts().find(p => p.id === req.params.id);
  if (!post) return res.status(404).json({ ok: false });

  const user = getFullUser(req.user.id);
  const sign = userSign(user);

  const comments = readComments();
  const comment = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    postId: post.id,
    authorId: req.user.id,
    authorName: user.name,
    authorAvatar: user.avatar || null,
    authorSign: sign ? sign.name : null,
    authorSignSymbol: sign ? sign.symbol : null,
    text: String(text).trim().slice(0, 300),
    createdAt: new Date().toISOString()
  };
  comments.push(comment);
  writeComments(comments);

  createNotification({
    userId: post.authorId,
    type: 'comment',
    fromUserId: req.user.id,
    fromUserName: user.name,
    postId: post.id,
    postExcerpt: excerpt(post.text),
    commentText: excerpt(comment.text, 80)
  });

  res.json({ ok: true, comment });
});

// ── Bildirimler ──
app.get('/api/notifications', requireAuth, (req, res) => {
  const list = readNotifications()
    .filter(n => n.userId === req.user.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 50);
  const unreadCount = list.filter(n => !n.read).length;
  res.json({ ok: true, notifications: list, unreadCount });
});

app.post('/api/notifications/read-all', requireAuth, (req, res) => {
  const list = readNotifications();
  let changed = false;
  list.forEach(n => {
    if (n.userId === req.user.id && !n.read) { n.read = true; changed = true; }
  });
  if (changed) writeNotifications(list);
  res.json({ ok: true });
});

// ── Günün Anketi (Ay burcu/evresine göre her gün otomatik oluşur) ──
app.get('/api/daily-poll', requireAuth, (req, res) => {
  const polls = readPolls();
  const poll = ensureTodayPoll(polls);
  writePolls(polls);

  const counts = {};
  poll.options.forEach(o => { counts[o.key] = 0; });
  Object.values(poll.votes).forEach(key => { if (counts[key] !== undefined) counts[key]++; });
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  res.json({
    ok: true,
    date: poll.date,
    question: poll.question,
    total,
    myVote: poll.votes[req.user.id] || null,
    options: poll.options.map(o => ({
      ...o,
      count: counts[o.key],
      percent: total ? Math.round((counts[o.key] / total) * 100) : 0
    }))
  });
});

app.post('/api/daily-poll/vote', requireAuth, (req, res) => {
  const { option } = req.body || {};
  const polls = readPolls();
  const poll = ensureTodayPoll(polls);

  if (!poll.options.some(o => o.key === option)) {
    return res.status(400).json({ ok: false, error: 'Geçersiz seçenek.' });
  }
  poll.votes[req.user.id] = option;
  writePolls(polls);
  res.json({ ok: true });
});

// ── home.html: girişsiz erişilemez ──
app.get('/html/home.html', (req, res, next) => {
  if (!req.user) return res.redirect('/html/log.html');
  next();
});

// ── Statik dosyalar (sadece public klasörler — data/ ve server.js dışarı açılmaz) ──
app.use('/html', express.static(path.join(__dirname, 'html')));
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));

app.get('/', (req, res) => {
  res.redirect(req.user ? '/html/home.html' : '/html/log.html');
});

app.listen(PORT, () => {
  console.log(`Astromend sunucusu çalışıyor: http://localhost:${PORT}`);
});

require('dotenv').config();
const { pool } = require('../lib/db');

const SQL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  birth_date DATE,
  birth_time TEXT,
  birth_place TEXT,
  bio TEXT,
  avatar TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  author_avatar TEXT,
  author_sign TEXT,
  author_sign_symbol TEXT,
  text TEXT,
  image TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS post_likes (
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  author_avatar TEXT,
  author_sign TEXT,
  author_sign_symbol TEXT,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stories (
  id TEXT PRIMARY KEY,
  author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  author_avatar TEXT,
  author_sign TEXT,
  author_sign_symbol TEXT,
  text TEXT,
  image TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  from_user_id TEXT NOT NULL,
  from_user_name TEXT NOT NULL,
  post_id TEXT,
  post_excerpt TEXT,
  comment_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS daily_polls (
  poll_date DATE PRIMARY KEY,
  question TEXT NOT NULL,
  options JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS poll_votes (
  poll_date DATE NOT NULL REFERENCES daily_polls(poll_date) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  option_key TEXT NOT NULL,
  PRIMARY KEY (poll_date, user_id)
);

CREATE TABLE IF NOT EXISTS synastry_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  partner_name TEXT,
  sign1 JSONB,
  sign2 JSONB,
  score INTEGER,
  result_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_synastry_history_user_id ON synastry_history(user_id);
`;

(async () => {
  try {
    await pool.query(SQL);
    console.log('Migrasyon tamamlandı ✦ Tüm tablolar hazır.');
  } catch (err) {
    console.error('Migrasyon hatası:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();

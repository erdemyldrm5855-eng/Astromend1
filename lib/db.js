const { Pool, types } = require('pg');

// DATE sütunlarını (birth_date, poll_date) JS Date nesnesine değil,
// 'YYYY-MM-DD' düz metne çevir — astro.js ve <input type="date"> bu formatı bekliyor.
types.setTypeParser(1082, (val) => val);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};

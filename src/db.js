const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('error', (err) => {
  // A background connection died. Log it; don't crash the whole app
  // for one bad connection, since the pool will open a new one.
  console.error('Unexpected error on idle Postgres client', err);
});

module.exports = pool;

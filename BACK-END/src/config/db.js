const { Pool } = require('pg');
const env = require('./env');

const pool = new Pool({
  ...(env.DATABASE_URL
    ? { connectionString: env.DATABASE_URL }
    : {
        host: env.DB_HOST,
        port: env.DB_PORT,
        database: env.DB_NAME,
        user: env.DB_USER,
        password: env.DB_PASSWORD
      }),
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000
});

pool.on('error', (error) => {
  console.error('Erreur inattendue du pool PostgreSQL:', error.message);
});

module.exports = { pool, query: (...args) => pool.query(...args) };
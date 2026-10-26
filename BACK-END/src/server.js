const env = require('./config/env');
const { pool } = require('./config/db');
const app = require('./app');

const server = app.listen(env.PORT, () => {
  console.log(`API Grossiste PPN disponible sur http://localhost:${env.PORT}`);
});

const shutdown = (signal) => {
  console.log(`${signal} reçu, arrêt du serveur...`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
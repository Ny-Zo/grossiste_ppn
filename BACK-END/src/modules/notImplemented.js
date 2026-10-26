const express = require('express');
const { authenticate } = require('../middleware/auth');

module.exports = (feature) => {
  const router = express.Router();
  router.use(authenticate);
  router.use((req, res) => {
    res.status(501).json({ error: `Le module ${feature} est en cours d'implémentation.` });
  });
  return router;
};
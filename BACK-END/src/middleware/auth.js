const jwt = require('jsonwebtoken');
const env = require('../config/env');

const authenticate = (req, res, next) => {
  const [scheme, token] = (req.headers.authorization || '').split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Authentification requise.' });
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    if (!payload.sub || !payload.role) {
      return res.status(401).json({ error: 'Token invalide.' });
    }
    req.user = { id: payload.sub, role: payload.role, nom: payload.nom };
    return next();
  } catch {
    return res.status(401).json({ error: 'Token invalide ou expiré.' });
  }
};

module.exports = { authenticate };
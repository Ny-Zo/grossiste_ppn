const bcrypt = require('bcryptjs');
const express = require('express');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const { query } = require('../../config/db');
const env = require('../../config/env');
const { authenticate } = require('../../middleware/auth');
const { validate } = require('../../middleware/validate');
const asyncHandler = require('../../utils/asyncHandler');

const router = express.Router();
const loginSchema = z.object({
  email: z.string().trim().email().max(160),
  mot_de_passe: z.string().min(1).max(200)
});

router.post('/login', validate(loginSchema), asyncHandler(async (req, res) => {
  const { email, mot_de_passe: password } = req.validated.body;
  const { rows } = await query(
    'SELECT id, nom, email, mot_de_passe_hash, role, actif FROM users WHERE lower(email) = lower($1) AND deleted_at IS NULL LIMIT 1',
    [email]
  );
  const user = rows[0];

  if (!user || !user.actif || !(await bcrypt.compare(password, user.mot_de_passe_hash))) {
    return res.status(401).json({ error: 'Adresse e-mail ou mot de passe incorrect.' });
  }

  const token = jwt.sign(
    { role: user.role, nom: user.nom },
    env.JWT_SECRET,
    { subject: user.id, expiresIn: env.JWT_EXPIRES_IN }
  );

  return res.json({
    token,
    user: { id: user.id, nom: user.nom, email: user.email, role: user.role }
  });
}));

router.get('/me', authenticate, asyncHandler(async (req, res) => {
  const { rows } = await query(
    'SELECT id, nom, email, role, actif FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1',
    [req.user.id]
  );
  if (!rows[0] || !rows[0].actif) return res.status(401).json({ error: 'Compte indisponible.' });
  return res.json({ user: rows[0] });
}));

module.exports = router;
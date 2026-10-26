const bcrypt = require('bcryptjs');
const express = require('express');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const { pool, query } = require('../../config/db');
const env = require('../../config/env');
const { authenticate } = require('../../middleware/auth');
const { validate } = require('../../middleware/validate');
const asyncHandler = require('../../utils/asyncHandler');

const router = express.Router();
const loginSchema = z.object({
  email: z.string().trim().email().max(160),
  mot_de_passe: z.string().min(1).max(200)
});
const setupSchema = z.object({
  nom: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(160),
  mot_de_passe: z.string().min(12).max(200)
});

function createToken(user) {
  return jwt.sign(
    { role: user.role, nom: user.nom },
    env.JWT_SECRET,
    { subject: user.id, expiresIn: env.JWT_EXPIRES_IN }
  );
}

router.get('/setup-status', asyncHandler(async (req, res) => {
  const { rows } = await query('SELECT EXISTS (SELECT 1 FROM users) AS has_users');
  return res.json({ setup_required: !rows[0].has_users });
}));

router.post('/setup', validate(setupSchema), asyncHandler(async (req, res) => {
  const { nom, email, mot_de_passe: password } = req.validated.body;
  const passwordHash = await bcrypt.hash(password, 12);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [70422119]);
    const { rows: existingUsers } = await client.query('SELECT EXISTS (SELECT 1 FROM users) AS has_users');

    if (existingUsers[0].has_users) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Le compte administrateur initial existe déjà.' });
    }

    const { rows } = await client.query(
      `INSERT INTO users (nom, email, mot_de_passe_hash, role)
       VALUES ($1, lower($2), $3, 'admin')
       RETURNING id, nom, email, role`,
      [nom, email, passwordHash]
    );
    await client.query('COMMIT');

    const user = rows[0];
    return res.status(201).json({ token: createToken(user), user });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}));

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

  const token = createToken(user);

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
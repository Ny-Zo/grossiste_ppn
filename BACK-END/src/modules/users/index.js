const bcrypt = require('bcryptjs');
const express = require('express');
const { z } = require('zod');
const { query } = require('../../config/db');
const { authenticate } = require('../../middleware/auth');
const { requireRoles } = require('../../middleware/roles');
const { validate } = require('../../middleware/validate');
const asyncHandler = require('../../utils/asyncHandler');

const router = express.Router();
const createUserSchema = z.object({
  nom: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(160),
  mot_de_passe: z.string().min(10).max(200),
  role: z.enum(['admin', 'gerant', 'caissier', 'magasinier'])
});

router.get('/', authenticate, requireRoles('admin', 'gerant'), asyncHandler(async (req, res) => {
  const { rows } = await query(
    'SELECT id, nom, email, role, actif, created_at FROM users WHERE deleted_at IS NULL ORDER BY nom LIMIT 200'
  );
  return res.json({ data: rows });
}));

router.post('/', authenticate, requireRoles('admin'), validate(createUserSchema), asyncHandler(async (req, res) => {
  const { nom, email, mot_de_passe, role } = req.validated.body;
  const hash = await bcrypt.hash(mot_de_passe, 12);
  const { rows } = await query(
    'INSERT INTO users (nom, email, mot_de_passe_hash, role) VALUES ($1, lower($2), $3, $4) RETURNING id, nom, email, role, actif, created_at',
    [nom, email, hash, role]
  );
  return res.status(201).json({ data: rows[0] });
}));

module.exports = router;
const { z } = require('zod');
const { pool, query } = require('../config/db');
const { requireRoles } = require('../middleware/roles');
const { validate } = require('../middleware/validate');
const asyncHandler = require('./asyncHandler');

const idSchema = z.object({ id: z.string().uuid() });

function registerCrudRoutes(router, { table, fields, schema, roles, scopeToUser = false, patchCondition = '', deleteCondition = '', afterDelete }) {
  const fieldNames = new Set(Object.keys(fields));

  router.patch('/:id', requireRoles(...roles), validate(idSchema, 'params'), validate(schema), asyncHandler(async (req, res) => {
    const patch = req.validated.body;
    const invalidField = Object.keys(patch).find((key) => !fieldNames.has(key));
    if (invalidField) return res.status(400).json({ error: 'Champ non modifiable.' });

    const entries = Object.entries(patch);
    const values = entries.map(([, value]) => value);
    const assignments = entries.map(([key], index) => `${fields[key]} = $${index + 1}`);
    values.push(req.validated.params.id);
    let where = `id = $${values.length} AND deleted_at IS NULL`;

    if (scopeToUser && req.user.role === 'caissier') {
      values.push(req.user.id);
      where += ` AND user_id = $${values.length}`;
    }
    if (patchCondition) where += ` AND (${patchCondition})`;

    const { rows } = await query(
      `UPDATE ${table} SET ${assignments.join(', ')} WHERE ${where} RETURNING id`,
      values
    );
    if (!rows[0]) return res.status(404).json({ error: 'Enregistrement introuvable ou accès refusé.' });
    return res.json({ data: rows[0] });
  }));

  router.delete('/:id', requireRoles(...roles), validate(idSchema, 'params'), asyncHandler(async (req, res) => {
    const values = [req.validated.params.id];
    let where = 'id = $1 AND deleted_at IS NULL';

    if (scopeToUser && req.user.role === 'caissier') {
      values.push(req.user.id);
      where += ` AND user_id = $${values.length}`;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `UPDATE ${table} SET deleted_at = now() WHERE ${where}${deleteCondition ? ` AND (${deleteCondition})` : ''} RETURNING id`,
        values
      );
      if (!rows[0]) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Enregistrement introuvable ou accès refusé.' });
      }
      if (afterDelete) await afterDelete(client, rows[0].id);
      await client.query('COMMIT');
      return res.status(204).end();
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }));
}

module.exports = { registerCrudRoutes };
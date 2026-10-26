const test = require('node:test');
const assert = require('node:assert/strict');
const { requireRoles } = require('../middleware/roles');

test('requireRoles allows an authorized role', async () => {
  const middleware = requireRoles('admin', 'gerant');
  const req = { user: { role: 'gerant' } };
  let nextCalled = false;

  await middleware(req, { status() { throw new Error('unexpected response'); } }, () => { nextCalled = true; });
  assert.equal(nextCalled, true);
});

test('requireRoles rejects a role that is not authorized', async () => {
  const middleware = requireRoles('admin');
  const req = { user: { role: 'caissier' } };
  let statusCode;
  let response;
  const res = {
    status(code) { statusCode = code; return this; },
    json(payload) { response = payload; return this; }
  };

  await middleware(req, res, () => assert.fail('next must not be called'));
  assert.equal(statusCode, 403);
  assert.equal(response.error, 'Accès non autorisé.');
});

test('requireRoles rejects unknown role names at configuration time', () => {
  assert.throws(() => requireRoles('superadmin'), /Rôle inconnu/);
});
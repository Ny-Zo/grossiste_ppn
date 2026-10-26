const test = require('node:test');
const assert = require('node:assert/strict');
const { z } = require('zod');
const { validate } = require('../middleware/validate');

test('validate stores parsed query data separately from Express request getters', () => {
  const middleware = validate(z.object({ limit: z.coerce.number().default(50) }), 'query');
  const req = { query: {} };
  let nextCalled = false;

  middleware(req, {}, () => { nextCalled = true; });

  assert.equal(nextCalled, true);
  assert.equal(req.validated.query.limit, 50);
  assert.deepEqual(req.query, {});
});
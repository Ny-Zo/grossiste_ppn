import { localDb } from './local.js';

export async function enqueueOperation(type, payload) {
  const opId = crypto.randomUUID();
  await localDb.outbox.add({
    opId,
    type,
    payload,
    status: 'pending',
    createdAt: new Date().toISOString()
  });
  return opId;
}

export function getPendingOperations() {
  return localDb.outbox.where('status').equals('pending').sortBy('createdAt');
}

export async function removeOperation(id) {
  return localDb.outbox.delete(id);
}
import { apiRequest } from '../api/client.js';
import { localDb } from '../db/local.js';
import { getPendingOperations, removeOperation } from '../db/outbox.js';

let syncing = false;

export async function synchronize() {
  if (syncing || !navigator.onLine || !localStorage.getItem('grossiste.token')) return;
  syncing = true;

  try {
    const pending = await getPendingOperations();
    if (pending.length) {
      await apiRequest('/sync/push', {
        method: 'POST',
        body: JSON.stringify({ operations: pending.map(({ opId, type, payload, createdAt }) => ({
          op_id: opId,
          type,
          payload,
          cree_le_client: createdAt
        })) })
      });
      await Promise.all(pending.map((operation) => removeOperation(operation.id)));
    }

    const since = (await localDb.syncMeta.get('serverSeq'))?.value || 0;
    const result = await apiRequest(`/sync/pull?since=${encodeURIComponent(since)}`);
    if (Array.isArray(result?.products)) await localDb.products.bulkPut(result.products);
    if (Number.isFinite(result?.server_seq)) {
      await localDb.syncMeta.put({ key: 'serverSeq', value: result.server_seq });
    }
  } finally {
    syncing = false;
  }
}
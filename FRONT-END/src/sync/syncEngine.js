import { apiRequest } from '../api/client.js';
import { localDb } from '../db/local.js';
import { getPendingOperations, removeOperation } from '../db/outbox.js';

let syncing = false;

export async function synchronize() {
  if (syncing || !navigator.onLine || !localStorage.getItem('grossiste.token')) return;
  syncing = true;

  try {
    const pending = await getPendingOperations();
    const productOperations = new Set(['CREATE_PRODUCT', 'UPDATE_PRODUCT', 'DELETE_PRODUCT']);

    for (const operation of pending) {
      if (!productOperations.has(operation.type)) continue;
      const { id, ...product } = operation.payload;

      if (operation.type === 'DELETE_PRODUCT') {
        await apiRequest(`/products/${id}`, { method: 'DELETE' });
        await localDb.products.delete(id);
      } else {
        const isCreate = operation.type === 'CREATE_PRODUCT';
        const result = await apiRequest(isCreate ? '/products' : `/products/${id}`, {
          method: isCreate ? 'POST' : 'PATCH',
          body: JSON.stringify(isCreate ? { ...product, id } : product)
        });
        const cached = await localDb.products.get(id);
        await localDb.products.put({ ...cached, ...result.data, sync_status: 'synced' });
      }

      await removeOperation(operation.id);
    }

    const remaining = await getPendingOperations();
    if (remaining.length) {
      await apiRequest('/sync/push', {
        method: 'POST',
        body: JSON.stringify({ operations: remaining.map(({ opId, type, payload, createdAt }) => ({
          op_id: opId,
          type,
          payload,
          cree_le_client: createdAt
        })) })
      });
      await Promise.all(remaining.map((operation) => removeOperation(operation.id)));
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
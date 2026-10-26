import Dexie from 'dexie';

export const localDb = new Dexie('grossiste-ppn');
localDb.version(1).stores({
  products: 'id, nom, category_id, updated_at',
  outbox: '++id, opId, type, createdAt, status',
  syncMeta: 'key'
});
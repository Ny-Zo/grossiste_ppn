const { z } = require('zod');

const optionalCode = z.preprocess(
  (value) => value === '' ? null : value,
  z.string().trim().max(60).nullable().optional()
);

const productSchema = z.object({
  id: z.string().uuid().optional(),
  category_id: z.string().uuid().nullable().optional(),
  nom: z.string().trim().min(2).max(160),
  code: optionalCode,
  unite_base: z.string().trim().min(1).max(20).default('kg'),
  seuil_alerte: z.coerce.number().min(0).max(99999999999.999).default(0),
  prix_achat_moyen: z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER).default(0),
  gere_peremption: z.boolean().default(false),
  actif: z.boolean().default(true)
});

const updateProductSchema = z.object({
  category_id: z.string().uuid().nullable(),
  nom: z.string().trim().min(2).max(160),
  code: optionalCode,
  unite_base: z.string().trim().min(1).max(20),
  seuil_alerte: z.coerce.number().min(0).max(99999999999.999),
  prix_achat_moyen: z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  gere_peremption: z.boolean(),
  actif: z.boolean()
}).partial().refine(
  (product) => Object.keys(product).length > 0,
  { message: 'Au moins un champ doit être fourni.' }
);

const productIdSchema = z.object({ id: z.string().uuid() });

module.exports = { productSchema, updateProductSchema, productIdSchema };
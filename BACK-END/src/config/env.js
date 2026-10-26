const dotenv = require('dotenv');
const { z } = require('zod');

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  CORS_ORIGIN: z.string().url().default('http://localhost:5173'),
  DATABASE_URL: z.string().optional().default(''),
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.coerce.number().int().positive().default(5432),
  DB_NAME: z.string().default('grossiste_ppn'),
  DB_USER: z.string().default('postgres'),
  DB_PASSWORD: z.string().default(''),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('12h')
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
  throw new Error(`Configuration invalide. Vérifiez BACK-END/.env. ${details.join('; ')}`);
}

module.exports = parsed.data;
import * as Joi from 'joi';

// 1. TYPE — gives ConfigService<AppConfig> compile-time safety
export interface AppConfig {
  PORT: number;
  NODE_ENV: string;
  APP_NAME: string;
  CORS_ORIGINS: string;
  JWT_SECRET: string;
  ACCESS_TOKEN_TIME_VALUE: string;
  ACCESS_TOKEN_TIME_UNIT: string;
  REFRESH_TOKEN_TIME_VALUE: string;
  REFRESH_TOKEN_TIME_UNIT: string;
  MONGODB_URI: string;
  REDIS_HOST: string;
  REDIS_PORT: number;
  MAIL_HOST: string;
  MAIL_PORT: number;
  MAIL_USER: string;
  MAIL_PASSWORD: string;
  MAIL_FROM: string;
  ANTHROPIC_API_KEY: string;
  ANTHROPIC_MODEL: string;
  VOYAGE_API_KEY: string;
  VOYAGE_EMBED_MODEL: string;
  VOYAGE_RERANK_MODEL: string;
  AI_TIMEOUT_MS: number;
}

// 2. VALIDATION — Joi, checked at boot.
// @nestjs/config's `validationSchema` option expects a Standard Schema
// (Zod/Valibot/Arktype), which Joi is not — so this schema is run through the
// `validate` function below instead of being handed to ConfigModule directly.
export const configValidationSchema = Joi.object({
  PORT: Joi.number().default(3000),
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  APP_NAME: Joi.string().required(),
  CORS_ORIGINS: Joi.string().required(),
  JWT_SECRET: Joi.string().min(32).required(),
  ACCESS_TOKEN_TIME_VALUE: Joi.string().required(),
  ACCESS_TOKEN_TIME_UNIT: Joi.string().required(),
  REFRESH_TOKEN_TIME_VALUE: Joi.string().required(),
  REFRESH_TOKEN_TIME_UNIT: Joi.string().required(),
  MONGODB_URI: Joi.string().required(),
  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.number().required(),
  MAIL_HOST: Joi.string().required(),
  MAIL_PORT: Joi.number().required(),
  MAIL_USER: Joi.string().required(),
  MAIL_PASSWORD: Joi.string().required(),
  MAIL_FROM: Joi.string().required(),
  // Anthropic Claude (LLM, chat + tool calling) and Voyage AI (embeddings +
  // reranker). Neither is OpenAI-compatible; both are called over fetch from
  // LlmClient. Both are real cloud providers — no localhost fallback — so the
  // API keys are required at boot. Neither base URL is configurable: there is
  // no self-hosted variant of either API to point at.
  ANTHROPIC_API_KEY: Joi.string().required(),
  ANTHROPIC_MODEL: Joi.string().default('claude-haiku-4-5'),
  VOYAGE_API_KEY: Joi.string().required(),
  // voyage-3.x / rerank-2.x are deprecated and carry no free quota — do not
  // roll these defaults back to them.
  VOYAGE_EMBED_MODEL: Joi.string().default('voyage-4'),
  VOYAGE_RERANK_MODEL: Joi.string().default('rerank-3'),
  AI_TIMEOUT_MS: Joi.number().default(90_000),
})
  // process.env always carries OS-level vars (PATH, HOME, ...) beyond what
  // AppConfig declares, so unknown keys must be allowed at this top level —
  // every key AppConfig *does* declare is still required and strictly typed.
  .unknown(true);

// Reports every validation failure at once rather than stopping at the first.
export function validateEnv(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const { error, value } = configValidationSchema.validate(config, {
    abortEarly: false,
  });
  if (error) {
    throw new Error(`Invalid environment configuration: ${error.message}`);
  }
  return value as Record<string, unknown>;
}

// 3. FACTORY — maps process.env into the typed object.
// Joi has already validated these are present by the time this runs, so the
// `as string` casts are safe — this is the one place env access is trusted.
export default (): AppConfig => ({
  PORT: parseInt(process.env.PORT ?? '3000', 10),
  NODE_ENV: (process.env.NODE_ENV as string) ?? 'development',
  APP_NAME: process.env.APP_NAME as string,
  CORS_ORIGINS: process.env.CORS_ORIGINS as string,
  JWT_SECRET: process.env.JWT_SECRET as string,
  ACCESS_TOKEN_TIME_VALUE: process.env.ACCESS_TOKEN_TIME_VALUE as string,
  ACCESS_TOKEN_TIME_UNIT: process.env.ACCESS_TOKEN_TIME_UNIT as string,
  REFRESH_TOKEN_TIME_VALUE: process.env.REFRESH_TOKEN_TIME_VALUE as string,
  REFRESH_TOKEN_TIME_UNIT: process.env.REFRESH_TOKEN_TIME_UNIT as string,
  MONGODB_URI: process.env.MONGODB_URI as string,
  REDIS_HOST: process.env.REDIS_HOST as string,
  REDIS_PORT: parseInt(process.env.REDIS_PORT ?? '6379', 10),
  MAIL_HOST: process.env.MAIL_HOST as string,
  MAIL_PORT: parseInt(process.env.MAIL_PORT ?? '587', 10),
  MAIL_USER: process.env.MAIL_USER as string,
  MAIL_PASSWORD: process.env.MAIL_PASSWORD as string,
  MAIL_FROM: process.env.MAIL_FROM as string,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY as string,
  ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5',
  VOYAGE_API_KEY: process.env.VOYAGE_API_KEY as string,
  VOYAGE_EMBED_MODEL: process.env.VOYAGE_EMBED_MODEL ?? 'voyage-4',
  VOYAGE_RERANK_MODEL: process.env.VOYAGE_RERANK_MODEL ?? 'rerank-3',
  AI_TIMEOUT_MS: parseInt(process.env.AI_TIMEOUT_MS ?? '90000', 10),
});

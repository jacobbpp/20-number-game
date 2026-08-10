declare namespace Cloudflare {
  interface Env {
    DB: D1Database
    ACTIVITY: DurableObjectNamespace<import('../src/index').ActivityFeed>
    RATE_LIMITER: DurableObjectNamespace<import('../src/index').RateLimiter>
    // Set in vitest.config.ts, read by test/apply-schema.ts — the real
    // deploy path applies the same schema.sql via `npm run migrate:remote`.
    TEST_SCHEMA_SQL: string
  }
}

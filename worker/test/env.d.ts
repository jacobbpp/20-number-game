declare namespace Cloudflare {
  interface Env {
    DB: D1Database
    ACTIVITY: DurableObjectNamespace<import('../src/index').ActivityFeed>
    RATE_LIMITER: DurableObjectNamespace<import('../src/index').RateLimiter>
    // Set in vitest.config.ts, read by test/apply-schema.ts — the real
    // deploy path applies the same schema.sql via `npm run migrate:remote`.
    TEST_SCHEMA_SQL: string
    // Also set in vitest.config.ts, read by test/cron.test.ts to check the
    // schedules on disk still match the constants scheduled() branches on.
    TEST_WRANGLER_TOML: string
    // Overridden in vitest.config.ts with a throwaway pair, so tests never
    // touch the deployed keys.
    VAPID_PUBLIC_KEY: string
    VAPID_PRIVATE_KEY: string
  }
}

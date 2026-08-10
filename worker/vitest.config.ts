import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import { cloudflareTest } from '@cloudflare/vitest-pool-workers'
import { defineConfig } from 'vitest/config'

// Reused as-is rather than duplicated into a separate migrations folder —
// this worker's real deploy path is `npm run migrate:remote`, which applies
// this same file. Read here (plain Node, not inside the Workers runtime)
// and handed to the test worker as a plain-string binding, since setup
// files running inside Miniflare can't read from disk.
const schemaSql = readFileSync(fileURLToPath(new URL('./schema.sql', import.meta.url)), 'utf-8')

// Read for the same reason, and handed over the same way: scheduled() picks a
// branch by comparing controller.cron against a string constant, and nothing
// inside the runtime can open the file those strings have to agree with.
const wranglerToml = readFileSync(fileURLToPath(new URL('./wrangler.toml', import.meta.url)), 'utf-8')

// A throwaway VAPID pair, generated for tests and deliberately committed. It
// signs nothing that leaves the test runtime, and having the public half to
// hand is what lets test/push.test.ts verify the signature it produced rather
// than just eyeballing the header's shape. Binding the public key here also
// overrides the real one from wrangler.toml, so a test can never sign with
// the production key even by accident.
const TEST_VAPID_PUBLIC_KEY = 'BGAWzgxURe4f3Q8Gi5WOh9NVBHEcwgSkYcIKAMNB18xSNCZrCD1_grX7FZV52TTxDCvdvtikEkZanyR8tMdqRqU'
const TEST_VAPID_PRIVATE_KEY = 'QN4PSaG5fs364qhEW51hf-E5Kzzaug4bF9Nsg8kPV0Q'

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.toml' },
      miniflare: {
        bindings: {
          TEST_SCHEMA_SQL: schemaSql,
          TEST_WRANGLER_TOML: wranglerToml,
          VAPID_PUBLIC_KEY: TEST_VAPID_PUBLIC_KEY,
          VAPID_PRIVATE_KEY: TEST_VAPID_PRIVATE_KEY,
        },
      },
    }),
  ],
  test: {
    setupFiles: ['./test/apply-schema.ts'],
  },
})

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

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.toml' },
      miniflare: {
        bindings: { TEST_SCHEMA_SQL: schemaSql },
      },
    }),
  ],
  test: {
    setupFiles: ['./test/apply-schema.ts'],
  },
})

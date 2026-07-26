import { env } from 'cloudflare:workers'

// Setup files run outside per-test-file storage isolation and may run more
// than once — every statement here is CREATE TABLE/INDEX IF NOT EXISTS, so
// re-running is harmless.
const statements = env.TEST_SCHEMA_SQL.split(';')
  .map(statement => statement.trim())
  .filter(Boolean)

for (const statement of statements) {
  await env.DB.prepare(statement).run()
}

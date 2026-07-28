import { env } from 'cloudflare:workers'

// Setup files run outside per-test-file storage isolation and may run more
// than once — every statement here is CREATE TABLE/INDEX IF NOT EXISTS, so
// re-running is harmless.
//
// Comments are stripped before splitting on ';' rather than after. The real
// deploy path (`wrangler d1 execute --file=./schema.sql`) parses SQL properly
// and doesn't care, but this splitter is naive, so an ordinary semicolon
// inside a prose comment in schema.sql would otherwise tear one statement in
// half and fail every test in the suite. Safe here because schema.sql is all
// DDL with no string literals for '--' to hide inside.
const statements = env.TEST_SCHEMA_SQL.split('\n')
  .filter(line => !line.trim().startsWith('--'))
  .join('\n')
  .split(';')
  .map(statement => statement.trim())
  .filter(Boolean)

for (const statement of statements) {
  await env.DB.prepare(statement).run()
}

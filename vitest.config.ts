import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    // worker/ has its own vitest-pool-workers setup (cloudflare:test
    // bindings this jsdom environment can't resolve) — run its tests via
    // `cd worker && npm test`, not from here.
    exclude: ['**/node_modules/**', 'worker/**'],
  },
})

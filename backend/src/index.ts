import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { existsSync } from 'node:fs'
import { extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { initDb } from './db'
import { registerRoutes } from './routes'
import { ensureSeedCasePool } from './services/seed-case-pool'

const FRONTEND_DIST_ROOT = '../frontend/dist'

try {
  const envFilePath = fileURLToPath(new URL('../.env', import.meta.url))
  if (existsSync(envFilePath)) {
    process.loadEnvFile(envFilePath)
  }
} catch (error) {
  console.warn('Failed to load backend .env file:', error)
}

initDb()

const seedPool = ensureSeedCasePool()

const app = new Hono()
const hasFrontendBuild = existsSync(resolve(process.cwd(), FRONTEND_DIST_ROOT))

console.log(
  `Env status: AZURE_OPENAI_ENDPOINT=${process.env.AZURE_OPENAI_ENDPOINT ? 'set' : 'missing'}, AZURE_OPENAI_API_KEY=${process.env.AZURE_OPENAI_API_KEY ? 'set' : 'missing'}, ELEVENLABS_API_KEY=${process.env.ELEVENLABS_API_KEY ? 'set' : 'missing'}`
)
console.log(
  `Seed case pool: total=${seedPool.total}, remaining=${seedPool.remaining}, inserted=${seedPool.inserted}`
)
console.log(
  hasFrontendBuild
    ? `Frontend build detected. Serving static app from ${FRONTEND_DIST_ROOT}.`
    : 'Frontend build not found. Running in API-only mode.'
)

app.get('/api/health', (c) => c.json({ status: 'ok' }))

registerRoutes(app)

if (hasFrontendBuild) {
  const serveFrontendAsset = serveStatic({ root: FRONTEND_DIST_ROOT })
  const serveFrontendIndex = serveStatic({ root: FRONTEND_DIST_ROOT, path: 'index.html' })

  app.use('*', async (c, next) => {
    if (c.req.path.startsWith('/api/')) {
      return next()
    }

    return serveFrontendAsset(c, next)
  })

  app.get('*', async (c, next) => {
    if (c.req.path.startsWith('/api/') || extname(c.req.path)) {
      return next()
    }

    return serveFrontendIndex(c, next)
  })
}

const port = Number(process.env.PORT ?? 3000)

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Server running on http://localhost:${info.port}`)
})

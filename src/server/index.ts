import { serve } from '@hono/node-server'
import { app } from '../app.tsx'

// Default 3001, bukan 3000. Port 3000 paling sering dipakai service lain di
// mesin lokal (node, create-react-app,_image loader) dan memicu EADDRINUSE.
const port = Number(process.env.PORT ?? 3001)
const apiKey = process.env.API_KEY

/**
 * `serve()` from @hono/node-server only passes `HttpBindings` as env, so
 * `API_KEY` has to be injected here. On Cloudflare Worker, `API_KEY` is
 * already a binding and this file isn't used at all.
 *
 * There's no need for a default value: if API_KEY is missing it gets passed as
 * undefined, and `app.ts` throws with an explicit message. Failing early on
 * the first request is better than quietly allowing requests in.
 */
serve({ fetch: (request) => app.fetch(request, { API_KEY: apiKey as string }), port }, (info) => {
  console.log(`kalender-api http://localhost:${info.port}`)
})

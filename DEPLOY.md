# Deploying Saathi to Cloudflare Workers

Saathi runs as a Cloudflare Worker through the [OpenNext adapter](https://opennext.js.org/cloudflare).
Live: https://saathi.honeygautam0.workers.dev

## One-time: give the Worker its Gemini key

The key is a Worker **secret**. It is never committed and never goes in `wrangler.jsonc`.

```bash
npx wrangler secret put GEMINI_API_KEY   # paste the key when prompted
```

Until this is set, the app loads but every AI call answers `AI is not set up on this server`
(a clean error, no fake data). Model ids and `RATE_LIMIT_PER_MINUTE` can be overridden under
`"vars"` in `wrangler.jsonc`.

## Everyday commands

| Command | What it does |
| --- | --- |
| `npm run preview` | Build, then run the Worker locally in Cloudflare's `workerd` runtime. Put a local key in `.dev.vars` (git-ignored). |
| `npm run deploy` | Build and deploy to your Cloudflare account (`npx wrangler login` first). |

## Why Cache Components are off

`next.config.ts` sets `cacheComponents: false` and `partialPrefetching: false`. With them on, the
OpenNext worker hangs on every page ("Worker's code had hung and would never generate a response").
Saathi is a client-side, local-first app and uses no `use cache`, so nothing is lost. If you turn
them back on, run `npm run preview` and load every page before deploying.

## Rate limiting

`lib/server/ratelimit.ts` keeps its counters in memory, so on Workers the limit applies per isolate,
not globally. For a hard global cap, use Cloudflare's Rate Limiting rules or a Durable Object.

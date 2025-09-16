## Overview

This project is a full‑stack "deep search" and chat assistant built with Next.js. It can search the web, crawl and summarize pages, and reason over the gathered context to produce grounded answers. It includes authentication, persistence, rate limiting, and an evaluation harness to measure answer quality.

### What it does
- **Search + crawl**: Queries the web (via Serper) and crawls relevant pages, transforming and chunking content for efficient retrieval.
- **Deep reasoning**: Uses an agent loop to iteratively read, summarize, and synthesize answers across multiple sources.
- **Guardrails**: Applies safety and relevance checks before streaming responses back to the client.
- **Streaming chat**: Renders incremental assistant responses in a conversational UI.
- **Persistence**: Stores sessions, messages, and crawled artifacts using Drizzle migrations.
- **Rate limiting**: Protects endpoints with Redis‑backed limits; supports anonymous and authenticated traffic.
- **Evals**: Provides simple, scriptable evaluations to track answer relevancy and regressions.

### Tech stack
- **Frontend**: Next.js App Router, Tailwind CSS, React server components.
- **API**: Next.js Route Handlers (streaming), agent loop for multi‑step reasoning.
- **Auth**: NextAuth for OAuth/session handling.
- **Data**: Drizzle ORM + Postgres (via Docker) for structured data; Redis for rate limiting and caching.

### Key files and folders
- `src/app/` — UI pages and API routes (e.g., `api/chat` for streaming chat responses).
- `src/components/` — Chat UI primitives and auth components.
- `src/deep-search.ts` — Orchestrates multi‑step deep search across sources.
- `src/crawler.ts` and `src/summarize-url.ts` — Fetching, chunking, and summarizing external content.
- `src/run-agent-loop.ts` — Core agent loop and tool invocation.
- `src/guardrail.ts` — Safety and relevancy checks.
- `src/server/db/` — Drizzle schema, queries, and DB entrypoint; migrations in `drizzle/`.
- `src/server/redis/` and `src/server/rate-limit.ts` — Redis client and rate‑limit logic.
- `src/server/auth/` — NextAuth configuration and helpers.
- `evals/` — Scripts to run answer‑relevancy and regression evaluations.

### How it works (high level)
1. User asks a question in chat.
2. The server triggers the agent loop: search → select sources → crawl → chunk/summarize.
3. The model synthesizes an answer grounded in retrieved context.
4. Guardrails validate the draft; the API streams tokens back to the client.
5. Data is persisted; rate limits are enforced per IP/session via Redis.

## Setup

1. Install dependencies with `pnpm`

```bash
pnpm install
```

2. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/)

3. Run `./start-database.sh` to start the database.

4. Run `./start-redis.sh` to start the Redis server.

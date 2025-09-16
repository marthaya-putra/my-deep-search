## TODO

Do related followup questions.

Handle anonymous requests to the API, rate limit by IP.

Use a chunking system on the crawled information.

Add 'edit' button, and 'rerun from here' button.

Add evals.

Handle conversations longer than the context window by summarizing.

How do you get the LLM to ask followup questions?

## Setup

1. Install dependencies with `pnpm`

```bash
pnpm install
```

2. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/)

3. Run `./start-database.sh` to start the database.

4. Run `./start-redis.sh` to start the Redis server.

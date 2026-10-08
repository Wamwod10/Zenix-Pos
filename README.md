# Zenix POS — Frontend (separate repository)

This **Vercel/React/Vite frontend repository is standalone**. The source root is this directory (`src/`, `public/`, `api/`); it must **not** contain `frontend/frontend` or a copy of `backend/`.

## Local development

```bash
npm ci
cp .env.example .env
npm run dev
npm test
npm run build
```

Run the dedicated backend repository separately at `http://localhost:4000` and configure `VITE_API_URL` in your local `.env`.

## Vercel

- Import this repository with **Root Directory = repository root (`.`)**, framework Vite, and build command `npm run build`.
- For production, leave `VITE_API_URL` blank; set the server-only `ZENIX_BACKEND_URL` to the Render API HTTPS origin. The `/api/*` reverse proxy is in `api/proxy.js`.
- Backend code, Neon migrations, and Render deployment live only in the separate **Zenix-Pos-Backend** repository.
- The main POS design, styles, and screens are preserved; no UI redesign.

## Tests

`npm test` checks frontend without a backend clone. With both repositories checked out as sibling directories, `npm run test:with-backend` also runs historical cross-repository contract tests. `npm run verify:production` checks standalone frontend deployment readiness. The previous monorepo documentation is archived in `docs/archived-repo-layout/`.

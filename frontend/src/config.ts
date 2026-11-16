// Monorepo layout: VITE_API_URL comes from the root .env (see vite.config.ts's
// envDir), the same file the backend reads. Routes live under /api/v1 on
// every controller (backend/src/app/**/*.controller.ts), never a global prefix.
export default {
  apiURL: `${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/api/v1`,
}

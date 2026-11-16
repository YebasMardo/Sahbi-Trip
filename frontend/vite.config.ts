import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Monorepo layout: the real .env (VITE_API_URL, ...) lives at the project
  // root, one level up — same file the backend reads (see backend/src/app.module.ts).
  envDir: '..',
})

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev: run `npm run dev:api` in a second terminal so /api (cache proxy + accounts) works.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
    proxy: { "/api": "http://localhost:3000" },
  },
});

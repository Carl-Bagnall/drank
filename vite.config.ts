import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { cloudflare } from "@cloudflare/vite-plugin";

// The Cloudflare plugin runs the Worker in workerd alongside Vite's dev
// server, so `npm run dev` gives real bindings (including local D1) rather
// than a mock that drifts from production.
export default defineConfig({
  plugins: [react(), tailwindcss(), cloudflare()],
});

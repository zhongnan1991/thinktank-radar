import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { thinktankApi } from './server/api'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  // NOTE: the template's react-inspect dev helper (kimi-plugin-inspect-react)
  // is a private package and is intentionally not used here so that CI builds
  // from a fresh checkout work with the public npm registry only.
  plugins: [thinktankApi(), react()],
  server: {
    port: 3000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});

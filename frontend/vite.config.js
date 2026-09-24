import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // Toute requête /api depuis le frontend est redirigée vers le backend Express
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
      // Les photos uploadées (maisons/cours, chambres) sont servies par le backend
      "/uploads": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
});

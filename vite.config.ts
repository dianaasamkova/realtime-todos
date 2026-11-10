import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const fromRoot = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // Client code imports app modules as "@/..." and the shared API types as "@contract/...".
    alias: [
      { find: /^@\//, replacement: fromRoot("./src/") },
      { find: /^@contract\//, replacement: fromRoot("./contract/") },
    ],
  },
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
  test: {
    restoreMocks: true,
    projects: [
      {
        extends: true,
        test: {
          name: "client",
          environment: "jsdom",
          include: ["src/**/*.test.{ts,tsx}"],
          setupFiles: ["src/test/setup.ts"],
        },
      },
      {
        extends: true,
        test: { name: "server", environment: "node", include: ["server/**/*.test.ts"] },
      },
    ],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}", "server/**/*.ts", "contract/**/*.ts"],
      exclude: ["**/*.test.{ts,tsx}", "src/test/**", "src/index.tsx", "server/index.ts"],
      reporter: ["text-summary", "text", "html"],
    },
  },
});

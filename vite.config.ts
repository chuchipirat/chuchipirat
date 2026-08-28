import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";
import {sentryVitePlugin} from "@sentry/vite-plugin";

export default defineConfig({
  plugins: [
    react(),
    // Sentry: Source Maps + Bundle Size Analysis hochladen.
    // Wird nur aktiv wenn SENTRY_AUTH_TOKEN gesetzt ist (CI/CD Build).
    // Lokale Builds überspringen das Plugin automatisch.
    sentryVitePlugin({
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      release: {
        name: process.env.npm_package_version,
        setCommits: {
          auto: true,
        },
      },
      sourcemaps: {
        filesToDeleteAfterUpload: ["./build/**/*.map"],
      },
      bundleSizeOptimizations: {
        excludeDebugStatements: true,
        excludeReplayIframe: true,
        excludeReplayShadowDom: true,
      },
      // Plugin nur aktivieren wenn Auth-Token vorhanden (CI-Build)
      disable: !process.env.SENTRY_AUTH_TOKEN,
    }),
  ],
  server: {
    port: 3000,
  },
  build: {
    outDir: "build",
    sourcemap: true,
  },
});

import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";
// TODO(post-migration): Entfernen nach Firebase-Removal.
// Dieses Plugin liefert Node.js-Polyfills, die nur vom Firebase SDK benötigt werden.
// Durch das Entfernen wird auch die transitive elliptic-Schwachstelle (F-041) behoben.
// Siehe: .claude/security/audit-2026-04-02.md [F-041], [F-045]
import {nodePolyfills} from "vite-plugin-node-polyfills";

// Sicherheitscheck: Service-Role-Key darf nie in deployten Builds gelangen.
// Der Dev-Server (npm run dev) ist erlaubt — wird nur lokal ausgeführt und
// wird für die Firebase→Supabase-Datenmigration benötigt.
if (
  process.env.NODE_ENV === "production" &&
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
) {
  throw new Error(
    "FATAL: VITE_SUPABASE_SERVICE_ROLE_KEY must NEVER be set in production builds. " +
      "The service role key belongs in the backend (supabase/.env), not the frontend.",
  );
}

export default defineConfig({
  // TODO(post-migration): nodePolyfills() entfernen (siehe Import oben)
  plugins: [react(), nodePolyfills()],
  server: {port: 3000},
  build: {outDir: "build"},
});

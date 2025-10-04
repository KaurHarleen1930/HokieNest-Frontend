import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => {
  // Force-load .env files for this mode
  const env = loadEnv(mode, process.cwd(), ""); 

  console.log("[vite] loaded env:", {
    VITE_SUPABASE_URL: env.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: env.VITE_SUPABASE_ANON_KEY?.slice(0, 12) + "...", // partial for sanity
    MODE: mode,
  });

  return {
    envPrefix: "VITE_", 
    server: {
      host: "localhost",
      port: 5173,
      proxy: {
        "/api": {
          target: "http://localhost:4000",
          changeOrigin: true,
          secure: false,
        },
      },
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: { "@": path.resolve(__dirname, "./src") },
    },
    define: {
      // Fallbacks if import.meta.env is missing for any reason
      __SUPABASE_URL__: JSON.stringify(env.VITE_SUPABASE_URL || ""),
      __SUPABASE_ANON_KEY__: JSON.stringify(env.VITE_SUPABASE_ANON_KEY || ""),
      "process.env.VITE_API_BASE_URL": JSON.stringify("/api/v1"),
    },
  };
});

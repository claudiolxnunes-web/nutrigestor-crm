import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
 export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
   resolve: {
     alias: {
       "@": path.resolve(__dirname, "./src"),
     },
     dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
   },
   build: {
     rollupOptions: {
       output: {
         manualChunks: {
           "vendor-react": ["react", "react-dom", "react-router-dom"],
           "vendor-ui": ["lucide-react", "framer-motion", "recharts"],
           "vendor-utils": ["date-fns", "zod", "clsx", "tailwind-merge"],
           "vendor-supabase": ["@supabase/supabase-js", "@tanstack/react-query"],
           "vendor-excel": ["@e965/xlsx"],
         },
       },
     },
     chunkSizeWarningLimit: 1000,
     sourcemap: false,
     minify: "esbuild",
     cssMinify: true,
   },
}));

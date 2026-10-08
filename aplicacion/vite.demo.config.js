import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({
  plugins: [react(), tailwindcss()],
  publicDir: false,
  define: { 'process.env.NODE_ENV': JSON.stringify('production'), 'import.meta.env.VITE_DEMO_ONLY': JSON.stringify('true'), 'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(''), 'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(''), 'import.meta.env.VITE_ENABLE_LEGACY_SHOP': JSON.stringify('false') },
  build: { outDir: 'demo-build', cssCodeSplit: false, lib: { entry: 'src/demo.jsx', name: 'ControlEmprende', formats: ['iife'], fileName: () => 'demo.js', cssFileName: 'demo' } },
});

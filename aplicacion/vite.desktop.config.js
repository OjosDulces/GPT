import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({plugins:[react(),tailwindcss()],define:{'import.meta.env.VITE_DESKTOP':JSON.stringify('true'),'import.meta.env.VITE_DEMO_ONLY':JSON.stringify('false'),'import.meta.env.VITE_SUPABASE_URL':JSON.stringify(''),'import.meta.env.VITE_SUPABASE_ANON_KEY':JSON.stringify(''),'import.meta.env.VITE_ENABLE_LEGACY_SHOP':JSON.stringify('false')},build:{outDir:'desktop/web',rollupOptions:{input:'desktop.html'}}});

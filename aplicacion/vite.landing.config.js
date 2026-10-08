import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({plugins:[react(),tailwindcss()],publicDir:false,define:{'process.env.NODE_ENV':JSON.stringify('production')},build:{outDir:'landing-build',cssCodeSplit:false,lib:{entry:'src/landing-demo.jsx',name:'ControlEmprendeLanding',formats:['iife'],fileName:()=> 'landing.js',cssFileName:'landing'}}});

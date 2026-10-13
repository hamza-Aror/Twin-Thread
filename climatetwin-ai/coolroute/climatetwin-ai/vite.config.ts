import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Vite = the development server and production bundler.
// The React plugin compiles JSX; the Tailwind plugin generates the CSS utilities.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173, open: false },
  preview: { port: 4173 },
});

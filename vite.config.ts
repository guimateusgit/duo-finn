import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// CSP só no build final: em dev o React Refresh precisa de script inline.
const csp: Plugin = {
  name: 'duofinn-csp',
  apply: 'build',
  transformIndexHtml: (html) =>
    html.replace(
      '<meta charset="UTF-8" />',
      `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data:" />`
    )
};

// base './' para o index.html funcionar carregado do disco (file://) pelo Electron.
export default defineConfig({
  plugins: [react(), csp],
  base: './',
  server: { port: 5173, strictPort: true },
  build: { outDir: 'dist', emptyOutDir: true }
});

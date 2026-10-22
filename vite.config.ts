import { defineConfig } from 'vite';

export default defineConfig({
  // Relative URLs also work at https://<user>.github.io/<repository>/.
  base: './',
  // Keep this game's address separate from other local projects; never silently switch ports.
  server: { port: 5186, strictPort: true },
});

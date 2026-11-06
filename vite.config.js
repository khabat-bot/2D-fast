import { defineConfig } from 'vite';

// host: true binds to 0.0.0.0 so the iPhone can reach the dev server over
// local Wi-Fi. Vite prints the LAN URL on startup; open that one on the phone.
export default defineConfig({
  server: {
    host: true,
    port: 5173
  },
  build: {
    target: 'es2020'
  }
});

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Some Node/Vite setups only bind [::1]; then http://127.0.0.1:<port> refuses.
    // Listening on all interfaces fixes 127.0.0.1, localhost, and LAN URLs.
    host: true,
  },
})

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Pre-bundle bare imports explicitly so the dependency scanner doesn't
  // need to parse entry files before plugins run.
  optimizeDeps: {
    noDiscovery: true,
    include: ['react', 'react-dom/client', 'react-syntax-highlighter'],
  },
})

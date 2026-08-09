import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const cspHeader = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: https:",
    "font-src 'self' data: https://fonts.gstatic.com",
    "connect-src 'self' https://api.qrserver.com https://api.coingecko.com https://identitytoolkit.googleapis.com https://*.firebaseapp.com",
    "frame-src 'self' https://accounts.google.com https://*.firebaseapp.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests"
  ].join('; ')
}

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@studio': fileURLToPath(new URL('./src/studio', import.meta.url)),
      '@lib': fileURLToPath(new URL('./src/lib', import.meta.url)),
      '@components': fileURLToPath(new URL('./src/components', import.meta.url)),
      '@pages': fileURLToPath(new URL('./src/pages', import.meta.url))
    }
  },
  server: {
    port: 3000,
    host: true,
    headers: {
      'Content-Security-Policy': cspHeader['Content-Security-Policy']
    }
  },
  preview: {
    headers: {
      'Content-Security-Policy': cspHeader['Content-Security-Policy']
    }
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          firebase: ['firebase/app', 'firebase/auth']
        }
      }
    }
  }
})

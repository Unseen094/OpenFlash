import { fileURLToPath, URL } from 'node:url'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Dev/preview CSP. Production headers live in netlify.toml (no 'unsafe-inline').
// 'unsafe-eval' is required by the Studio + player hosts that compile user code;
// those executions are isolated (player runs in an opaque-origin sandbox).
const cspHeader = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: https: blob:",
    "font-src 'self' data: https://fonts.gstatic.com",
    "connect-src 'self' https://api.coingecko.com https://identitytoolkit.googleapis.com https://*.firebaseapp.com https://*.googleapis.com",
    "frame-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
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
    port: 3000,
    host: true,
    headers: {
      'Content-Security-Policy': cspHeader['Content-Security-Policy']
    }
  },
  build: {
    sourcemap: false,
    target: 'es2020',
    cssCodeSplit: true,
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        player: resolve(__dirname, 'player.html')
      },
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          firebase: ['firebase/app', 'firebase/auth']
        }
      }
    }
  }
})

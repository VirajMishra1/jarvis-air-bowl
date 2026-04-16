import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
  },
  build: {
    target: 'es2020',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          mediapipe: ['@mediapipe/hands', '@mediapipe/pose'],
          three: ['three', '@react-three/fiber', '@react-three/drei', '@react-three/cannon'],
        },
      },
    },
  },
})

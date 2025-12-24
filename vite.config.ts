import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  build: {
    rollupOptions: {
      external: [
        '@mediapipe/hands',
        '@tensorflow/tfjs',
        '@tensorflow-models/handpose',
        'three'
      ]
    }
  },
  optimizeDeps: {
    exclude: [
      '@mediapipe/hands',
      '@tensorflow/tfjs',
      '@tensorflow-models/handpose',
      'three'
    ]
  }
})

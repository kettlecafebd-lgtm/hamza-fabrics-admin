import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    hmr: {
      protocol: 'ws',
      host: 'localhost',
    },
  },
  build: {
    chunkSizeWarningLimit: 1500, // ওয়ার্নিং লিমিট বাড়িয়ে ১৫০০ KB করে দেওয়া হলো
    rollupOptions: {
      output: {
        manualChunks(id) {
          // থার্ড-পার্টি লাইব্রেরিগুলোকে 'vendor' নামের আলাদা ফাইলে ভাগ করা
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        }
      }
    }
  }
})
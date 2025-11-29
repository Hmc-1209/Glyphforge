import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load configuration
const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf-8'))

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      [`/${config.promptFolder.name}`]: {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      [`/${config.loraFolder.name}`]: {
        target: 'http://localhost:3001',
        changeOrigin: true,
      }
    }
  }
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { APP_NAME } from './src/brand.ts'

// Stamped into both the bundle (__BUILD_ID__) and dist/version.json so a
// long-lived tab can tell when a newer deploy is live.
const buildId = Date.now().toString()

export default defineConfig({
  // Fixed port so the SwiftBar control panel can find it — 5181 per the canonical port map.
  server: { port: 5181, strictPort: true },
  define: { __BUILD_ID__: JSON.stringify(buildId) },
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'brand-html',
      transformIndexHtml: (html) => html.replaceAll('%APP_NAME%', APP_NAME),
    },
    {
      name: 'version-json',
      apply: 'build',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ buildId }) })
      },
    },
  ],
})

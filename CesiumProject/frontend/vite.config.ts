import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import path from 'path'
import fs from 'fs'

// https://vite.dev/config/
// Build base path for Cesium package inside this frontend project
const cesiumBase = path.resolve(__dirname, 'node_modules', 'cesium', 'Build', 'Cesium')

// Helper: only include copy targets that actually exist to avoid plugin errors
const cesiumParts = ['Workers', 'Assets', 'Widgets', 'ThirdParty']
const copyTargets: Array<{ src: string; dest: string }> = []
for (const part of cesiumParts) {
  const partPath = path.join(cesiumBase, part)
  if (fs.existsSync(partPath)) {
    // Normalize to POSIX-style path and use a glob pattern so the plugin
    // can match files on Windows (it expects forward slashes in globs).
    const normalized = partPath.split(path.sep).join('/')
    const srcGlob = `${normalized}/**/*`
    copyTargets.push({ src: srcGlob, dest: path.posix.join('cesium', part) })
  } else {
    // keep console message light during config time
    // Vite will still run; user should ensure cesium is installed or use manual copy
    // eslint-disable-next-line no-console
    console.warn(`vite config: Cesium part not found: ${partPath}`)
  }
}

export default defineConfig({
  plugins: [
    react(),
    // Only add the static copy plugin when at least one target exists
    ...(copyTargets.length
      ? [
          viteStaticCopy({
            targets: copyTargets
          })
        ]
      : [])
  ]
})

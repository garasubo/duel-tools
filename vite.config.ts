import { resolve } from 'node:path'
import { mkdirSync, readdirSync, renameSync, rmdirSync, statSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vitest/config'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'

// エントリ HTML は pages/ 以下にまとめているが、公開 URL はディレクトリ名を含めず
// /record/ や /combo/ にしたい。ビルド出力後に dist/pages/ 以下を dist/ 直下へ移動する。
// （HTML 内の asset 参照はすべて絶対パスなので、ファイル位置を変えても壊れない）
function flattenPagesHtml(): Plugin {
  return {
    name: 'flatten-pages-html',
    apply: 'build',
    writeBundle(options) {
      const outDir = options.dir ?? resolve(__dirname, 'dist')
      const pagesDir = resolve(outDir, 'pages')
      const move = (from: string, to: string) => {
        for (const entry of readdirSync(from)) {
          const src = resolve(from, entry)
          const dest = resolve(to, entry)
          if (statSync(src).isDirectory()) {
            mkdirSync(dest, { recursive: true })
            move(src, dest)
            rmdirSync(src)
          } else {
            renameSync(src, dest)
          }
        }
      }
      try {
        move(pagesDir, outDir)
        rmdirSync(pagesDir)
      } catch {
        // pages/ が無ければ何もしない
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: '/duel-tools/',
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
    flattenPagesHtml(),
  ],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        record: resolve(__dirname, 'pages/record/index.html'),
        combo: resolve(__dirname, 'pages/combo/index.html'),
        overlay: resolve(__dirname, 'pages/record/overlay/index.html'),
      },
    },
  },
  test: {
    environment: 'node',
  },
})

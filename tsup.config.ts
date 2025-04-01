import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['server.ts'],
  format: ['esm'],
  clean: true,
  splitting: false,
  target: 'es2022',
  platform: 'node',
  external: ['sharp'], // 将 sharp 标记为外部依赖
  esbuildOptions(options) {
      options.define = {
        'process.env.VERSION': `"${require('./package.json').version}"`
    }
  }
})
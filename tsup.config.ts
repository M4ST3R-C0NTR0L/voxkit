import { defineConfig } from 'tsup'

export default defineConfig([
  // Library entry points
  {
    entry: {
      index: 'src/index.ts',
      'providers/index': 'src/providers/index.ts',
    },
    format: ['esm'],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: false,
    target: 'es2022',
    platform: 'node',
    minify: false,
    outDir: 'dist',
  },
  // CLI — separate config so we can inject shebang only on the CLI file
  {
    entry: {
      'cli/index': 'src/cli/index.ts',
    },
    format: ['esm'],
    dts: false,
    splitting: false,
    sourcemap: true,
    clean: false,
    target: 'es2022',
    platform: 'node',
    minify: false,
    outDir: 'dist',
    banner: {
      js: '#!/usr/bin/env node'
    },
  }
])

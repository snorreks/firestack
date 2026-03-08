import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    main: 'src/main.ts',
  },
  format: 'esm',
  platform: 'node',
  splitting: false,
  sourcemap: true,
  dts: true,
  outDir: 'dist',
  clean: true,
  external: ['firebase-functions', 'firebase-tools', /^firebase-/],
});

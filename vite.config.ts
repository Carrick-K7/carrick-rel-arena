import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const basePath = normalizeBasePath(process.env.APP_BASE_PATH);

export default defineConfig({
  base: basePath,
  plugins: [react()],
  root: '.',
  build: {
    outDir: 'dist/client',
    emptyOutDir: true,
    target: 'es2022',
  },
});

function normalizeBasePath(value: string | undefined): string {
  const segment = value?.trim().replace(/^\/+|\/+$/g, '') ?? '';
  return segment ? `/${segment}/` : '/';
}

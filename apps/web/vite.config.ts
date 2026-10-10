import { execFileSync } from 'node:child_process';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

function git(...args: string[]): string | undefined {
  try {
    return execFileSync('git', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return undefined;
  }
}

// The commit and the build time, shown in the console and the settings
// (see src/appVersion.ts). Vercel names the commit it builds.
const appVersion = {
  commit:
    process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ??
    git('rev-parse', '--short', 'HEAD') ??
    'nieznana',
  changed: !process.env.VERCEL && Boolean(git('status', '--porcelain')),
  builtAt: new Date().toISOString(),
};

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __MRUOS_VERSION__: JSON.stringify(appVersion),
  },
  test: {
    environment: 'jsdom',
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        // E2E points the proxy at its own API instance.
        target: process.env.MRUOS_API_PROXY_TARGET ?? 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});

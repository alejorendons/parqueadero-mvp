import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['tests/web/**/*.test.tsx'],
    setupFiles: ['tests/web/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['app/parking-app.tsx', 'app/parking/**/*.{ts,tsx,mjs}'],
      reportsDirectory: 'coverage/web',
      reporter: ['text', 'lcov'],
    },
  },
});

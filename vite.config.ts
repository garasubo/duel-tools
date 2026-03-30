import { defineConfig } from 'vite';
import { reactRouter } from '@react-router/dev/vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => ({
  base: mode === 'development' ? '/duel-tools' : '/duel-tools/',
  plugins: [reactRouter(), tailwindcss()],
}));

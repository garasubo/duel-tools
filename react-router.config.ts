import type { Config } from '@react-router/dev/config';

export default {
  appDirectory: 'src',
  ssr: false,
  basename: '/duel-tools',
  async prerender() {
    return ['/', '/record', '/combo'];
  },
} satisfies Config;

import { type RouteConfig, index, layout, route } from '@react-router/dev/routes';

export default [
  index('routes/index.tsx'),

  layout('components/AppShell.tsx', [
    route('record', 'pages/RecordPage.tsx'),
  ]),

  layout('components/ComboAppShell.tsx', [
    route('combo', 'pages/ComboPage.tsx'),
  ]),
] satisfies RouteConfig;

import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { BattlesProvider } from './state/BattlesProvider';
import AppShell from './components/AppShell';
import ComboAppShell from './components/ComboAppShell';
import RecordPage from './pages/RecordPage';
import HistoryPage from './pages/HistoryPage';
import StatsPage from './pages/StatsPage';
import ManagePage from './pages/ManagePage';
import OverlayPage from './pages/OverlayPage';
import ComboPage from './pages/ComboPage';

const basename = import.meta.env.BASE_URL.replace(/\/$/, '');

const router = createBrowserRouter(
  [
    { path: '/', element: <Navigate to="/record" replace /> },
    {
      element: <AppShell />,
      children: [
        { path: '/record', element: <RecordPage /> },
        { path: '/record/history', element: <HistoryPage /> },
        { path: '/record/history/:recordId', element: <HistoryPage /> },
        { path: '/record/stats', element: <StatsPage /> },
        { path: '/record/manage', element: <ManagePage /> },
      ],
    },
    { path: '/record/overlay', element: <OverlayPage /> },
    {
      element: <ComboAppShell />,
      children: [{ path: '/combo', element: <ComboPage /> }],
    },
  ],
  { basename },
);

export default function App() {
  return (
    <BattlesProvider>
      <RouterProvider router={router} />
    </BattlesProvider>
  );
}

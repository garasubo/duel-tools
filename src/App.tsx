import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { BattlesProvider } from './context/BattlesContext';
import AppShell from './components/AppShell';
import RecordPage from './pages/RecordPage';
import HistoryPage from './pages/HistoryPage';
import StatsPage from './pages/StatsPage';
import OverlayPage from './pages/OverlayPage';

const router = createBrowserRouter(
  [
    { path: '/', element: <Navigate to="/record" replace /> },
    {
      element: <AppShell />,
      children: [
        { path: '/record', element: <RecordPage /> },
        { path: '/history', element: <HistoryPage /> },
        { path: '/history/:recordId', element: <HistoryPage /> },
        { path: '/stats', element: <StatsPage /> },
      ],
    },
    { path: '/overlay', element: <OverlayPage /> },
  ],
  { basename: '/duel-tools' },
);

export default function App() {
  return (
    <BattlesProvider>
      <RouterProvider router={router} />
    </BattlesProvider>
  );
}

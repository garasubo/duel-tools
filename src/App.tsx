import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { BattlesProvider } from './context/BattlesContext';
import ComboAppShell from './components/ComboAppShell';
import RecordSection from './components/RecordSection';
import ComboPage from './pages/ComboPage';

const router = createBrowserRouter(
  [
    { path: '/', element: <Navigate to="/record" replace /> },
    { path: '/record', element: <RecordSection /> },
    {
      element: <ComboAppShell />,
      children: [{ path: '/combo', element: <ComboPage /> }],
    },
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

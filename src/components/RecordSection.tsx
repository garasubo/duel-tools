import { useLocation } from 'react-router-dom';
import AppShell from './AppShell';
import RecordPage from '../pages/RecordPage';
import HistoryPage from '../pages/HistoryPage';
import StatsPage from '../pages/StatsPage';
import OverlayPage from '../pages/OverlayPage';

export default function RecordSection() {
  const { hash } = useLocation();

  if (hash === '#overlay') {
    return <OverlayPage />;
  }

  const page =
    hash === '#history' ? (
      <HistoryPage />
    ) : hash === '#stats' ? (
      <StatsPage />
    ) : (
      <RecordPage />
    );

  return <AppShell>{page}</AppShell>;
}

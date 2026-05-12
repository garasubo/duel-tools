import { OverlayStatsPanel } from '../components/stats/OverlayStatsPanel';

export default function OverlayPage() {
  return (
    <div className="flex items-center justify-center h-screen bg-gray-900">
      <OverlayStatsPanel variant="overlay" />
    </div>
  );
}

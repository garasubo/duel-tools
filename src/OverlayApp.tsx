import { BattlesProvider } from './context/BattlesContext';
import OverlayPage from './pages/OverlayPage';

export default function OverlayApp() {
  return (
    <BattlesProvider>
      <OverlayPage />
    </BattlesProvider>
  );
}

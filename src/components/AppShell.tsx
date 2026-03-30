import { Outlet, useLocation } from 'react-router';
import NavTabs from './NavTabs';
import ToolSwitcher from './ToolSwitcher';
import HistoryPage from '../pages/HistoryPage';
import StatsPage from '../pages/StatsPage';
import OverlayPage from '../pages/OverlayPage';

export default function AppShell() {
  const { hash } = useLocation();

  if (hash === '#overlay') return <OverlayPage />;

  let content: React.ReactNode;
  if (hash === '#history') content = <HistoryPage />;
  else if (hash === '#stats') content = <StatsPage />;
  else content = <Outlet />;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-3">
        <h1 className="text-lg font-bold text-gray-900">duel-tools</h1>
        <ToolSwitcher />
      </header>
      <NavTabs />
      <main className="flex-1 overflow-y-auto">{content}</main>
    </div>
  );
}

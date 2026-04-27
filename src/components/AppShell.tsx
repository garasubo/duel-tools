import { Outlet } from 'react-router-dom';
import { CaptureProvider } from '../capture/CaptureContext';
import NavTabs from './NavTabs';
import ToolSwitcher from './ToolSwitcher';

export default function AppShell() {
  return (
    <CaptureProvider>
      <div className="min-h-screen flex flex-col bg-gray-50">
        <header className="bg-white border-b border-gray-200 px-4 py-3">
          <h1 className="text-lg font-bold text-gray-900">duel-tools</h1>
          <ToolSwitcher />
        </header>
        <NavTabs />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </CaptureProvider>
  );
}

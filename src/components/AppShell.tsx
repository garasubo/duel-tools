import { Outlet } from 'react-router-dom';
import { CaptureProvider } from '../capture/CaptureContext';
import BrandLogo from './BrandLogo';
import NavTabs from './NavTabs';
import ToolSwitcher from './ToolSwitcher';

export default function AppShell() {
  return (
    <CaptureProvider>
      <div className="min-h-screen flex flex-col bg-brand-canvas text-brand-ink">
        <header className="border-b border-brand-cyan/30 bg-brand-surface px-4 py-3">
          <h1>
            <BrandLogo />
          </h1>
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

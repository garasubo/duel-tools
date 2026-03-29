import { Outlet } from 'react-router-dom';
import ToolSwitcher from './ToolSwitcher';

export default function ComboAppShell() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-3">
        <h1 className="text-lg font-bold text-gray-900">duel-tools</h1>
        <ToolSwitcher />
      </header>
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}

import { NavLink } from 'react-router-dom';

export type TabId = 'record' | 'history' | 'stats';

const TABS: { id: TabId; label: string; to: string }[] = [
  { id: 'record', label: '記録する', to: '/record' },
  { id: 'history', label: '履歴', to: '/record/history' },
  { id: 'stats', label: '統計', to: '/record/stats' },
];

export default function NavTabs() {
  return (
    <nav role="tablist" className="flex border-b border-gray-200 bg-white">
      {TABS.map((tab) => (
        <NavLink
          key={tab.id}
          to={tab.to}
          role="tab"
          end={tab.id !== 'history'}
          className={({ isActive }) =>
            [
              'flex-1 py-3 text-sm font-medium transition-colors duration-150 text-center',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500',
              isActive
                ? 'border-b-2 border-indigo-600 text-indigo-600'
                : 'text-gray-500 hover:text-gray-700 hover:border-b-2 hover:border-gray-300',
            ].join(' ')
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}

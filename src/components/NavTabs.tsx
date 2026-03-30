import { Link, useLocation } from 'react-router';

type TabId = 'record' | 'history' | 'stats';

const TABS: { id: TabId; label: string; hash: string }[] = [
  { id: 'record', label: '記録する', hash: '' },
  { id: 'history', label: '履歴', hash: '#history' },
  { id: 'stats', label: '統計', hash: '#stats' },
];

const activeClass = 'border-b-2 border-indigo-600 text-indigo-600';
const inactiveClass = 'text-gray-500 hover:text-gray-700 hover:border-b-2 hover:border-gray-300';
const base =
  'flex-1 py-3 text-sm font-medium transition-colors duration-150 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500';

export default function NavTabs() {
  const { hash } = useLocation();

  return (
    <nav role="tablist" className="flex border-b border-gray-200 bg-white">
      {TABS.map((tab) => {
        const isActive = tab.hash === '' ? !hash : hash === tab.hash;
        return (
          <Link
            key={tab.id}
            to={`/record${tab.hash}`}
            role="tab"
            className={`${base} ${isActive ? activeClass : inactiveClass}`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

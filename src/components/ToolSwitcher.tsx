import { NavLink, useLocation } from 'react-router-dom';

export default function ToolSwitcher() {
  const { pathname } = useLocation();
  const isCombo = pathname.startsWith('/combo');

  const activeClass = 'text-brand-action border-b-2 border-brand-action';
  const inactiveClass = 'text-gray-600 hover:text-brand-ink';
  const base = 'px-3 py-1 text-sm font-medium transition-colors duration-150';

  return (
    <div className="flex gap-2 mt-1">
      <NavLink to="/record" className={`${base} ${!isCombo ? activeClass : inactiveClass}`}>
        戦績ツール
      </NavLink>
      <NavLink to="/combo" className={`${base} ${isCombo ? activeClass : inactiveClass}`}>
        初手組み合わせ
      </NavLink>
    </div>
  );
}

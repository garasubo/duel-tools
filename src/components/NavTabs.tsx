export type TabId = "record" | "history" | "stats";

const TABS: { id: TabId; label: string }[] = [
  { id: "record", label: "記録する" },
  { id: "history", label: "履歴" },
  { id: "stats", label: "統計" },
];

interface NavTabsProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

export default function NavTabs({ activeTab, onTabChange }: NavTabsProps) {
  return (
    <nav role="tablist" className="flex border-b border-gray-200 bg-white">
      {TABS.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onTabChange(tab.id)}
            className={[
              "flex-1 py-3 text-sm font-medium transition-colors duration-150",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500",
              isActive
                ? "border-b-2 border-indigo-600 text-indigo-600"
                : "text-gray-500 hover:text-gray-700 hover:border-b-2 hover:border-gray-300",
            ].join(" ")}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}

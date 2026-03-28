import { useState } from "react";
import NavTabs, { type TabId } from "./NavTabs";
import RecordPage from "../pages/RecordPage";
import HistoryPage from "../pages/HistoryPage";
import StatsPage from "../pages/StatsPage";

// pageMap はプレースホルダー期間中はprops不要のためコンポーネント外で定義
// フェーズ5-7でページにpropsが必要になった場合はコンポーネント内に移動する
const pageMap: Record<TabId, React.ReactNode> = {
  record: <RecordPage />,
  history: <HistoryPage />,
  stats: <StatsPage />,
};

export default function AppShell() {
  const [activeTab, setActiveTab] = useState<TabId>("record");

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-3">
        <h1 className="text-lg font-bold text-gray-900">duel-tools</h1>
      </header>
      <NavTabs activeTab={activeTab} onTabChange={setActiveTab} />
      <main className="flex-1 overflow-y-auto">{pageMap[activeTab]}</main>
    </div>
  );
}

import { BattlesProvider } from "./context/BattlesContext";
import AppShell from "./components/AppShell";

export default function App() {
  return (
    <BattlesProvider>
      <AppShell />
    </BattlesProvider>
  );
}

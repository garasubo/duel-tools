import ToggleButton, {
  ToggleButtonGroup,
} from "../ui/ToggleButton";
import type { BattleResult } from "../../types";

const OPTIONS: { value: BattleResult; label: string }[] = [
  { value: "win", label: "勝ち" },
  { value: "loss", label: "負け" },
  { value: "draw", label: "引き分け" },
];

export interface ResultSelectorProps {
  value: BattleResult | null;
  onChange: (result: BattleResult) => void;
}

export default function ResultSelector({
  value,
  onChange,
}: ResultSelectorProps) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-medium text-gray-700">勝敗</span>
      <ToggleButtonGroup label="勝敗選択">
        {OPTIONS.map((opt) => (
          <ToggleButton
            key={opt.value}
            isSelected={value === opt.value}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </div>
  );
}

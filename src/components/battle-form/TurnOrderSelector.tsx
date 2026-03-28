import ToggleButton, {
  ToggleButtonGroup,
} from "../ui/ToggleButton";
import type { TurnOrder } from "../../types";

const OPTIONS: { value: TurnOrder; label: string }[] = [
  { value: "first", label: "先行" },
  { value: "second", label: "後攻" },
];

export interface TurnOrderSelectorProps {
  value: TurnOrder | null;
  onChange: (order: TurnOrder) => void;
}

export default function TurnOrderSelector({
  value,
  onChange,
}: TurnOrderSelectorProps) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-medium text-gray-700">手番</span>
      <ToggleButtonGroup label="手番選択">
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

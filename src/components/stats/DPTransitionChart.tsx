import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { LineProps } from "recharts";
import type { BattleRecord } from "../../types";

interface DPDataPoint {
  index: number;
  dp: number;
  result: "win" | "loss";
  createdAt: string;
}

type LineDotProps = Extract<
  NonNullable<LineProps<DPDataPoint>["dot"]>,
  (...args: never[]) => React.ReactNode
> extends (props: infer P) => React.ReactNode
  ? P
  : never;

type CustomDotProps = LineDotProps & {
  payload?: DPDataPoint;
};

function CustomDot(props: CustomDotProps) {
  const { cx, cy, payload } = props;
  if (cx === undefined || cy === undefined || !payload) return null;
  const color = payload.result === "win" ? "#22c55e" : "#ef4444";
  return (
    <circle cx={cx} cy={cy} r={4} fill={color} stroke="white" strokeWidth={1} />
  );
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: DPDataPoint }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;
  const date = new Date(d.createdAt).toLocaleString("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-2 text-sm">
      <p className="font-semibold">{d.dp.toLocaleString()} DP</p>
      <p className={d.result === "win" ? "text-green-600" : "text-red-500"}>
        {d.result === "win" ? "勝利" : "敗北"}
      </p>
      <p className="text-gray-400 text-xs">{date}</p>
    </div>
  );
}

interface Props {
  records: BattleRecord[];
}

export default function DPTransitionChart({ records }: Props) {
  const data: DPDataPoint[] = records
    .filter((r) => r.battleMode === "duelists-cup" && r.score !== undefined)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((r, i) => ({
      index: i + 1,
      dp: r.score as number,
      result: r.result,
      createdAt: r.createdAt,
    }));

  if (data.length === 0) return null;

  const dps = data.map((d) => d.dp);
  const minDp = Math.min(...dps);
  const maxDp = Math.max(...dps);
  const padding = Math.max(1000, Math.round((maxDp - minDp) * 0.1));
  const yMin = Math.max(0, Math.floor((minDp - padding) / 1000) * 1000);
  const yMax = Math.ceil((maxDp + padding) / 1000) * 1000;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h2 className="text-base font-semibold text-gray-800 mb-4">
        デュエリストカップ DP推移
      </h2>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart
          data={data}
          margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
        >
          <XAxis
            dataKey="index"
            label={{
              value: "対戦数",
              position: "insideBottomRight",
              offset: -4,
              fontSize: 12,
            }}
            tick={{ fontSize: 11 }}
          />
          <YAxis
            domain={[yMin, yMax]}
            tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
            tick={{ fontSize: 11 }}
            width={36}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="dp"
            stroke="#6366f1"
            strokeWidth={2}
            dot={CustomDot}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
      <p className="text-xs text-gray-400 mt-1 text-right">全{data.length}戦</p>
    </div>
  );
}

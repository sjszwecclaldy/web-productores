import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useContext } from 'react';
import { CHART_COLORS, formatMonthYear } from '../chartUtils';
import { ChartHeightContext } from './ChartHeightContext';
import { fmt } from '../utils';

function isSameMonth(a, b) {
  if (!a || !b) return false;
  return String(a).slice(0, 7) === String(b).slice(0, 7);
}

// Etiquetas del eje Y compactas y legibles: 12,3 M / 450 k / 980.
function fmtEjeCompacto(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '';
  const abs = Math.abs(n);
  if (abs >= 1e6) return `${(n / 1e6).toFixed(1).replace('.', ',').replace(',0', '')} M`;
  if (abs >= 1e3) return `${Math.round(n / 1e3)} k`;
  return String(Math.round(n));
}

export default function MonthlyBarChart({
  data,
  bars,
  selectedMonth,
  onMonthSelect,
  emptyMessage = 'Sin datos para el período',
}) {
  const ctxHeight = useContext(ChartHeightContext);

  if (!data || data.length === 0) {
    return <p className="chart-empty">{emptyMessage}</p>;
  }

  const defaultBars = [
    { key: 'importe', label: 'Importe', color: CHART_COLORS.primary },
    { key: 'litros', label: 'Litros', color: CHART_COLORS.accent },
  ];

  const series = bars || defaultBars;

  function handleClick(state) {
    const payload = state?.activePayload?.[0]?.payload;
    if (payload?.month && onMonthSelect) {
      onMonthSelect(String(payload.month).slice(0, 7));
    }
  }

  return (
    <ResponsiveContainer width="100%" height={ctxHeight ?? 280}>
      <BarChart
        data={data}
        margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        onClick={handleClick}
        style={{ cursor: onMonthSelect ? 'pointer' : undefined }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.muted} vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#5a6d62' }} />
        <YAxis
          tick={{ fontSize: 11, fill: '#5a6d62' }}
          width={64}
          domain={[0, 'auto']}
          allowDecimals={false}
          tickFormatter={fmtEjeCompacto}
        />
        <Tooltip
          formatter={(value, name) => {
            const s = series.find((b) => b.key === name);
            return [fmt(value), s?.label || name];
          }}
          labelFormatter={(l, p) => (p && p[0] && p[0].payload.month ? formatMonthYear(p[0].payload.month) : l)}
          contentStyle={{ borderRadius: 8, border: '1px solid #ccddd4' }}
        />
        <Legend
          formatter={(value) => series.find((b) => b.key === value)?.label || value}
          wrapperStyle={{ fontSize: 12 }}
        />
        {series.map(({ key, color }) => (
          <Bar key={key} dataKey={key} name={key} fill={color} radius={[4, 4, 0, 0]} maxBarSize={32}>
            {data.map((entry) => (
              <Cell
                key={`${key}-${entry.month}`}
                fill={isSameMonth(selectedMonth, entry.month) ? CHART_COLORS.gold : color}
              />
            ))}
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

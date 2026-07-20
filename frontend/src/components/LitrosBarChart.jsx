import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useContext } from 'react';
import { CHART_COLORS } from '../chartUtils';
import { ChartHeightContext } from './ChartHeightContext';
import { fmt } from '../utils';

function isSameChartDate(a, b) {
  if (!a || !b) return false;
  return String(a).slice(0, 10) === String(b).slice(0, 10);
}

export default function LitrosBarChart({
  data,
  selectedDate,
  onDateSelect,
  emptyMessage = 'Sin datos para el período',
}) {
  const ctxHeight = useContext(ChartHeightContext);

  if (!data || data.length === 0) {
    return <p className="chart-empty">{emptyMessage}</p>;
  }

  function handleClick(state) {
    const payload = state?.activePayload?.[0]?.payload;
    if (payload?.date && onDateSelect) {
      onDateSelect(String(payload.date).slice(0, 10));
    }
  }

  return (
    <ResponsiveContainer width="100%" height={ctxHeight ?? 280}>
      <BarChart
        data={data}
        margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        onClick={handleClick}
        style={{ cursor: onDateSelect ? 'pointer' : undefined }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.muted} vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: '#5a6d62' }}
          interval="preserveStartEnd"
        />
        <YAxis tick={{ fontSize: 11, fill: '#5a6d62' }} width={48} />
        <Tooltip
          formatter={(value) => [`${fmt(value)} L`, 'Litros']}
          labelFormatter={(label) => label}
          contentStyle={{ borderRadius: 8, border: '1px solid #ccddd4' }}
        />
        <Bar dataKey="total" radius={[4, 4, 0, 0]} maxBarSize={48}>
          {data.map((entry) => (
            <Cell
              key={entry.date}
              fill={isSameChartDate(selectedDate, entry.date) ? CHART_COLORS.gold : CHART_COLORS.primary}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

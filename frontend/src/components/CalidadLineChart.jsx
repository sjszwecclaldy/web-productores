import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
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

function renderDot(color, selectedDate, onDateSelect) {
  return (props) => {
    const { cx, cy, payload } = props;
    if (cx == null || cy == null) return null;
    const selected = isSameChartDate(selectedDate, payload.date);
    return (
      <circle
        cx={cx}
        cy={cy}
        r={selected ? 7 : 4}
        fill={selected ? CHART_COLORS.gold : color}
        stroke={selected ? CHART_COLORS.primary : '#fff'}
        strokeWidth={selected ? 2 : 1}
        style={{ cursor: onDateSelect ? 'pointer' : undefined }}
        onClick={(e) => {
          e.stopPropagation();
          if (payload?.date && onDateSelect) onDateSelect(String(payload.date).slice(0, 10));
        }}
      />
    );
  };
}

export default function CalidadLineChart({
  data,
  series,
  selectedDate,
  onDateSelect,
  emptyMessage = 'Sin datos para el período',
}) {
  const ctxHeight = useContext(ChartHeightContext);

  if (!data || data.length === 0) {
    return <p className="chart-empty">{emptyMessage}</p>;
  }

  const defaultSeries = [
    { key: 'fat', label: 'Grasa %', color: CHART_COLORS.primary },
    { key: 'protein', label: 'Proteína %', color: CHART_COLORS.accent },
  ];

  const lines = series || defaultSeries;

  function handleClick(state) {
    const payload = state?.activePayload?.[0]?.payload;
    if (payload?.date && onDateSelect) {
      onDateSelect(String(payload.date).slice(0, 10));
    }
  }

  return (
    <ResponsiveContainer width="100%" height={ctxHeight ?? 280}>
      <LineChart
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
        <YAxis tick={{ fontSize: 11, fill: '#5a6d62' }} width={40} />
        <Tooltip
          formatter={(value, name) => {
            const s = lines.find((l) => l.key === name);
            return [fmt(value), s?.label || name];
          }}
          contentStyle={{ borderRadius: 8, border: '1px solid #ccddd4' }}
        />
        <Legend
          formatter={(value) => lines.find((l) => l.key === value)?.label || value}
          wrapperStyle={{ fontSize: 12 }}
        />
        {lines.map(({ key, color }) => (
          <Line
            key={key}
            name={key}
            type="monotone"
            dataKey={key}
            stroke={color}
            strokeWidth={2}
            dot={renderDot(color, selectedDate, onDateSelect)}
            activeDot={false}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

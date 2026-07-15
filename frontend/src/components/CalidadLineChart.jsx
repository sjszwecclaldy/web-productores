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
import { CHART_COLORS } from '../chartUtils';

export default function CalidadLineChart({ data, series, emptyMessage = 'Sin datos para el período' }) {
  if (!data || data.length === 0) {
    return <p className="chart-empty">{emptyMessage}</p>;
  }

  const defaultSeries = [
    { key: 'fat', label: 'Grasa %', color: CHART_COLORS.primary },
    { key: 'protein', label: 'Proteína %', color: CHART_COLORS.accent },
  ];

  const lines = series || defaultSeries;

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
            return [`${Number(value).toFixed(2)}`, s?.label || name];
          }}
          contentStyle={{ borderRadius: 8, border: '1px solid #ccddd4' }}
        />
        <Legend
          formatter={(value) => lines.find((l) => l.key === value)?.label || value}
          wrapperStyle={{ fontSize: 12 }}
        />
        {lines.map(({ key, label, color }) => (
          <Line
            key={key}
            name={key}
            type="monotone"
            dataKey={key}
            stroke={color}
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

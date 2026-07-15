import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CHART_COLORS } from '../chartUtils';

export default function MonthlyBarChart({
  data,
  bars,
  emptyMessage = 'Sin datos para el período',
}) {
  if (!data || data.length === 0) {
    return <p className="chart-empty">{emptyMessage}</p>;
  }

  const defaultBars = [
    { key: 'importe', label: 'Importe', color: CHART_COLORS.primary },
    { key: 'litros', label: 'Litros', color: CHART_COLORS.accent },
  ];

  const series = bars || defaultBars;

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.muted} vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#5a6d62' }} />
        <YAxis tick={{ fontSize: 11, fill: '#5a6d62' }} width={56} />
        <Tooltip
          formatter={(value, name) => {
            const s = series.find((b) => b.key === name);
            const n = Number(value);
            return [n.toLocaleString('es-AR', { maximumFractionDigits: 2 }), s?.label || name];
          }}
          contentStyle={{ borderRadius: 8, border: '1px solid #ccddd4' }}
        />
        <Legend
          formatter={(value) => series.find((b) => b.key === value)?.label || value}
          wrapperStyle={{ fontSize: 12 }}
        />
        {series.map(({ key, label, color }) => (
          <Bar key={key} dataKey={key} name={key} fill={color} radius={[4, 4, 0, 0]} maxBarSize={32} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

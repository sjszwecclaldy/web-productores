import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CHART_COLORS } from '../chartUtils';

export default function LitrosBarChart({ data, emptyMessage = 'Sin datos para el período' }) {
  if (!data || data.length === 0) {
    return <p className="chart-empty">{emptyMessage}</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.muted} vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: '#5a6d62' }}
          interval="preserveStartEnd"
        />
        <YAxis tick={{ fontSize: 11, fill: '#5a6d62' }} width={48} />
        <Tooltip
          formatter={(value) => [`${Number(value).toLocaleString('es-AR')} L`, 'Litros']}
          labelFormatter={(label) => label}
          contentStyle={{ borderRadius: 8, border: '1px solid #ccddd4' }}
        />
        <Bar dataKey="total" fill={CHART_COLORS.primary} radius={[4, 4, 0, 0]} maxBarSize={48} />
      </BarChart>
    </ResponsiveContainer>
  );
}

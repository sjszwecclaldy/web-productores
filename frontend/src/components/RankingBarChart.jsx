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
import { CHART_COLORS } from '../chartUtils';
import { fmt } from '../utils';

export default function RankingBarChart({
  data,
  dataKey,
  color = CHART_COLORS.primary,
  unit = '',
  emptyMessage = 'Sin datos para el período',
}) {
  if (!data || data.length === 0) {
    return <p className="chart-empty">{emptyMessage}</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(220, data.length * 34)}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.muted} horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11, fill: '#5a6d62' }} />
        <YAxis
          type="category"
          dataKey="card_name"
          width={150}
          tick={{ fontSize: 11, fill: '#5a6d62' }}
        />
        <Tooltip
          formatter={(v) => [`${fmt(v)}${unit ? ` ${unit}` : ''}`, '']}
          contentStyle={{ borderRadius: 8, border: '1px solid #ccddd4' }}
        />
        <Bar dataKey={dataKey} radius={[0, 4, 4, 0]} maxBarSize={22}>
          {data.map((e) => (
            <Cell key={e.card_code} fill={color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

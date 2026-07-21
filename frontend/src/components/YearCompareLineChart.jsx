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

const YEAR_COLORS = [CHART_COLORS.primary, CHART_COLORS.accent, CHART_COLORS.gold, '#8a6d3b', '#5a6d62'];

// Comparación de años: una línea por año, eje X = meses (Ene–Dic).
export default function YearCompareLineChart({ data, years, unit = 'L', emptyMessage = 'Sin datos para comparar' }) {
  const ctxHeight = useContext(ChartHeightContext);

  if (!data || data.length === 0 || !years || years.length === 0) {
    return <p className="chart-empty">{emptyMessage}</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={ctxHeight ?? 300}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.muted} vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#5a6d62' }} />
        <YAxis tick={{ fontSize: 11, fill: '#5a6d62' }} width={56} />
        <Tooltip
          formatter={(v, name) => [`${fmt(v)}${unit ? ` ${unit}` : ''}`, name]}
          contentStyle={{ borderRadius: 8, border: '1px solid #ccddd4' }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {years.map((year, i) => (
          <Line
            key={year}
            type="monotone"
            dataKey={year}
            name={String(year)}
            stroke={YEAR_COLORS[i % YEAR_COLORS.length]}
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

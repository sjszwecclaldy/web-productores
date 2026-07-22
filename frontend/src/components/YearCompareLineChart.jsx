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
import { LINE_COLORS, collectChartValues, domainCentered } from '../chartUtils';
import { ChartHeightContext } from './ChartHeightContext';
import { fmt } from '../utils';

// Comparación de años: una línea por año, eje X = meses (Ene–Dic).
export default function YearCompareLineChart({
  data,
  years,
  unit = 'L',
  yDomain,
  emptyMessage = 'Sin datos para comparar',
}) {
  const ctxHeight = useContext(ChartHeightContext);

  if (!data || data.length === 0 || !years || years.length === 0) {
    return <p className="chart-empty">{emptyMessage}</p>;
  }

  const domain = yDomain || domainCentered(collectChartValues(data, years));

  return (
    <ResponsiveContainer width="100%" height={ctxHeight ?? 300}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#ccddd4" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#5a6d62' }} />
        <YAxis domain={domain} tick={{ fontSize: 11, fill: '#5a6d62' }} width={56} allowDataOverflow />
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
            stroke={LINE_COLORS[i % LINE_COLORS.length]}
            strokeWidth={2.25}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useContext } from 'react';
import { CHART_COLORS, formatMonthYear } from '../chartUtils';
import { ChartHeightContext } from './ChartHeightContext';
import { fmt } from '../utils';

// Línea de una serie mensual [{ mes: 'YYYY-MM', valor: number }].
export default function SerieMensualChart({
  data,
  color = CHART_COLORS.primary,
  label = 'Valor',
  unit = '',
  emptyMessage = 'Sin datos para el período',
}) {
  const ctxHeight = useContext(ChartHeightContext);
  const chartData = (data || []).filter((d) => d.valor != null).map((d) => ({ ...d, valor: Number(d.valor) }));

  if (chartData.length === 0) {
    return <p className="chart-empty">{emptyMessage}</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={ctxHeight ?? 280}>
      <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.muted} vertical={false} />
        <XAxis
          dataKey="mes"
          tick={{ fontSize: 11, fill: '#5a6d62' }}
          interval="preserveStartEnd"
          minTickGap={8}
          tickFormatter={(m) => formatMonthYear(m)}
        />
        <YAxis tick={{ fontSize: 11, fill: '#5a6d62' }} width={52} />
        <Tooltip
          formatter={(v) => [`${fmt(v)}${unit ? ' ' + unit : ''}`, label]}
          labelFormatter={(m) => formatMonthYear(m)}
          contentStyle={{ borderRadius: 8, border: '1px solid #ccddd4' }}
        />
        <Line type="monotone" dataKey="valor" stroke={color} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls />
      </LineChart>
    </ResponsiveContainer>
  );
}

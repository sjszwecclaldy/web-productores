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
import { CHART_COLORS, domainCentered } from '../chartUtils';
import { ChartHeightContext } from './ChartHeightContext';
import { fmt } from '../utils';

const MAX_LABEL = 20;

function abreviar(nombre) {
  const s = String(nombre || '').trim();
  if (s.length <= MAX_LABEL) return s;
  return `${s.slice(0, MAX_LABEL - 1).trimEnd()}…`;
}

function YTick({ x, y, payload }) {
  return (
    <text x={x} y={y} dy={4} textAnchor="end" fontSize={11} fill="#5a6d62">
      {abreviar(payload.value)}
    </text>
  );
}

export default function RankingBarChart({
  data,
  dataKey,
  color = CHART_COLORS.primary,
  unit = '',
  xDomain,
  emptyMessage = 'Sin datos para el período',
}) {
  const ctxHeight = useContext(ChartHeightContext);

  if (!data || data.length === 0) {
    return <p className="chart-empty">{emptyMessage}</p>;
  }

  // El backend devuelve los valores numéricos como texto (Postgres numeric).
  // Se convierten a Number para que Recharts escale bien el eje (si no, compara
  // como strings y el máximo del eje queda mal, cortando las barras grandes).
  const chartData = data.map((d) => ({ ...d, [dataKey]: Number(d[dataKey]) }));
  const domain = xDomain || domainCentered(chartData.map((d) => d[dataKey]));

  return (
    <ResponsiveContainer width="100%" height={ctxHeight ?? Math.max(240, chartData.length * 38)}>
      <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 40, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.muted} horizontal={false} />
        <XAxis
          type="number"
          domain={domain}
          tick={{ fontSize: 11, fill: '#5a6d62' }}
          allowDataOverflow
        />
        <YAxis
          type="category"
          dataKey="card_name"
          width={170}
          interval={0}
          tick={<YTick />}
        />
        <Tooltip
          formatter={(v) => [`${fmt(v)}${unit ? ` ${unit}` : ''}`, '']}
          labelFormatter={(label) => label}
          contentStyle={{ borderRadius: 8, border: '1px solid #ccddd4' }}
        />
        <Bar dataKey={dataKey} radius={[0, 4, 4, 0]} maxBarSize={24}>
          {chartData.map((e) => (
            <Cell key={e.card_code} fill={color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

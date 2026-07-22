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
import { useContext, useMemo } from 'react';
import { CHART_COLORS, formatMonthYear } from '../chartUtils';
import { ChartHeightContext } from './ChartHeightContext';
import { fmt } from '../utils';

// Color estable por índice de productor.
function colorFor(i) {
  return `hsl(${(i * 47) % 360} 55% 45%)`;
}

// Grafica una línea por productor a partir de filas [{ mes, card_code, card_name, valor }].
// Con `showPromedio` agrega una línea de promedio del grupo (mes a mes).
export default function MultiProductorChart({
  data,
  showPromedio = false,
  unit = '',
  emptyMessage = 'Sin datos para el período',
}) {
  const ctxHeight = useContext(ChartHeightContext);

  const { chartData, productores } = useMemo(() => {
    const rows = data || [];
    const meses = [...new Set(rows.map((r) => r.mes))].sort();
    const prodMap = new Map();
    rows.forEach((r) => {
      if (!prodMap.has(r.card_code)) prodMap.set(r.card_code, { card_code: r.card_code, card_name: r.card_name });
    });
    const porMes = new Map(meses.map((m) => [m, {}]));
    rows.forEach((r) => {
      if (r.valor != null) porMes.get(r.mes)[r.card_code] = r.valor;
    });
    const cd = meses.map((mes) => {
      const row = { mes, ...porMes.get(mes) };
      if (showPromedio) {
        const vals = [...prodMap.keys()].map((c) => row[c]).filter((v) => v != null);
        row.__prom = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
      }
      return row;
    });
    return { chartData: cd, productores: [...prodMap.values()] };
  }, [data, showPromedio]);

  if (chartData.length === 0) {
    return <p className="chart-empty">{emptyMessage}</p>;
  }

  const mostrarLeyenda = productores.length <= 12;

  return (
    <ResponsiveContainer width="100%" height={ctxHeight ?? 300}>
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
          formatter={(v, name) => [`${fmt(v)}${unit ? ' ' + unit : ''}`, name]}
          labelFormatter={(m) => formatMonthYear(m)}
          contentStyle={{ borderRadius: 8, border: '1px solid #ccddd4' }}
          itemSorter={(it) => -it.value}
        />
        {mostrarLeyenda && <Legend wrapperStyle={{ fontSize: 11 }} />}
        {productores.map((pr, i) => (
          <Line
            key={pr.card_code}
            type="monotone"
            dataKey={pr.card_code}
            name={pr.card_name}
            stroke={colorFor(i)}
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 4 }}
            connectNulls
          />
        ))}
        {showPromedio && (
          <Line
            type="monotone"
            dataKey="__prom"
            name="Promedio del grupo"
            stroke="#12312099"
            strokeWidth={3}
            strokeDasharray="6 4"
            dot={false}
            connectNulls
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}

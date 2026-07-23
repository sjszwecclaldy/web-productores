import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useContext, useMemo } from 'react';
import { CHART_COLORS, LINE_COLORS, domainCentered, formatMonthYear, formatYAxisTick, geometricMean } from '../chartUtils';
import { ChartHeightContext } from './ChartHeightContext';
import { fmt } from '../utils';

const TOP_LINEAS = 5;

// Color estable por ranking del productor (paleta de alto contraste).
function colorFor(rank) {
  return LINE_COLORS[rank % LINE_COLORS.length];
}

// Líneas mensuales (solo top 5 productores por total) + promedio del grupo opcional.
// Al ampliar la tarjeta se agrega debajo un gráfico de barras horizontales con TODOS los productores.
export default function MultiProductorChart({
  data,
  showPromedio = false,
  unit = '',
  agg = 'sum', // 'sum' (litros, liquidación) | 'avg' (células, bacterias → geométrico)
  emptyMessage = 'Sin datos para el período',
}) {
  const ctxHeight = useContext(ChartHeightContext);
  const ampliado = ctxHeight != null;

  const { chartData, topProductores, barData, colorByCode } = useMemo(() => {
    const rows = data || [];
    const meses = [...new Set(rows.map((r) => r.mes))].sort();

    // Total (o promedio geométrico) por productor sobre todo el período.
    const acc = new Map(); // card_code -> { card_code, card_name, valores: number[] }
    rows.forEach((r) => {
      if (!acc.has(r.card_code)) acc.set(r.card_code, { card_code: r.card_code, card_name: r.card_name, valores: [] });
      if (r.valor != null) {
        const n = Number(r.valor);
        if (Number.isFinite(n)) acc.get(r.card_code).valores.push(n);
      }
    });
    const totales = [...acc.values()]
      .map((a) => {
        let total = 0;
        if (agg === 'avg') {
          total = geometricMean(a.valores) ?? 0;
        } else {
          total = a.valores.reduce((s, v) => s + v, 0);
        }
        return { card_code: a.card_code, card_name: a.card_name, total };
      })
      .sort((x, y) => y.total - x.total);

    const colorMap = {};
    totales.forEach((t, i) => { colorMap[t.card_code] = colorFor(i); });

    const top = totales.slice(0, TOP_LINEAS);
    const topCodes = new Set(top.map((t) => t.card_code));

    // Pivot mensual: valor por productor + promedio del grupo (sobre TODOS).
    const porMes = new Map(meses.map((m) => [m, {}]));
    rows.forEach((r) => { if (r.valor != null) porMes.get(r.mes)[r.card_code] = r.valor; });
    const cd = meses.map((mes) => {
      const row = { mes };
      topCodes.forEach((c) => { if (porMes.get(mes)[c] != null) row[c] = porMes.get(mes)[c]; });
      if (showPromedio) {
        const vals = [...acc.keys()].map((c) => porMes.get(mes)[c]).filter((v) => v != null);
        row.__prom = agg === 'avg'
          ? geometricMean(vals)
          : (vals.length ? vals.reduce((a, b) => a + Number(b), 0) / vals.length : null);
      }
      return row;
    });

    return { chartData: cd, topProductores: top, barData: totales, colorByCode: colorMap };
  }, [data, showPromedio, agg]);

  if (chartData.length === 0) {
    return <p className="chart-empty">{emptyMessage}</p>;
  }

  const lineHeight = ampliado ? 420 : (ctxHeight ?? 280);
  const barHeight = Math.max(280, barData.length * 24 + 40);

  const lineKeys = [
    ...topProductores.map((pr) => pr.card_code),
    ...(showPromedio ? ['__prom'] : []),
  ];
  const lineDomain = domainCentered(
    chartData.flatMap((row) => lineKeys.map((k) => row[k])),
  );
  const barDomain = domainCentered(barData.map((d) => d.total));

  return (
    <>
      <ResponsiveContainer width="100%" height={lineHeight}>
        <LineChart data={chartData} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.muted} vertical={false} />
          <XAxis
            dataKey="mes"
            tick={{ fontSize: 11, fill: '#5a6d62' }}
            interval="preserveStartEnd"
            minTickGap={8}
            tickFormatter={(m) => formatMonthYear(m)}
          />
          <YAxis
            domain={lineDomain}
            tick={{ fontSize: 11, fill: '#5a6d62' }}
            tickFormatter={formatYAxisTick}
            width={56}
            allowDataOverflow
          />
          <Tooltip
            formatter={(v, name) => [`${fmt(v)}${unit ? ' ' + unit : ''}`, name]}
            labelFormatter={(m) => formatMonthYear(m)}
            contentStyle={{ borderRadius: 8, border: '1px solid #ccddd4' }}
            itemSorter={(it) => -it.value}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {topProductores.map((pr) => (
            <Line
              key={pr.card_code}
              type="monotone"
              dataKey={pr.card_code}
              name={pr.card_name}
              stroke={colorByCode[pr.card_code]}
              strokeWidth={1.75}
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

      {barData.length > TOP_LINEAS && (
        <p className="chart-empty" style={{ margin: '0.25rem 0 0', fontSize: '0.8rem' }}>
          {ampliado
            ? `Todos los productores del grupo (${barData.length}):`
            : `Se muestran los ${Math.min(TOP_LINEAS, barData.length)} de mayor total. Ampliá el gráfico para ver a los ${barData.length}.`}
        </p>
      )}

      {ampliado && (
        <ResponsiveContainer width="100%" height={barHeight}>
          <BarChart data={barData} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.muted} horizontal={false} />
            <XAxis
              type="number"
              domain={barDomain}
              tick={{ fontSize: 11, fill: '#5a6d62' }}
              tickFormatter={formatYAxisTick}
              allowDataOverflow
            />
            <YAxis type="category" dataKey="card_name" width={150} tick={{ fontSize: 11, fill: '#5a6d62' }} interval={0} />
            <Tooltip
              formatter={(v) => [`${fmt(v)}${unit ? ' ' + unit : ''}`, agg === 'avg' ? 'Promedio' : 'Total']}
              contentStyle={{ borderRadius: 8, border: '1px solid #ccddd4' }}
            />
            <Bar dataKey="total" radius={[0, 4, 4, 0]}>
              {barData.map((d) => (
                <Cell key={d.card_code} fill={colorByCode[d.card_code]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </>
  );
}

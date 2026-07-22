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
import { CHART_COLORS, domainCentered, formatMonthYear } from '../chartUtils';
import { ChartHeightContext } from './ChartHeightContext';
import { fmt, fmtDate } from '../utils';

// Línea de litros (serie única). Sirve para muchos puntos diarios (dots=false, año corriente)
// o para pocos puntos mensuales (dots=true). Selección opcional al hacer clic (por día).
export default function LitrosLineChart({
  data,
  selectedDate,
  onDateSelect,
  dots = false,
  valueLabel = 'Litros',
  valueUnit = ' L',
  yTickDecimals,
  emptyMessage = 'Sin datos para el período',
}) {
  const ctxHeight = useContext(ChartHeightContext);

  if (!data || data.length === 0) {
    return <p className="chart-empty">{emptyMessage}</p>;
  }

  const chartData = data.map((d) => ({ ...d, total: Number(d.total) }));
  const domain = domainCentered(chartData.map((d) => d.total));

  function formatYTick(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return '';
    if (yTickDecimals != null) {
      return n.toLocaleString('es-AR', {
        minimumFractionDigits: yTickDecimals,
        maximumFractionDigits: yTickDecimals,
      });
    }
    if (Math.abs(n) >= 100) {
      return Math.round(n).toLocaleString('es-AR');
    }
    return n.toLocaleString('es-AR', { maximumFractionDigits: 1 });
  }

  function handleClick(state) {
    const payload = state?.activePayload?.[0]?.payload;
    if (payload?.date && onDateSelect) {
      onDateSelect(String(payload.date).slice(0, 10));
    }
  }

  return (
    <ResponsiveContainer width="100%" height={ctxHeight ?? 280}>
      <LineChart
        data={chartData}
        margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
        onClick={handleClick}
        style={{ cursor: onDateSelect ? 'pointer' : undefined }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.muted} vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: '#5a6d62' }}
          interval="preserveStartEnd"
          minTickGap={dots ? 8 : 40}
        />
        <YAxis
          domain={domain}
          tick={{ fontSize: 11, fill: '#5a6d62' }}
          tickFormatter={formatYTick}
          width={yTickDecimals != null ? 48 : 52}
          allowDataOverflow
        />
        <Tooltip
          formatter={(v) => [`${fmt(v)}${valueUnit}`, valueLabel]}
          labelFormatter={(l, p) => {
            const d = p && p[0] && p[0].payload;
            if (d && d.date) return fmtDate(d.date);
            if (d && d.month) return formatMonthYear(d.month);
            return l;
          }}
          contentStyle={{ borderRadius: 8, border: '1px solid #ccddd4' }}
        />
        <Line
          type="monotone"
          dataKey="total"
          stroke={CHART_COLORS.primary}
          strokeWidth={2}
          dot={dots ? { r: 3 } : false}
          activeDot={{ r: 5 }}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

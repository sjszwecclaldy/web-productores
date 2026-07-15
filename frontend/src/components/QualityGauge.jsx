import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import { fmt } from '../utils';
import { CHART_COLORS } from '../chartUtils';

export default function QualityGauge({ label, value, max, unit = '%' }) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return (
      <div className="quality-gauge">
        <span className="quality-gauge__label">{label}</span>
        <span className="quality-gauge__value">—</span>
      </div>
    );
  }

  const pct = Math.min(100, Math.max(0, (num / max) * 100));
  const data = [
    { value: pct },
    { value: 100 - pct },
  ];

  return (
    <div className="quality-gauge">
      <div className="quality-gauge__chart">
        <ResponsiveContainer width="100%" height={100}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="100%"
              startAngle={180}
              endAngle={0}
              innerRadius={52}
              outerRadius={72}
              paddingAngle={0}
              dataKey="value"
              stroke="none"
            >
              <Cell fill={CHART_COLORS.primary} />
              <Cell fill={CHART_COLORS.muted} />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <span className="quality-gauge__center">
          {fmt(num)}
          <small>{unit}</small>
        </span>
      </div>
      <span className="quality-gauge__label">{label}</span>
    </div>
  );
}

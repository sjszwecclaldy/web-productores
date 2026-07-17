import AppHeader from '../components/AppHeader';
import ChartPanel from '../components/ChartPanel';
import QualityGauge from '../components/QualityGauge';

// Pantalla de Calidad higiénico-sanitaria (células somáticas, recuento bacteriano, etc.).
// Estructura lista; se "enciende" cuando exista el endpoint con estos datos.
// Métricas placeholder (sin unidad por ahora): se ajustan al conectar la fuente.
const METRICAS = [
  { key: 'rcs', label: 'Células somáticas' },
  { key: 'ufc', label: 'Recuento bacteriano' },
];

export default function Calidad() {
  const ultimo = null; // TODO: reemplazar por datos del endpoint cuando exista

  return (
    <div className="layout">
      <AppHeader />

      <main className="main">
        <h2 className="page-title">Calidad</h2>

        <div className="info-msg">
          Próximamente: datos de calidad higiénico-sanitaria (células somáticas, recuento bacteriano y
          otros). Esta sección se activará cuando se conecte la fuente de datos correspondiente.
        </div>

        <ChartPanel title="Última muestra — medidores">
          <div className="gauges-row">
            {METRICAS.map((m) => (
              <QualityGauge key={m.key} label={m.label} value={ultimo?.[m.key]} max={100} />
            ))}
          </div>
        </ChartPanel>

        <ChartPanel title="Evolución">
          <p className="chart-empty">Sin datos por el momento.</p>
        </ChartPanel>
      </main>
    </div>
  );
}

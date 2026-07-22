import { apiFromDate, DATA_FROM_DATE } from './utils';

// Filtro de período compartido entre todas las pantallas del productor.
// Se guarda en localStorage: al elegir un período en una pantalla, las demás lo adoptan.
const KEY = 'wp_periodo';
const DEFAULT_PRESET = 90;

// { preset, from, to }. Para presets relativos (número de días o 'todos') recalcula
// 'from' al momento de leer, así "últimos 90 días" sigue siendo relativo a hoy.
export function loadPeriodo() {
  let stored = null;
  try {
    stored = JSON.parse(localStorage.getItem(KEY));
  } catch {
    stored = null;
  }
  const preset = stored && 'preset' in stored ? stored.preset : DEFAULT_PRESET;
  const to = stored && stored.to ? stored.to : '';
  let from;
  if (preset === 'todos') from = DATA_FROM_DATE;
  else if (typeof preset === 'number') from = apiFromDate(preset);
  else from = stored && stored.from ? stored.from : apiFromDate(DEFAULT_PRESET); // rango personalizado
  return { preset: preset ?? null, from, to };
}

export function savePeriodo(preset, from, to) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ preset: preset ?? null, from: from || '', to: to || '' }));
  } catch {
    /* localStorage no disponible: se ignora */
  }
}

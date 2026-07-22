import { useState } from 'react';

// Muestra solo los primeros `limite` elementos y permite desplegar el resto.
// Uso: const { visibles, restantes, abierto, toggle } = useColapsable(rows, 10);
export function useColapsable(rows, limite = 10) {
  const [abierto, setAbierto] = useState(false);
  const lista = Array.isArray(rows) ? rows : [];
  const visibles = abierto ? lista : lista.slice(0, limite);
  const restantes = Math.max(0, lista.length - limite);
  return { visibles, restantes, abierto, toggle: () => setAbierto((v) => !v) };
}

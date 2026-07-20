import { createContext } from 'react';

// Altura de gráfico para el modo expandido (modal). Es null en el render normal
// (cada gráfico usa su altura por defecto) y un número grande dentro del modal.
export const ChartHeightContext = createContext(null);

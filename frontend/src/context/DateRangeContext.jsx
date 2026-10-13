import React, { createContext, useContext, useState } from 'react';

// Helpers para zona horaria Colombia (UTC-5)
export const getTodayCO = () => {
  const d = new Date();
  const co = new Date(d.toLocaleString('en-US', { timeZone: 'America/Bogota' }));
  return co.toISOString().split('T')[0];
};

const getFirstDayOfMonthCO = () => {
  const d = new Date();
  const co = new Date(d.toLocaleString('en-US', { timeZone: 'America/Bogota' }));
  co.setDate(1);
  return co.toISOString().split('T')[0];
};

const DateRangeContext = createContext(null);

export const DateRangeProvider = ({ children }) => {
  // Persistir en localStorage con fecha base por defecto en 2026-10-06 (nuevo ciclo/corte de ventas)
  const [startDate, setStartDateState] = useState(() => {
    return localStorage.getItem('corte_startDate') || '2026-10-06';
  });
  const [endDate, setEndDateState] = useState(() => {
    return localStorage.getItem('corte_endDate') || getTodayCO();
  });

  const setStartDate = (val) => {
    if (val) localStorage.setItem('corte_startDate', val);
    else localStorage.removeItem('corte_startDate');
    setStartDateState(val);
  };

  const setEndDate = (val) => {
    if (val) localStorage.setItem('corte_endDate', val);
    else localStorage.removeItem('corte_endDate');
    setEndDateState(val);
  };

  /**
   * isInRange: true si la fecha ISO está dentro del rango.
   * Si endDate === '' el rango es abierto → filtra todo desde startDate hasta hoy.
   */
  const isInRange = (dateString) => {
    if (!dateString) return false;
    // Extraer solo la parte de fecha (YYYY-MM-DD) sin problema de timezone
    let d = dateString;
    if (d.includes('T')) d = d.split('T')[0];
    const effectiveEnd = endDate || getTodayCO();
    return d >= startDate && d <= effectiveEnd;
  };

  return (
    <DateRangeContext.Provider value={{ startDate, endDate, setStartDate, setEndDate, isInRange, getTodayCO }}>
      {children}
    </DateRangeContext.Provider>
  );
};

export const useDateRange = () => {
  const ctx = useContext(DateRangeContext);
  if (!ctx) throw new Error('useDateRange debe usarse dentro de <DateRangeProvider>');
  return ctx;
};

export default DateRangeContext;

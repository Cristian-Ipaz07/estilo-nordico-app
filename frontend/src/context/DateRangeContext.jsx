import React, { createContext, useContext, useState } from 'react';

// Helpers para zona horaria Colombia (UTC-5)
const getTodayCO = () => {
  const d = new Date();
  d.setHours(d.getHours() - 5);
  return d.toISOString().split('T')[0];
};

const getFirstDayOfMonthCO = () => {
  const d = new Date();
  d.setHours(d.getHours() - 5);
  d.setDate(1);
  return d.toISOString().split('T')[0];
};

const DateRangeContext = createContext(null);

export const DateRangeProvider = ({ children }) => {
  const [startDate, setStartDate] = useState(getFirstDayOfMonthCO());
  const [endDate, setEndDate] = useState(getTodayCO());

  // Helper: retorna true si una fecha ISO string está dentro del rango
  const isInRange = (dateString) => {
    if (!dateString) return false;
    const d = dateString.split('T')[0];
    return d >= startDate && d <= endDate;
  };

  return (
    <DateRangeContext.Provider value={{ startDate, endDate, setStartDate, setEndDate, isInRange }}>
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

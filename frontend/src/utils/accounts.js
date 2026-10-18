// Utilidades y constantes canónicas de cuentas y bolsas de dinero
export const FINANCIAL_ACCOUNTS = [
  {
    id: 'EFECTIVO_TIENDA',
    label: 'Efectivo Tienda',
    fullLabel: 'Efectivo Mostrador (Tienda)',
    icon: '💵',
    color: 'emerald',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    ringClass: 'ring-emerald-500'
  },
  {
    id: 'NEQUI_CRISTIAN',
    label: 'Nequi Cristian',
    fullLabel: 'Nequi Cristian',
    icon: '📱',
    color: 'indigo',
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    ringClass: 'ring-indigo-500'
  },
  {
    id: 'NEQUI_DAVID',
    label: 'Nequi David',
    fullLabel: 'Nequi David (Hermano)',
    icon: '📱',
    color: 'purple',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
    ringClass: 'ring-purple-500'
  },
  {
    id: 'EFECTIVO_CASA',
    label: 'Efectivo Casa',
    fullLabel: 'Efectivo en Casa (Caja Mayor)',
    icon: '🏠',
    color: 'amber',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    ringClass: 'ring-amber-500'
  },
  {
    id: 'BANCOLOMBIA',
    label: 'Bancolombia',
    fullLabel: 'Bancolombia / Cuenta',
    icon: '🏦',
    color: 'blue',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    ringClass: 'ring-blue-500'
  }
];

export const getAccountInfo = (accountId) => {
  if (!accountId) return FINANCIAL_ACCOUNTS[0];
  const found = FINANCIAL_ACCOUNTS.find(a => a.id === accountId);
  if (found) return found;

  const idUpper = String(accountId).toUpperCase();
  if (idUpper.includes('CRISTIAN')) return FINANCIAL_ACCOUNTS[1];
  if (idUpper.includes('DAVID')) return FINANCIAL_ACCOUNTS[2];
  if (idUpper.includes('CASA') || idUpper.includes('MAYOR')) return FINANCIAL_ACCOUNTS[3];
  if (idUpper.includes('BANCO')) return FINANCIAL_ACCOUNTS[4];
  if (idUpper.includes('NEQUI')) return FINANCIAL_ACCOUNTS[1];
  return FINANCIAL_ACCOUNTS[0];
};

export const inferAccountFromDesc = (description = '', defaultAccount = 'EFECTIVO_TIENDA') => {
  const d = String(description).toUpperCase();
  if (d.includes('(EFECTIVO EN CASA)') || d.includes('(CAJA MAYOR)')) return 'EFECTIVO_CASA';
  if (d.includes('(NEQUI DAVID)') || d.includes('NEQUI DAVID')) return 'NEQUI_DAVID';
  if (d.includes('(NEQUI') || d.includes('NEQUI')) return 'NEQUI_CRISTIAN';
  if (d.includes('(BANCOLOMBIA') || d.includes('(TRANSFERENCIA') || d.includes('BANCOLOMBIA')) return 'BANCOLOMBIA';
  return defaultAccount;
};

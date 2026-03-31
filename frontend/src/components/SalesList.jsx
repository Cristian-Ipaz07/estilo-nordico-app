import React, { useEffect, useState } from 'react';
import { getSales, addPayment } from '../services/api';

const SalesList = () => {
  const [sales, setSales] = useState([]);

  const loadSales = () => {
    getSales().then(res => setSales(res.data)).catch(err => console.error(err));
  };

  useEffect(() => { loadSales(); }, []);

  const handlePayment = async (id) => {
    const amount = prompt("¿Cuánto dinero está abonando el cliente?");
    if (amount) {
      try {
        await addPayment(id, parseFloat(amount));
        alert("Abono registrado con éxito");
        window.location.reload(); // Refresca para ver los nuevos saldos
      } catch (err) {
        alert("Error al registrar abono");
      }
    }
  };

  return (
    <div style={{ marginTop: '50px', backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #eee' }}>
      <h2 style={{ fontWeight: '300', textTransform: 'uppercase' }}>Registro de Ventas y Separados</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #333' }}>
            <th style={{ padding: '10px' }}>Cliente</th>
            <th>Total</th>
            <th>Abonado</th>
            <th>Saldo Pendiente</th>
            <th>Estado</th>
            <th>Acción</th>
          </tr>
        </thead>
        <tbody>
          {sales.map(sale => (
            <tr key={sale.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '10px' }}>{sale.customer_name}</td>
              <td>${sale.total_price.toLocaleString()}</td>
              <td style={{ color: 'green' }}>${sale.amount_paid.toLocaleString()}</td>
              <td style={{ color: 'red', fontWeight: 'bold' }}>${sale.balance_due.toLocaleString()}</td>
              <td>
                <span style={{ backgroundColor: sale.status === 'separado' ? '#fff3cd' : '#d4edda', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem' }}>
                  {sale.status.toUpperCase()}
                </span>
              </td>
              <td>
                {sale.balance_due > 0 && (
                  <button onClick={() => handlePayment(sale.id)} style={{ cursor: 'pointer', backgroundColor: '#2ecc71', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px' }}>
                    + Abono
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default SalesList;
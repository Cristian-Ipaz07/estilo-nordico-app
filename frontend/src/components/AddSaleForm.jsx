import React, { useState, useEffect } from 'react';
import { getProducts, createSale } from '../services/api';

const AddSaleForm = ({ onSaleCreated }) => {
  const [products, setProducts] = useState([]);
  const [formData, setFormData] = useState({
    product_id: '',
    customer_name: '',
    total_price: '',
    amount_paid: '',
    status: 'separado'
  });

  useEffect(() => {
    getProducts().then(res => setProducts(res.data));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await createSale({
        ...formData,
        product_id: parseInt(formData.product_id),
        total_price: parseFloat(formData.total_price),
        amount_paid: parseFloat(formData.amount_paid)
      });
      alert("¡Venta registrada y stock actualizado!");
      onSaleCreated(); // Esto refrescará la lista automáticamente
    } catch (err) {
      alert(err.response?.data?.detail || "Error al registrar");
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', marginBottom: '20px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}>
      <h3>Nueva Venta / Separado</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <select required onChange={e => setFormData({...formData, product_id: e.target.value})} style={{ padding: '8px' }}>
          <option value="">Selecciona Producto</option>
          {products.map(p => <option key={p.id} value={p.id}>{p.name} (Stock: {p.stock})</option>)}
        </select>
        <input placeholder="Nombre Cliente" required onChange={e => setFormData({...formData, customer_name: e.target.value})} style={{ padding: '8px' }} />
        <input type="number" placeholder="Precio Total" required onChange={e => setFormData({...formData, total_price: e.target.value})} style={{ padding: '8px' }} />
        <input type="number" placeholder="Abono Inicial" required onChange={e => setFormData({...formData, amount_paid: e.target.value})} style={{ padding: '8px' }} />
      </div>
      <button type="submit" style={{ marginTop: '10px', width: '100%', padding: '10px', backgroundColor: '#333', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
        Registrar Venta
      </button>
    </form>
  );
};

export default AddSaleForm;
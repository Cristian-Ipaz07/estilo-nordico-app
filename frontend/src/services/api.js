import axios from 'axios';

const api = axios.create({
  baseURL: 'http://127.0.0.1:8000', 
});

// Productos
export const getProducts = () => api.get('/products/');
export const createProduct = (product) => api.post('/products/', product);
export const updateProduct = (id, product) => api.put(`/products/${id}`, product);
export const deleteProduct = (id) => api.delete(`/products/${id}`);

// Ventas
export const getSales = () => api.get('/sales/');
export const createSale = (saleData) => api.post('/sales/', saleData);

// Usuarios / Auth
export const login = (formData) => api.post('/users/login', formData, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
});
//boton de abono
export const addPayment = (saleId, amount) => 
    api.patch(`/sales/${saleId}/payment?amount=${amount}`);

export default api;


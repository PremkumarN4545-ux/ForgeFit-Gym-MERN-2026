import api from './api';

export const listPayments = (params) => api.get('/payments', { params }).then((r) => r.data);
export const createPayment = (payload) => api.post('/payments', payload).then((r) => r.data);
export const updatePayment = (id, payload) => api.put(`/payments/${id}`, payload).then((r) => r.data);
export const deletePayment = (id) => api.delete(`/payments/${id}`).then((r) => r.data);

import api from './api';

export const listPlans = (params) => api.get('/plans', { params }).then((r) => r.data.data);
export const listAvailablePlans = () => api.get('/plans/available').then((r) => r.data.data);
export const createPlan = (payload) => api.post('/plans', payload).then((r) => r.data);
export const updatePlan = (id, payload) => api.put(`/plans/${id}`, payload).then((r) => r.data);
export const setPlanStatus = (id, status) => api.patch(`/plans/${id}/status`, { status }).then((r) => r.data);
export const deletePlan = (id) => api.delete(`/plans/${id}`).then((r) => r.data);

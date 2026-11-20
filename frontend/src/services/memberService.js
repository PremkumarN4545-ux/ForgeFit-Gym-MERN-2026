import api from './api';

export const getMyDashboard = () => api.get('/auth/member/dashboard').then((r) => r.data);
export const listMembers = (params) => api.get('/members', { params }).then((r) => r.data);
export const listRegisteredUsers = (params) => api.get('/members/registered-users', { params }).then((r) => r.data);
export const getRegisteredUser = (id) => api.get(`/members/registered-users/${id}`).then((r) => r.data);
export const resetRegisteredUserPassword = (id) => api.post(`/members/registered-users/${id}/reset-password`).then((r) => r.data);
export const setRegisteredUserAccountStatus = (id, accountStatus) => api.patch(`/members/registered-users/${id}/account-status`, { accountStatus }).then((r) => r.data);
export const getMember = (id) => api.get(`/members/${id}`).then((r) => r.data);
export const resetMemberPassword = (id) => api.post(`/members/${id}/reset-password`).then((r) => r.data);
export const setMemberAccountStatus = (id, accountStatus) => api.patch(`/members/${id}/account-status`, { accountStatus }).then((r) => r.data);
export const createMember = (payload) => api.post('/members', payload).then((r) => r.data);
export const updateMember = (id, payload) => api.put(`/members/${id}`, payload).then((r) => r.data);
export const deleteMember = (id) => api.delete(`/members/${id}`).then((r) => r.data);
export const getMemberPayments = (id) => api.get(`/members/${id}/payments`).then((r) => r.data);
export const submitMyPayment = (payload) => api.post('/auth/member/payments', payload).then((r) => r.data);
export const createMembershipOrder = (payload) => api.post('/auth/member/payments/order', payload).then((r) => r.data);
export const verifyMembershipPayment = (payload) => api.post('/auth/member/payments/verify', payload).then((r) => r.data);

import api, { clearToken, setToken } from './api';

export async function login(email, password) {
  const { data } = await api.post('/auth/login', { email, password });
  setToken(data.token);
  return data.admin;
}

export async function registerMember(details) {
  const { data } = await api.post('/auth/member/register', details);
  return data;
}

export async function loginMember(email, password) {
  const { data } = await api.post('/auth/member/login', { email, password });
  setToken(data.token);
  return data.member;
}

export async function me() {
  const { data } = await api.get('/auth/me');
  return data.admin || data.member || data.user;
}

// JWTs are stateless: logging out means discarding the token on the client.
export function logout() {
  clearToken();
}

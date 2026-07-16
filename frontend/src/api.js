const API_URL = import.meta.env.VITE_API_URL || '';

function getToken() {
  return localStorage.getItem('token');
}

function setToken(token) {
  localStorage.setItem('token', token);
}

function setRole(role) {
  localStorage.setItem('role', role || 'productor');
}

function getRole() {
  return localStorage.getItem('role') || 'productor';
}

function isAdmin() {
  return getRole() === 'admin';
}

function setAdminProducer(cardCode, cardName) {
  localStorage.setItem('admin_card_code', cardCode);
  localStorage.setItem('admin_card_name', cardName || cardCode);
}

function getAdminCardCode() {
  return localStorage.getItem('admin_card_code') || '';
}

function getAdminCardName() {
  return localStorage.getItem('admin_card_name') || '';
}

function clearAdminProducer() {
  localStorage.removeItem('admin_card_code');
  localStorage.removeItem('admin_card_name');
}

function clearToken() {
  localStorage.removeItem('token');
  localStorage.removeItem('card_name');
  localStorage.removeItem('role');
  clearAdminProducer();
}

function setCardName(name) {
  localStorage.setItem('card_name', name);
}

function getCardName() {
  return localStorage.getItem('card_name') || '';
}

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  // Para el admin: si eligió un productor, se agrega card_code a las consultas GET a /api/...
  let finalPath = path;
  const method = (options.method || 'GET').toUpperCase();
  const adminCode = getAdminCardCode();
  if (isAdmin() && adminCode && method === 'GET' && path.startsWith('/api/')) {
    const sep = path.includes('?') ? '&' : '?';
    finalPath = `${path}${sep}card_code=${encodeURIComponent(adminCode)}`;
  }

  const res = await fetch(`${API_URL}${finalPath}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || 'Error en la solicitud');
  }
  return data;
}

export {
  API_URL,
  api,
  getToken,
  setToken,
  clearToken,
  setCardName,
  getCardName,
  setRole,
  getRole,
  isAdmin,
  setAdminProducer,
  getAdminCardCode,
  getAdminCardName,
  clearAdminProducer,
};

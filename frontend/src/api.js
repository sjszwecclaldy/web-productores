const API_URL = import.meta.env.VITE_API_URL || '';

function getToken() {
  return localStorage.getItem('token');
}

function setToken(token) {
  localStorage.setItem('token', token);
}

function clearToken() {
  localStorage.removeItem('token');
  localStorage.removeItem('card_name');
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

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || 'Error en la solicitud');
  }
  return data;
}

export { API_URL, api, getToken, setToken, clearToken, setCardName, getCardName };

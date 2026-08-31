const COMMON_CATEGORIES = ['Food', 'Travel', 'Shopping', 'Entertainment', 'Health', 'Education', 'Other'];

const API_BASE_URL = (() => {
  const saved = localStorage.getItem('apiBaseUrl');
  const globalOverride = window.SMART_EXPENSE_API_BASE_URL;
  const defaultBase = `${window.location.protocol}//${window.location.hostname}:5000`;
  return (saved || globalOverride || defaultBase).replace(/\/+$/, '');
})();

function apiUrl(path) {
  if (!path) return API_BASE_URL;
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

function apiFetch(path, options = {}) {
  return fetch(apiUrl(path), options);
}

window.API_BASE_URL = API_BASE_URL;
window.apiUrl = apiUrl;
window.apiFetch = apiFetch;

function getToken() {
  return localStorage.getItem('token');
}

function getAuthHeaders(extraHeaders = {}) {
  const token = getToken();
  return token ? { ...extraHeaders, Authorization: `Bearer ${token}` } : extraHeaders;
}

function ensureAuth() {
  if (!getToken()) {
    window.location.href = 'login.html';
  }
}

async function fetchCategoriesFromApi() {
  const headers = getAuthHeaders();
  const res = await apiFetch('/api/expenses/categories', { headers });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error || 'Failed to load categories');
  }
  const categories = await res.json();
  if (!Array.isArray(categories) || categories.length === 0) {
    throw new Error('No categories returned');
  }
  return categories;
}

async function populateCategories(selectId, { includeAll = false, defaultCategories = COMMON_CATEGORIES, allLabel = 'All Categories' } = {}) {
  const select = document.getElementById(selectId);
  if (!select) return;

  try {
    const categories = await fetchCategoriesFromApi();
    const options = includeAll ? ['all', ...categories] : categories;
    select.innerHTML = options.map(option => `
      <option value="${option}">${option === 'all' ? allLabel : option}</option>`).join('');
  } catch (err) {
    console.warn('Using default categories:', err.message);
    const options = includeAll ? ['all', ...defaultCategories] : defaultCategories;
    select.innerHTML = options.map(option => `
      <option value="${option}">${option === 'all' ? allLabel : option}</option>`).join('');
  }
}

function applyDarkModePreference() {
  if (localStorage.getItem('darkMode') === 'true') {
    document.body.classList.add('dark-mode');
  }
}

function toggleDarkMode() {
  const isDark = document.body.classList.toggle('dark-mode');
  localStorage.setItem('darkMode', isDark ? 'true' : 'false');
  if (typeof updateThemeButton === 'function') {
    updateThemeButton();
  }
}

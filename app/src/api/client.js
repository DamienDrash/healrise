import axios from 'axios';

const BASE_URL = '/healrise/app';

const client = axios.create({ baseURL: BASE_URL });

client.interceptors.request.use(cfg => {
  const jwt = localStorage.getItem('healrise_jwt');
  if (jwt) cfg.headers.Authorization = `Bearer ${jwt}`;
  return cfg;
});

client.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('healrise_jwt');
      // Kein Hard-Redirect (Review F17): AuthContext hört auf das Event und
      // setzt den User zurück — die Route-Guards navigieren dann per SPA zu /login.
      window.dispatchEvent(new CustomEvent('healrise:unauthorized'));
    }
    return Promise.reject(err);
  }
);

export default client;

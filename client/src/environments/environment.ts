const isBrowser = typeof window !== 'undefined';
const isLocalhost = isBrowser && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

export const environment = {
  production: false,
  apiUrl: isBrowser && !isLocalhost ? '/api' : 'http://localhost:5000/api',
  uploadsUrl: isBrowser && !isLocalhost ? '/uploads' : 'http://localhost:5000/uploads'
};

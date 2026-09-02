// functions/_routes.js
import googleStart from './api/google-start.js';
import googleCallback from './api/google-callback.js';

// Rotas do Workers - todas as APIs começam com /api/
export default {
  '/api/google-start': googleStart,
  '/api/google-callback': googleCallback,
  '/api/auth/login': './functions/api/auth-login.js', // Login email/senha dedicado
};

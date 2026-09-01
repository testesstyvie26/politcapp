// functions/_routes.js
import googleStart from './api/google-start.js';
import googleCallback from './api/google-callback.js';

export default {
  '/api/google-start': googleStart,
  '/api/google-callback': googleCallback
};
/** В dev/prod на Netlify запросы на тот же хост (/api → Netlify Function). */
export const API = import.meta.env.VITE_API_URL ?? '';
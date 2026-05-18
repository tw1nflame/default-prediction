// ===========================================
// API Export - Switch between real and mock
// ===========================================

import { api as realApi } from './client';
import { mockApi } from './mock';

// Используем mock API если бэкенд не настроен или явно включен мок-режим
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK_API === 'true' || 
                 !process.env.NEXT_PUBLIC_BACKEND_URL;

export const api = USE_MOCK ? mockApi : realApi;

export default api;

// Re-export types
export * from '@/src/types/api';

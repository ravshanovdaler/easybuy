import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'https://dalerravshanov.pythonanywhere.com/api/v1';

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
});

// Attach JWT token from localStorage to every request
api.interceptors.request.use((config) => {
  const isAdminReq = config.url?.includes('/admin') && !config.url?.includes('/admin/login');
  const token = isAdminReq
      ? localStorage.getItem('admin_access_token')
      : localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Reject HTML responses (occurs when frontend SPA redirects missing API endpoints to index.html)
api.interceptors.response.use(
  (response) => {
    const contentType = String(response.headers?.['content-type'] || '');
    if (typeof response.data === 'string' && contentType.includes('text/html')) {
      return Promise.reject(
        new Error(`API returned HTML instead of JSON. Ensure VITE_API_URL is configured correctly. (Current: ${BASE_URL})`)
      );
    }
    return response;
  },
  async (error) => {
    // If request was to admin endpoints, handle 401 specifically
    if (error.config?.url?.includes('/admin')) {
        if (error.response?.status === 401 && !error.config.url.includes('/admin/login')) {
          localStorage.removeItem('admin_access_token');
          window.dispatchEvent(new Event('admin_auth_expired'));
        }
        return Promise.reject(error);
      }

      if (error.response?.status === 401) {
        // Re-authenticate with Telegram initData
        const initData = window.Telegram?.WebApp?.initData;
        if (initData) {
          try {
            const res = await axios.post(`${BASE_URL}/auth/telegram`, { init_data: initData });
            localStorage.setItem('access_token', res.data.access_token);
            error.config.headers.Authorization = `Bearer ${res.data.access_token}`;
            return api.request(error.config);
          } catch (_) {
            localStorage.removeItem('access_token');
          }
        }
      }
      return Promise.reject(error);
    }
);

// ─── Auth ────────────────────────────────────────────────────────────────────
export const authApi = {
  loginTelegram: (init_data: string) =>
    api.post('/auth/telegram', { init_data }).then((r) => r.data),
};

// ─── Catalog ─────────────────────────────────────────────────────────────────
export const catalogApi = {
  getCategories: () => api.get('/categories').then((r) => r.data),
  getProducts: (params?: { category_id?: number; search?: string; page?: number }) =>
    api.get('/products', { params }).then((r) => r.data),
  getProduct: (id: number) => api.get(`/products/${id}`).then((r) => r.data),
  toggleLike: (id: number) => api.post(`/products/${id}/like`),
  getLiked: () => api.get('/products/liked').then((r) => r.data),
};

// ─── Cart ─────────────────────────────────────────────────────────────────────
export const cartApi = {
  getCart: () => api.get('/cart').then((r) => r.data),
  addItem: (product_id: number, variant_id?: number, quantity = 1) =>
    api.post('/cart', { product_id, variant_id, quantity }),
  updateItem: (id: number, quantity: number) =>
    api.patch(`/cart/${id}`, { quantity }),
  removeItem: (id: number) => api.delete(`/cart/${id}`),
  clearCart: () => api.delete('/cart'),
};

// ─── Orders ──────────────────────────────────────────────────────────────────
export const ordersApi = {
  checkout: (address_id: number, payment_method_id: number) =>
    api.post('/orders/checkout', { address_id, payment_method_id }).then((r) => r.data),
  getOrders: (page = 1) => api.get('/orders', { params: { page } }).then((r) => r.data),
  getOrder: (id: number) => api.get(`/orders/${id}`).then((r) => r.data),
  cancelOrder: (id: number) => api.post(`/orders/${id}/cancel`),
};

// ─── Payments ────────────────────────────────────────────────────────────────
export const paymentsApi = {
  getMethods: () => api.get('/payment-methods').then((r) => r.data),
  getPayment: (orderId: number) => api.get(`/orders/${orderId}/payment`).then((r) => r.data),
  uploadProof: (orderId: number, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post(`/orders/${orderId}/payment-proof`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

// ─── Users ───────────────────────────────────────────────────────────────────
export const usersApi = {
  getProfile: () => api.get('/users/me').then((r) => r.data),
  updateProfile: (data: { language?: string; phone?: string }) =>
    api.patch('/users/me', data).then((r) => r.data),
  getAddresses: () => api.get('/users/me/addresses').then((r) => r.data),
  createAddress: (data: Record<string, unknown>) =>
    api.post('/users/me/addresses', data).then((r) => r.data),
  deleteAddress: (id: number) => api.delete(`/users/me/addresses/${id}`),
};

// ─── Admin ───────────────────────────────────────────────────────────────────
export const adminApi = {
  login: (data: { email: string; password: string }) =>
    api.post('/admin/login', data).then((r) => r.data),
  getDashboard: () => api.get('/admin/dashboard').then((r) => r.data),
  getOrders: (params?: { status?: string; search?: string; page?: number; limit?: number }) =>
    api.get('/admin/orders', { params }).then((r) => r.data),
  getOrder: (id: number) => api.get(`/admin/orders/${id}`).then((r) => r.data),
  changeOrderStatus: (orderId: number, data: { to_status: string; comment?: string; tracking_number?: string }) =>
    api.patch(`/admin/orders/${orderId}/status`, data).then((r) => r.data),
  getPaymentReviews: () => api.get('/admin/payment-review').then((r) => r.data),
  decidePayment: (paymentId: number, data: { decision: 'approve' | 'reject'; reason?: string }) =>
    api.post(`/admin/payments/${paymentId}/decision`, data).then((r) => r.data),
  getSettings: () => api.get('/admin/settings').then((r) => r.data),
  updateSettings: (data: Record<string, unknown>) =>
    api.put('/admin/settings', data).then((r) => r.data),
  createProduct: (data: Record<string, unknown>) =>
    api.post('/admin/products', data).then((r) => r.data),
  updateProduct: (id: number, data: Record<string, unknown>) =>
    api.patch(`/admin/products/${id}`, data).then((r) => r.data),
  setBulkProductStatus: (product_ids: number[], new_status: string) =>
    api.post('/admin/products/bulk-status', { product_ids, new_status }).then((r) => r.data),
  uploadProductMedia: (productId: number, file: File, kind = 'gallery') => {
    const form = new FormData();
    form.append('file', file);
    return api.post(`/admin/products/${productId}/media?kind=${kind}`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data);
  },
  getCategories: () => api.get('/admin/categories').then((r) => r.data),
  createCategory: (data: Record<string, unknown>) =>
    api.post('/admin/categories', data).then((r) => r.data),
  updateCategory: (id: number, data: Record<string, unknown>) =>
    api.patch(`/admin/categories/${id}`, data).then((r) => r.data),
  deleteCategory: (id: number) => api.delete(`/admin/categories/${id}`).then((r) => r.data),
  getUsers: (params?: { search?: string; page?: number; limit?: number }) =>
    api.get('/admin/users', { params }).then((r) => r.data),
  updateUser: (id: number, data: { is_blocked?: boolean; internal_note?: string }) =>
    api.patch(`/admin/users/${id}`, data).then((r) => r.data),
};

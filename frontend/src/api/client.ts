import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
});

// Attach JWT token from localStorage to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-retry auth on 401
api.interceptors.response.use(
  (r) => r,
  async (error) => {
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

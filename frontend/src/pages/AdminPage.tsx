import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi, catalogApi } from '../api/client';
import { useStore } from '../store';

export default function AdminPage() {
  const queryClient = useQueryClient();
  const addToast = useStore((s) => s.addToast);
  const showToast = (message: string, type: string = 'info') => addToast(type, message);

  // Auth State
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('admin_access_token'));
  const [adminEmail, setAdminEmail] = useState<string>(() => localStorage.getItem('admin_email') || 'Admin');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Active Tab: 'dashboard' | 'payments' | 'orders' | 'products' | 'settings'
  const [tab, setTab] = useState<'dashboard' | 'payments' | 'orders' | 'products' | 'settings'>('dashboard');

  // Filters & State for Orders
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('');
  const [orderSearch, setOrderSearch] = useState<string>('');
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [newStatus, setNewStatus] = useState<string>('');
  const [trackingNumber, setTrackingNumber] = useState<string>('');
  const [statusComment, setStatusComment] = useState<string>('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Payment Review State
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [rejectModalPaymentId, setRejectModalPaymentId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Products State
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [newProduct, setNewProduct] = useState({
    title_ru: '',
    title_uz: '',
    description_ru: '',
    description_uz: '',
    category_id: '',
    base_price: '',
    shipping_fee: '0',
    source_platform: '1688',
    source_url: '',
  });

  // Settings State
  const [formSettings, setFormSettings] = useState<Record<string, any>>({});
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // ─── Queries ────────────────────────────────────────────────────────────────
  const dashboardQuery = useQuery({
    queryKey: ['adminDashboard'],
    queryFn: adminApi.getDashboard,
    enabled: !!token,
    refetchInterval: 15000,
  });

  const paymentReviewsQuery = useQuery({
    queryKey: ['adminPayments'],
    queryFn: adminApi.getPaymentReviews,
    enabled: !!token,
    refetchInterval: 15000,
  });

  const ordersQuery = useQuery({
    queryKey: ['adminOrders', orderStatusFilter, orderSearch],
    queryFn: () => adminApi.getOrders({ status: orderStatusFilter || undefined, search: orderSearch || undefined }),
    enabled: !!token,
  });

  const settingsQuery = useQuery({
    queryKey: ['adminSettings'],
    queryFn: async () => {
      const data = await adminApi.getSettings();
      setFormSettings(data);
      return data;
    },
    enabled: !!token && tab === 'settings',
  });

  const productsQuery = useQuery({
    queryKey: ['adminProducts'],
    queryFn: () => catalogApi.getProducts({ page: 1 }),
    enabled: !!token && tab === 'products',
  });

  const categoriesQuery = useQuery({
    queryKey: ['adminCategories'],
    queryFn: catalogApi.getCategories,
    enabled: !!token,
  });

  // ─── Login Handler ──────────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError('');
    try {
      const res = await adminApi.login({ email: loginEmail, password: loginPassword });
      localStorage.setItem('admin_access_token', res.access_token);
      localStorage.setItem('admin_email', loginEmail);
      setToken(res.access_token);
      setAdminEmail(loginEmail);
      showToast('Welcome back, Admin!', 'success');
    } catch (err: any) {
      setLoginError(err?.response?.data?.detail || 'Invalid email or password');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_access_token');
    localStorage.removeItem('admin_email');
    setToken(null);
    showToast('Logged out of Admin Panel', 'info');
  };

  // ─── Payment Review Handlers ────────────────────────────────────────────────
  const handleApprovePayment = async (paymentId: number) => {
    if (!confirm('Approve this payment? Order status will advance to Approved.')) return;
    try {
      await adminApi.decidePayment(paymentId, { decision: 'approve' });
      showToast('Payment approved!', 'success');
      queryClient.invalidateQueries({ queryKey: ['adminPayments'] });
      queryClient.invalidateQueries({ queryKey: ['adminDashboard'] });
    } catch (err: any) {
      showToast(err?.response?.data?.detail || 'Approval failed', 'error');
    }
  };

  const handleRejectPayment = async () => {
    if (!rejectModalPaymentId) return;
    if (!rejectReason.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }
    try {
      await adminApi.decidePayment(rejectModalPaymentId, { decision: 'reject', reason: rejectReason.trim() });
      showToast('Payment rejected', 'info');
      setRejectModalPaymentId(null);
      setRejectReason('');
      queryClient.invalidateQueries({ queryKey: ['adminPayments'] });
      queryClient.invalidateQueries({ queryKey: ['adminDashboard'] });
    } catch (err: any) {
      showToast(err?.response?.data?.detail || 'Action failed', 'error');
    }
  };

  // ─── Order Status Update Handlers ───────────────────────────────────────────
  const openStatusModal = (order: any) => {
    setSelectedOrder(order);
    setNewStatus(order.status);
    setTrackingNumber('');
    setStatusComment('');
  };

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    setIsUpdatingStatus(true);
    try {
      await adminApi.changeOrderStatus(selectedOrder.id, {
        to_status: newStatus,
        comment: statusComment.trim() || undefined,
        tracking_number: trackingNumber.trim() || undefined,
      });
      showToast(`Order #${selectedOrder.number} updated to ${newStatus}`, 'success');
      setSelectedOrder(null);
      queryClient.invalidateQueries({ queryKey: ['adminOrders'] });
      queryClient.invalidateQueries({ queryKey: ['adminDashboard'] });
    } catch (err: any) {
      showToast(err?.response?.data?.detail || 'Status update failed', 'error');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // ─── Settings Handlers ──────────────────────────────────────────────────────
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      await adminApi.updateSettings(formSettings);
      showToast('Settings saved successfully', 'success');
      queryClient.invalidateQueries({ queryKey: ['adminSettings'] });
    } catch (err: any) {
      showToast(err?.response?.data?.detail || 'Failed to save settings', 'error');
    } finally {
      setIsSavingSettings(false);
    }
  };

  // ─── Product Handlers ───────────────────────────────────────────────────────
  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProduct.title_ru || !newProduct.base_price) {
      alert('Title and Price are required');
      return;
    }
    try {
      await adminApi.createProduct({
        category_id: newProduct.category_id ? parseInt(newProduct.category_id) : null,
        title_i18n: {
          ru: newProduct.title_ru,
          uz: newProduct.title_uz || newProduct.title_ru,
        },
        description_i18n: {
          ru: newProduct.description_ru,
          uz: newProduct.description_uz || newProduct.description_ru,
        },
        base_price: parseFloat(newProduct.base_price),
        shipping_fee: parseFloat(newProduct.shipping_fee || '0'),
        currency: 'USD',
        source_platform: newProduct.source_platform,
        source_url: newProduct.source_url || null,
        status: 'active',
      });
      showToast('Product created successfully!', 'success');
      setShowAddProductModal(false);
      setNewProduct({
        title_ru: '',
        title_uz: '',
        description_ru: '',
        description_uz: '',
        category_id: '',
        base_price: '',
        shipping_fee: '0',
        source_platform: '1688',
        source_url: '',
      });
      queryClient.invalidateQueries({ queryKey: ['adminProducts'] });
    } catch (err: any) {
      showToast(err?.response?.data?.detail || 'Failed to create product', 'error');
    }
  };

  const handleToggleProductStatus = async (productId: number, currentStatus: string) => {
    const next = currentStatus === 'active' ? 'hidden' : 'active';
    try {
      await adminApi.updateProduct(productId, { status: next });
      showToast(`Product set to ${next}`, 'info');
      queryClient.invalidateQueries({ queryKey: ['adminProducts'] });
    } catch (err: any) {
      showToast('Update failed', 'error');
    }
  };

  // ─── LOGIN SCREEN ───────────────────────────────────────────────────────────
  if (!token) {
    return (
      <div className="admin-view" style={{ justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <div className="admin-modal-card" style={{ position: 'relative', top: 'auto', left: 'auto', transform: 'none', maxWidth: 420 }}>
          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: 36 }}>🛡️</span>
            <h2 style={{ fontSize: 20, fontWeight: 800, marginTop: 8 }}>EasyBuy Admin Panel</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
              Sign in with your administrator credentials
            </p>
          </div>

          {loginError && (
            <div style={{ padding: 10, background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, color: '#f87171', fontSize: 13 }}>
              ⚠️ {loginError}
            </div>
          )}

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                Admin Email
              </label>
              <input
                type="email"
                required
                className="admin-input"
                placeholder="admin@easybuy.com"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                Password
              </label>
              <input
                type="password"
                required
                className="admin-input"
                placeholder="••••••••"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
              />
            </div>

            <button type="submit" className="admin-btn admin-btn-primary" style={{ padding: 12, marginTop: 6 }} disabled={loginLoading}>
              {loginLoading ? 'Signing In...' : 'Log In to Admin Panel'}
            </button>
          </form>

          <div style={{ marginTop: 8, padding: 12, background: 'var(--bg-secondary)', borderRadius: 8, fontSize: 12, color: 'var(--text-muted)' }}>
            💡 <strong>Need an account?</strong> Run <code>python create_admin.py</code> in your PythonAnywhere console to create or reset your admin superuser.
          </div>
        </div>
      </div>
    );
  }

  // ─── ADMIN DASHBOARD VIEW ───────────────────────────────────────────────────
  const pendingCount = paymentReviewsQuery.data?.length || 0;
  const stats = dashboardQuery.data || {};

  return (
    <div className="admin-view">
      {/* Top Header */}
      <header className="admin-header">
        <div className="admin-brand">
          <h1>🛡️ EasyBuy Admin</h1>
          <span className="admin-badge">Control Panel</span>
        </div>
        <div className="admin-user-info">
          <span className="admin-email-pill">👤 {adminEmail}</span>
          <button onClick={handleLogout} className="admin-btn admin-btn-secondary" style={{ padding: '6px 12px' }}>
            🚪 Logout
          </button>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="admin-tabs">
        <button className={`admin-tab ${tab === 'dashboard' ? 'active' : ''}`} onClick={() => setTab('dashboard')}>
          📊 Overview
        </button>
        <button className={`admin-tab ${tab === 'payments' ? 'active' : ''}`} onClick={() => setTab('payments')}>
          💳 Payment Review {pendingCount > 0 && <span className="admin-tab-badge">{pendingCount}</span>}
        </button>
        <button className={`admin-tab ${tab === 'orders' ? 'active' : ''}`} onClick={() => setTab('orders')}>
          📦 Orders
        </button>
        <button className={`admin-tab ${tab === 'products' ? 'active' : ''}`} onClick={() => setTab('products')}>
          🛍️ Products
        </button>
        <button className={`admin-tab ${tab === 'settings' ? 'active' : ''}`} onClick={() => setTab('settings')}>
          ⚙️ Settings
        </button>
      </nav>

      {/* ─── TAB 1: OVERVIEW / DASHBOARD ────────────────────────────────────── */}
      {tab === 'dashboard' && (
        <>
          <div className="admin-grid">
            <div className="admin-stat-card">
              <div className="admin-stat-title">
                <span>Pending Reviews</span>
                <span>💳</span>
              </div>
              <div className={`admin-stat-value ${pendingCount > 0 ? 'highlight' : ''}`}>
                {pendingCount}
              </div>
              <div className="admin-stat-sub">
                {pendingCount > 0 ? 'Requires your attention!' : 'All payments up to date'}
              </div>
            </div>

            <div className="admin-stat-card">
              <div className="admin-stat-title">
                <span>Orders Today</span>
                <span>📦</span>
              </div>
              <div className="admin-stat-value">{stats.orders_today ?? '—'}</div>
              <div className="admin-stat-sub">{stats.orders_week ?? 0} in the last 7 days</div>
            </div>

            <div className="admin-stat-card">
              <div className="admin-stat-title">
                <span>Revenue (Today)</span>
                <span>💰</span>
              </div>
              <div className="admin-stat-value">${(stats.revenue_today || 0).toFixed(2)}</div>
              <div className="admin-stat-sub">${(stats.revenue_month || 0).toFixed(2)} this month</div>
            </div>

            <div className="admin-stat-card">
              <div className="admin-stat-title">
                <span>Registered Users</span>
                <span>👥</span>
              </div>
              <div className="admin-stat-value">{stats.total_users ?? '—'}</div>
              <div className="admin-stat-sub">Telegram shoppers</div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="admin-section">
            <h2 className="admin-section-title">⚡ Quick Shortcuts</h2>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button className="admin-btn admin-btn-primary" onClick={() => setTab('payments')}>
                💳 Review Pending Payments ({pendingCount})
              </button>
              <button className="admin-btn admin-btn-secondary" onClick={() => setTab('orders')}>
                📦 View All Orders
              </button>
              <button className="admin-btn admin-btn-secondary" onClick={() => { setTab('products'); setShowAddProductModal(true); }}>
                ➕ Add New Product
              </button>
            </div>
          </div>
        </>
      )}

      {/* ─── TAB 2: PAYMENT REVIEW ─────────────────────────────────────────── */}
      {tab === 'payments' && (
        <div className="admin-section">
          <div className="admin-section-header">
            <h2 className="admin-section-title">
              💳 Payment Review Queue ({pendingCount})
            </h2>
            <button className="admin-btn admin-btn-secondary" onClick={() => paymentReviewsQuery.refetch()}>
              🔄 Refresh
            </button>
          </div>

          {paymentReviewsQuery.isLoading ? (
            <div style={{ padding: 20, textAlign: 'center' }}>Loading payment queue...</div>
          ) : pendingCount === 0 ? (
            <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-secondary)' }}>
              🎉 No pending payments to review! All receipts have been verified.
            </div>
          ) : (
            <div className="admin-card-list">
              {paymentReviewsQuery.data?.map((p: any) => (
                <div key={p.payment_id} className="admin-card-item">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                    <div>
                      <span style={{ fontWeight: 700, fontSize: 16 }}>Order #{p.order_number}</span>
                      <span style={{ marginLeft: 10, fontSize: 12, color: 'var(--text-muted)' }}>
                        User Telegram ID: {p.user_telegram_id || 'Unknown'}
                      </span>
                    </div>
                    <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--success)' }}>
                      ${p.amount?.toFixed(2)}
                    </span>
                  </div>

                  {p.is_flagged && (
                    <div style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', padding: '6px 12px', borderRadius: 6, fontSize: 12 }}>
                      ⚠️ <strong>Warning:</strong> Duplicate receipt file hash detected! This proof may have been reused.
                    </div>
                  )}

                  {/* Proof Image */}
                  {p.proof_url ? (
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <img
                        src={p.proof_url}
                        alt="Payment Proof"
                        style={{ width: 90, height: 90, objectFit: 'cover', borderRadius: 8, cursor: 'pointer', border: '1px solid var(--border)' }}
                        onClick={() => setPreviewImage(p.proof_url)}
                      />
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        Click image to expand receipt.<br />
                        <a href={p.proof_url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-light)', textDecoration: 'underline' }}>
                          Open full resolution ↗
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>No proof file uploaded</div>
                  )}

                  {/* Action Buttons */}
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                    <button
                      className="admin-btn admin-btn-danger"
                      onClick={() => { setRejectModalPaymentId(p.payment_id); setRejectReason(''); }}
                    >
                      ✕ Reject Payment
                    </button>
                    <button
                      className="admin-btn admin-btn-success"
                      onClick={() => handleApprovePayment(p.payment_id)}
                    >
                      ✓ Approve Payment
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 3: ORDERS ──────────────────────────────────────────────────── */}
      {tab === 'orders' && (
        <div className="admin-section">
          <div className="admin-section-header">
            <h2 className="admin-section-title">📦 Orders Management</h2>
            <button className="admin-btn admin-btn-secondary" onClick={() => ordersQuery.refetch()}>
              🔄 Refresh
            </button>
          </div>

          {/* Search & Filter Bar */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div className="admin-search-bar">
              <input
                type="text"
                className="admin-input"
                placeholder="Search by order # or username..."
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
              />
            </div>
            <select
              className="admin-select"
              value={orderStatusFilter}
              onChange={(e) => setOrderStatusFilter(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="pending_payment">Pending Payment</option>
              <option value="payment_review">Payment Review</option>
              <option value="approved">Approved</option>
              <option value="purchasing">Purchasing</option>
              <option value="warehouse">Warehouse</option>
              <option value="shipping">Shipping</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
              <option value="payment_rejected">Payment Rejected</option>
            </select>
          </div>

          {ordersQuery.isLoading ? (
            <div style={{ padding: 20, textAlign: 'center' }}>Loading orders...</div>
          ) : !ordersQuery.data || ordersQuery.data.length === 0 ? (
            <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-secondary)' }}>
              No orders found matching the filter criteria.
            </div>
          ) : (
            <div className="admin-card-list">
              {ordersQuery.data.map((o: any) => (
                <div key={o.id} className="admin-card-item">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                    <div>
                      <span style={{ fontWeight: 700, fontSize: 16 }}>#{o.number}</span>
                      <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                        {new Date(o.created_at).toLocaleString()}
                      </span>
                    </div>
                    <span className={`admin-status-pill admin-status-${o.status}`}>
                      {o.status.replace('_', ' ')}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                      Total: <strong style={{ color: 'var(--text-primary)', fontSize: 15 }}>${o.total.toFixed(2)}</strong>
                      {o.user_telegram_id && <span style={{ marginLeft: 12, color: 'var(--text-muted)' }}>TG: {o.user_telegram_id}</span>}
                    </div>
                    <button className="admin-btn admin-btn-secondary" onClick={() => openStatusModal(o)}>
                      ⚙️ Manage Status
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 4: PRODUCTS ────────────────────────────────────────────────── */}
      {tab === 'products' && (
        <div className="admin-section">
          <div className="admin-section-header">
            <h2 className="admin-section-title">🛍️ Product Catalog</h2>
            <button className="admin-btn admin-btn-primary" onClick={() => setShowAddProductModal(true)}>
              ➕ Add Product
            </button>
          </div>

          {productsQuery.isLoading ? (
            <div style={{ padding: 20, textAlign: 'center' }}>Loading products...</div>
          ) : (
            <div className="admin-card-list">
              {productsQuery.data?.items?.map((p: any) => (
                <div key={p.id} className="admin-card-item" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    {p.media?.[0]?.url && (
                      <img src={p.media[0].url} alt="" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6 }} />
                    )}
                    <div>
                      <div style={{ fontWeight: 600 }}>{p.title_i18n?.ru || 'Unnamed product'}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        ${p.base_price?.toFixed(2)} • {p.status}
                      </div>
                    </div>
                  </div>
                  <button
                    className={`admin-btn ${p.status === 'active' ? 'admin-btn-secondary' : 'admin-btn-success'}`}
                    onClick={() => handleToggleProductStatus(p.id, p.status)}
                  >
                    {p.status === 'active' ? 'Hide' : 'Activate'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 5: SETTINGS ────────────────────────────────────────────────── */}
      {tab === 'settings' && (
        <div className="admin-section">
          <h2 className="admin-section-title">⚙️ Store Configuration</h2>
          <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 500 }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                Brand Name
              </label>
              <input
                type="text"
                className="admin-input"
                value={formSettings.brand_name || ''}
                onChange={(e) => setFormSettings({ ...formSettings, brand_name: e.target.value })}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                Service Fee (%)
              </label>
              <input
                type="number"
                step="0.1"
                className="admin-input"
                value={formSettings.service_fee_percent ?? ''}
                onChange={(e) => setFormSettings({ ...formSettings, service_fee_percent: parseFloat(e.target.value) || 0 })}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                Default Shipping Fee ($)
              </label>
              <input
                type="number"
                step="0.1"
                className="admin-input"
                value={formSettings.shipping_fee ?? ''}
                onChange={(e) => setFormSettings({ ...formSettings, shipping_fee: parseFloat(e.target.value) || 0 })}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                Payment Deadline (Hours)
              </label>
              <input
                type="number"
                className="admin-input"
                value={formSettings.payment_deadline_hours ?? ''}
                onChange={(e) => setFormSettings({ ...formSettings, payment_deadline_hours: parseInt(e.target.value) || 24 })}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                Telegram Support Link
              </label>
              <input
                type="text"
                className="admin-input"
                placeholder="https://t.me/..."
                value={formSettings.support_link || ''}
                onChange={(e) => setFormSettings({ ...formSettings, support_link: e.target.value })}
              />
            </div>

            <button type="submit" className="admin-btn admin-btn-primary" style={{ padding: 12, marginTop: 8 }} disabled={isSavingSettings}>
              {isSavingSettings ? 'Saving Settings...' : 'Save Settings'}
            </button>
          </form>
        </div>
      )}

      {/* ─── MODAL: ORDER STATUS CHANGE ─────────────────────────────────────── */}
      {selectedOrder && (
        <>
          <div className="overlay" onClick={() => setSelectedOrder(null)} />
          <div className="admin-modal-card">
            <h3 style={{ fontSize: 17, fontWeight: 700 }}>
              Update Order #{selectedOrder.number}
            </h3>

            <form onSubmit={handleUpdateStatus} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                  New Status
                </label>
                <select
                  className="admin-select"
                  style={{ width: '100%' }}
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                >
                  <option value="pending_payment">pending_payment</option>
                  <option value="payment_review">payment_review</option>
                  <option value="approved">approved</option>
                  <option value="purchasing">purchasing</option>
                  <option value="warehouse">warehouse</option>
                  <option value="shipping">shipping</option>
                  <option value="delivered">delivered</option>
                  <option value="cancelled">cancelled</option>
                </select>
              </div>

              {newStatus === 'shipping' && (
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                    Tracking Number
                  </label>
                  <input
                    type="text"
                    className="admin-input"
                    placeholder="e.g. CN123456789"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                  />
                </div>
              )}

              <div>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                  Comment / Reason (Optional)
                </label>
                <textarea
                  className="admin-input"
                  rows={3}
                  placeholder="Note for this status transition..."
                  value={statusComment}
                  onChange={(e) => setStatusComment(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
                <button type="button" className="admin-btn admin-btn-secondary" onClick={() => setSelectedOrder(null)}>
                  Cancel
                </button>
                <button type="submit" className="admin-btn admin-btn-primary" disabled={isUpdatingStatus}>
                  {isUpdatingStatus ? 'Updating...' : 'Update Status'}
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* ─── MODAL: REJECT PAYMENT REASON ───────────────────────────────────── */}
      {rejectModalPaymentId && (
        <>
          <div className="overlay" onClick={() => setRejectModalPaymentId(null)} />
          <div className="admin-modal-card">
            <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--danger)' }}>
              Reject Payment Proof
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Please specify the reason. This message will be recorded and communicated to the customer.
            </p>
            <textarea
              className="admin-input"
              rows={3}
              placeholder="e.g. Unreadable receipt screenshot, incorrect transfer amount, or invalid transaction..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="admin-btn admin-btn-secondary" onClick={() => setRejectModalPaymentId(null)}>
                Cancel
              </button>
              <button className="admin-btn admin-btn-danger" onClick={handleRejectPayment}>
                Confirm Rejection
              </button>
            </div>
          </div>
        </>
      )}

      {/* ─── MODAL: PREVIEW IMAGE ───────────────────────────────────────────── */}
      {previewImage && (
        <>
          <div className="overlay" onClick={() => setPreviewImage(null)} />
          <div
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 300,
              maxWidth: '90vw',
              maxHeight: '90vh',
            }}
          >
            <img
              src={previewImage}
              alt="Receipt Preview"
              style={{ maxWidth: '100%', maxHeight: '85vh', objectFit: 'contain', borderRadius: 8, boxShadow: '0 8px 30px rgba(0,0,0,0.8)' }}
            />
            <div style={{ textAlign: 'center', marginTop: 10 }}>
              <button className="admin-btn admin-btn-secondary" onClick={() => setPreviewImage(null)}>
                Close Preview
              </button>
            </div>
          </div>
        </>
      )}

      {/* ─── MODAL: ADD PRODUCT ─────────────────────────────────────────────── */}
      {showAddProductModal && (
        <>
          <div className="overlay" onClick={() => setShowAddProductModal(false)} />
          <div className="admin-modal-card">
            <h3 style={{ fontSize: 17, fontWeight: 700 }}>Add New Product</h3>
            <form onSubmit={handleAddProduct} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                  Product Title (Russian) *
                </label>
                <input
                  type="text"
                  required
                  className="admin-input"
                  placeholder="e.g. Смарт-часы Ultra"
                  value={newProduct.title_ru}
                  onChange={(e) => setNewProduct({ ...newProduct, title_ru: e.target.value })}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                  Product Title (Uzbek)
                </label>
                <input
                  type="text"
                  className="admin-input"
                  placeholder="e.g. Smart soat Ultra"
                  value={newProduct.title_uz}
                  onChange={(e) => setNewProduct({ ...newProduct, title_uz: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                    Base Price (USD) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    className="admin-input"
                    placeholder="25.00"
                    value={newProduct.base_price}
                    onChange={(e) => setNewProduct({ ...newProduct, base_price: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                    Shipping Fee (USD)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className="admin-input"
                    placeholder="2.00"
                    value={newProduct.shipping_fee}
                    onChange={(e) => setNewProduct({ ...newProduct, shipping_fee: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                  Category
                </label>
                <select
                  className="admin-select"
                  style={{ width: '100%' }}
                  value={newProduct.category_id}
                  onChange={(e) => setNewProduct({ ...newProduct, category_id: e.target.value })}
                >
                  <option value="">No Category</option>
                  {categoriesQuery.data?.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.icon} {c.name_i18n?.ru || c.slug}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                  Chinese Supplier URL (1688 / Taobao)
                </label>
                <input
                  type="url"
                  className="admin-input"
                  placeholder="https://detail.1688.com/..."
                  value={newProduct.source_url}
                  onChange={(e) => setNewProduct({ ...newProduct, source_url: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
                <button type="button" className="admin-btn admin-btn-secondary" onClick={() => setShowAddProductModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="admin-btn admin-btn-primary">
                  Create Product
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
}

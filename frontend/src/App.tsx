import React, { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useStore } from './store';
import { authApi, cartApi } from './api/client';
import './index.css';

// Lazy-loaded pages for code splitting
const HomePage        = lazy(() => import('./pages/HomePage'));
const HowItWorksPage  = lazy(() => import('./pages/HowItWorksPage'));
const ProductPage     = lazy(() => import('./pages/ProductPage'));
const CartPage        = lazy(() => import('./pages/CartPage'));
const HistoryPage     = lazy(() => import('./pages/HistoryPage'));
const OrderStatusPage = lazy(() => import('./pages/OrderStatusPage'));
const PaymentPage     = lazy(() => import('./pages/PaymentPage'));
const SettingsPage    = lazy(() => import('./pages/SettingsPage'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
  },
});

// ─── Bottom Navigation ────────────────────────────────────────────────────────
function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const cartCount = useStore((s) => s.cartCount);

  const noNav = ['/how-it-works', '/product/', '/payment/', '/order/'].some(
    (p) => location.pathname.startsWith(p)
  );
  if (noNav) return null;

  const tabs = [
    { path: '/', icon: '🏠', label: 'Home' },
    { path: '/cart', icon: '🛒', label: 'Cart', badge: cartCount },
    { path: '/history', icon: '📦', label: 'Orders' },
    { path: '/settings', icon: '⚙️', label: 'Settings' },
  ];

  return (
    <nav className="bottom-nav">
      {tabs.map((tab) => (
        <button
          key={tab.path}
          className={`nav-item ${location.pathname === tab.path ? 'active' : ''}`}
          onClick={() => {
            window.Telegram?.WebApp?.HapticFeedback?.selectionChanged();
            navigate(tab.path);
          }}
        >
          <span className="nav-icon">{tab.icon}</span>
          {tab.badge ? <span className="nav-badge">{tab.badge > 9 ? '9+' : tab.badge}</span> : null}
          <span>{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}

// ─── Toast Container ──────────────────────────────────────────────────────────
function Toasts() {
  const toasts = useStore((s) => s.toasts);
  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.type}`}>
          {t.type === 'success' ? '✅' : t.type === 'error' ? '❌' : 'ℹ️'}
          {t.message}
        </div>
      ))}
    </div>
  );
}

// ─── Page Loader ─────────────────────────────────────────────────────────────
function PageFallback() {
  return (
    <div className="loading-center">
      <div className="spinner" />
    </div>
  );
}

// ─── App Bootstrap ────────────────────────────────────────────────────────────
function AppBootstrap({ children }: { children: React.ReactNode }) {
  const setAuth = useStore((s) => s.setAuth);
  const setCart = useStore((s) => s.setCart);
  const setLang = useStore((s) => s.setLang);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
    }

    const doAuth = async () => {
      const initData = tg?.initData || '';
      if (!initData && import.meta.env.DEV) {
        // In dev, skip Telegram auth
        return;
      }
      try {
        const res = await authApi.loginTelegram(initData);
        localStorage.setItem('access_token', res.access_token);
        setAuth(res.user_id);
        setLang(res.language || 'ru');

        // Load cart
        const cart = await cartApi.getCart();
        setCart(cart);
      } catch (e) {
        console.error('Auth failed', e);
      }
    };

    doAuth();
  }, []);

  return <>{children}</>;
}

// ─── Root App ─────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppBootstrap>
          <Toasts />
          <div className="page-scroll">
            <Suspense fallback={<PageFallback />}>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/how-it-works" element={<HowItWorksPage />} />
                <Route path="/product/:id" element={<ProductPage />} />
                <Route path="/cart" element={<CartPage />} />
                <Route path="/history" element={<HistoryPage />} />
                <Route path="/order/:id" element={<OrderStatusPage />} />
                <Route path="/payment/:id" element={<PaymentPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </div>
          <BottomNav />
        </AppBootstrap>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

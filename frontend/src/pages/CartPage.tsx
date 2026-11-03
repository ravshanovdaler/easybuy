import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { cartApi, ordersApi, paymentsApi, usersApi } from '../api/client';
import { useStore } from '../store';

export default function CartPage() {
  const navigate = useNavigate();
  const lang = useStore((s) => s.lang);
  const t = useStore((s) => s.t);
  const setCart = useStore((s) => s.setCart);
  const addToast = useStore((s) => s.addToast);

  const [step, setStep] = useState<'cart' | 'checkout'>('cart');
  const [selectedAddress, setSelectedAddress] = useState<number | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<number | null>(null);

  const { data: cartItems = [], refetch: refetchCart } = useQuery({
    queryKey: ['cart'],
    queryFn: cartApi.getCart,
  });

  const { data: addresses = [] } = useQuery({
    queryKey: ['addresses'],
    queryFn: usersApi.getAddresses,
    enabled: step === 'checkout',
  });

  const { data: methods = [] } = useQuery({
    queryKey: ['payment-methods'],
    queryFn: paymentsApi.getMethods,
    enabled: step === 'checkout',
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, qty }: { id: number; qty: number }) =>
      qty <= 0 ? cartApi.removeItem(id) : cartApi.updateItem(id, qty),
    onSuccess: async () => {
      const cart = await cartApi.getCart();
      setCart(cart);
      refetchCart();
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: () => ordersApi.checkout(selectedAddress!, selectedMethod!),
    onSuccess: (order) => {
      setCart([]);
      navigate(`/payment/${order.id}`);
    },
    onError: () => addToast('error', 'Checkout failed. Please try again.'),
  });

  const subtotal = cartItems.reduce(
    (sum: number, item: any) => sum + item.unit_price * item.quantity, 0
  );

  if (cartItems.length === 0) {
    return (
      <div className="fade-in">
        <div className="page-header"><span className="page-title">{t('cart_title')}</span></div>
        <div className="empty-state">
          <div className="empty-state__icon">🛒</div>
          <div className="empty-state__title">{t('empty_cart')}</div>
          <div className="empty-state__desc">{t('try_another_search')}</div>
          <button className="btn btn-primary" onClick={() => navigate('/')}>{t('browse_catalog')}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in" style={{ paddingBottom: 100 }}>
      <div className="page-header">
        <span className="page-title">{t('cart_title')} ({cartItems.length})</span>
        {step === 'checkout' && (
          <button className="btn btn-sm btn-secondary" onClick={() => setStep('cart')}>{t('back')}</button>
        )}
      </div>

      <div className="section">
        {step === 'cart' ? (
          <>
            {/* Cart Items */}
            {cartItems.map((item: any) => (
              <div key={item.id} className="cart-item">
                {item.thumbnail_url ? (
                  <img className="cart-item__img" src={item.thumbnail_url} alt="" />
                ) : (
                  <div className="cart-item__img" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>📦</div>
                )}
                <div className="cart-item__info">
                  <div className="cart-item__title">{t(item.title_i18n)}</div>
                  <div className="cart-item__price">${(item.unit_price * item.quantity).toFixed(2)}</div>
                  <div className="qty-control">
                    <button
                      className="qty-btn"
                      onClick={() => updateMutation.mutate({ id: item.id, qty: item.quantity - 1 })}
                    >−</button>
                    <span className="qty-value">{item.quantity}</span>
                    <button
                      className="qty-btn"
                      onClick={() => updateMutation.mutate({ id: item.id, qty: item.quantity + 1 })}
                    >+</button>
                  </div>
                </div>
              </div>
            ))}

            {/* Totals */}
            <div className="totals" style={{ marginTop: 16 }}>
              <div className="total-row">
                <span>{t('subtotal')}</span><span>${subtotal.toFixed(2)}</span>
              </div>
              <div className="total-row grand">
                <span>{t('total')}</span>
                <span className="amount">${subtotal.toFixed(2)}</span>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Checkout Step */}
            <div className="section-title" style={{ marginBottom: 12 }}>{t('select_address')}</div>
            {addresses.length === 0 ? (
              <div
                className="card"
                style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14 }}
              >
                {t('add_address_first')}{' '}
                <span
                  style={{ color: 'var(--accent-light)', cursor: 'pointer' }}
                  onClick={() => navigate('/settings')}
                >
                  ({t('nav_settings')})
                </span>
              </div>
            ) : (
              addresses.map((addr: any) => (
                <div
                  key={addr.id}
                  className="card"
                  style={{
                    marginBottom: 10, cursor: 'pointer',
                    borderColor: selectedAddress === addr.id ? 'var(--accent)' : 'var(--border)',
                    background: selectedAddress === addr.id ? 'rgba(108,99,255,0.08)' : 'var(--bg-card)',
                  }}
                  onClick={() => setSelectedAddress(addr.id)}
                >
                  <div style={{ fontWeight: 600 }}>{addr.recipient}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                    {addr.city}, {addr.street}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{addr.phone}</div>
                </div>
              ))
            )}

            <div className="section-title" style={{ marginBottom: 12, marginTop: 20 }}>{t('select_payment_method')}</div>
            {methods.map((m: any) => (
              <div
                key={m.id}
                className="card"
                style={{
                  marginBottom: 10, cursor: 'pointer',
                  borderColor: selectedMethod === m.id ? 'var(--accent)' : 'var(--border)',
                  background: selectedMethod === m.id ? 'rgba(108,99,255,0.08)' : 'var(--bg-card)',
                }}
                onClick={() => setSelectedMethod(m.id)}
              >
                <div style={{ fontWeight: 600 }}>💳 {m.title}</div>
                {m.details_text && (
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>{m.details_text}</div>
                )}
              </div>
            ))}

            {/* Order summary */}
            <div className="card" style={{ marginTop: 16 }}>
              <div className="section-title" style={{ marginBottom: 10 }}>{t('orders_title')}</div>
              <div className="total-row"><span>{t('subtotal')}</span><span>${subtotal.toFixed(2)}</span></div>
              <div className="total-row grand">
                <span>{t('total')}</span><span className="amount">${subtotal.toFixed(2)}</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Bottom CTA */}
      <div
        style={{
          position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
          width: '100%', maxWidth: 480,
          padding: '12px 16px 24px',
          background: 'linear-gradient(to top, var(--bg-primary) 60%, transparent)',
          zIndex: 100,
        }}
      >
        {step === 'cart' ? (
          <button className="btn btn-primary btn-full" onClick={() => setStep('checkout')}>
            {t('checkout')} — ${subtotal.toFixed(2)} →
          </button>
        ) : (
          <button
            className="btn btn-primary btn-full"
            onClick={() => checkoutMutation.mutate()}
            disabled={!selectedAddress || !selectedMethod || checkoutMutation.isPending}
          >
            {checkoutMutation.isPending ? (
              <span className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
            ) : (
              `✅ ${t('confirm_order')}`
            )}
          </button>
        )}
      </div>
    </div>
  );
}

import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

const steps = [
  { icon: '🔍', title: 'Browse', desc: 'Find products from Taobao, Pinduoduo, Poizon & 1688 — all in one place.' },
  { icon: '🛒', title: 'Order', desc: 'Add to cart and check out. We lock in the price for 24 hours.' },
  { icon: '💳', title: 'Pay manually', desc: 'Transfer money via our payment details and upload a screenshot as proof.' },
  { icon: '✅', title: 'We verify', desc: 'Our team reviews your payment proof and confirms within hours.' },
  { icon: '🛍', title: 'We buy in China', desc: 'After confirmation we purchase your items from the Chinese marketplace.' },
  { icon: '🏭', title: 'Inspection', desc: 'Items are inspected at our warehouse to ensure quality.' },
  { icon: '✈️', title: 'We ship', desc: 'Your order is shipped and you get a tracking number.' },
  { icon: '🎉', title: 'You receive', desc: 'Your package arrives! Delivery time: 14–30 days.' },
];

export default function HowItWorksPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (!tg) return;
    tg.BackButton.show();
    tg.BackButton.onClick(() => navigate(-1));
    return () => tg.BackButton.hide();
  }, [navigate]);

  return (
    <div className="fade-in" style={{ minHeight: '100vh' }}>
      <div className="page-header">
        <button onClick={() => navigate(-1)} className="btn btn-sm btn-secondary">← Back</button>
        <span className="page-title">How it works</span>
        <div />
      </div>

      {/* Hero */}
      <div style={{ padding: '24px 16px 8px', textAlign: 'center' }}>
        <div style={{ fontSize: 56, marginBottom: 12 }}>🌏</div>
        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>
          Products from China,<br />delivered to you
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6 }}>
          We hold <strong style={{ color: 'var(--warning)' }}>no inventory</strong>. Every order is
          purchased only after your payment is confirmed.
        </p>
      </div>

      {/* Steps */}
      <div style={{ padding: '20px 16px' }}>
        {steps.map((step, i) => (
          <div
            key={i}
            className="slide-up"
            style={{
              display: 'flex', gap: 16, marginBottom: 20,
              animationDelay: `${i * 0.06}s`,
            }}
          >
            <div
              style={{
                width: 52, height: 52, borderRadius: 'var(--r-md)',
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 24, flexShrink: 0,
              }}
            >
              {step.icon}
            </div>
            <div style={{ flex: 1, paddingTop: 4 }}>
              <div style={{ fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    background: 'var(--accent)', color: 'white', borderRadius: '50%',
                    width: 20, height: 20, fontSize: 11, fontWeight: 800,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {i + 1}
                </span>
                {step.title}
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{step.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Notice */}
      <div className="section">
        <div
          style={{
            background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)',
            borderRadius: 'var(--r-lg)', padding: '16px',
          }}
        >
          <div style={{ fontWeight: 700, color: 'var(--warning)', marginBottom: 6 }}>⚠️ Important</div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Delivery time is 14–30 days. Prices may vary due to exchange rates.
            Customs duties are the buyer's responsibility.
          </p>
        </div>
      </div>

      <div style={{ padding: '0 16px 32px' }}>
        <button className="btn btn-primary btn-full" onClick={() => navigate('/')}>
          🛍 Start Shopping
        </button>
      </div>
    </div>
  );
}

import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ordersApi } from '../api/client';

const STATUS_COLORS: Record<string, string> = {
  pending_payment:  'var(--warning)',
  payment_review:   '#60a5fa',
  payment_rejected: 'var(--danger)',
  approved:         'var(--success)',
  purchasing:       'var(--accent-light)',
  warehouse:        '#a78bfa',
  shipping:         '#34d399',
  delivered:        'var(--success)',
  cancelled:        'var(--text-muted)',
  expired:          'var(--danger)',
};

const STATUS_ICONS: Record<string, string> = {
  pending_payment: '⏳', payment_review: '👀', payment_rejected: '❌',
  approved: '✅', purchasing: '🛍', warehouse: '📦',
  shipping: '🚚', delivered: '🎉', cancelled: '🚫', expired: '⏰',
};

export default function HistoryPage() {
  const navigate = useNavigate();

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['orders'],
    queryFn: () => ordersApi.getOrders(),
    refetchInterval: 30_000,
  });

  return (
    <div className="fade-in">
      <div className="page-header">
        <span className="page-title">📦 My Orders</span>
      </div>

      {isLoading ? (
        <div style={{ padding: '0 16px' }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card" style={{ marginBottom: 12 }}>
              <div className="skeleton" style={{ height: 18, width: '60%', marginBottom: 10 }} />
              <div className="skeleton" style={{ height: 14, width: '40%' }} />
            </div>
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon">📦</div>
          <div className="empty-state__title">No orders yet</div>
          <div className="empty-state__desc">Your orders will appear here</div>
          <button className="btn btn-primary" onClick={() => navigate('/')}>Shop Now</button>
        </div>
      ) : (
        <div style={{ padding: '0 16px' }}>
          {orders.map((order: any) => (
            <div
              key={order.id}
              className="card slide-up"
              style={{ marginBottom: 12, cursor: 'pointer' }}
              onClick={() => navigate(`/order/${order.id}`)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>Order #{order.number}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
                    {new Date(order.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div
                  className="status-badge"
                  style={{
                    background: `${STATUS_COLORS[order.status]}20`,
                    color: STATUS_COLORS[order.status],
                  }}
                >
                  {STATUS_ICONS[order.status]} {order.status.replace(/_/g, ' ')}
                </div>
              </div>

              <div className="divider" />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  {order.items?.length || 0} item(s)
                </span>
                <span style={{ fontWeight: 700, color: 'var(--accent-light)' }}>
                  ${Number(order.total).toFixed(2)}
                </span>
              </div>

              {order.status === 'pending_payment' && order.payment_deadline_at && (
                <div className="countdown" style={{ marginTop: 10, marginBottom: 0 }}>
                  ⏰ Pay before {new Date(order.payment_deadline_at).toLocaleString()}
                </div>
              )}

              {order.tracking_number && (
                <div style={{ fontSize: 13, color: 'var(--success)', marginTop: 8 }}>
                  📮 Tracking: {order.tracking_number}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <div style={{ height: 16 }} />
    </div>
  );
}

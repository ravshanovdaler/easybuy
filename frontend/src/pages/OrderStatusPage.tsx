import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ordersApi } from '../api/client';
import { useStore } from '../store';

const STATUS_STEPS = [
  'pending_payment', 'payment_review', 'approved', 'purchasing', 'warehouse', 'shipping', 'delivered',
];

const STATUS_ICONS: Record<string, string> = {
  pending_payment: '⏳', payment_review: '👀', payment_rejected: '❌',
  approved: '✅', purchasing: '🛍', warehouse: '📦',
  shipping: '🚚', delivered: '🎉', cancelled: '🚫', expired: '⏰',
};

const STATUS_LABELS: Record<string, string> = {
  pending_payment: 'Pending Payment',
  payment_review: 'Payment Review',
  payment_rejected: 'Payment Rejected',
  approved: 'Payment Approved',
  purchasing: 'Purchasing in China',
  warehouse: 'At Warehouse',
  shipping: 'Shipping',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  expired: 'Expired',
};

export default function OrderStatusPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const addToast = useStore((s) => s.addToast);

  const { data: order, isLoading, refetch } = useQuery({
    queryKey: ['order', id],
    queryFn: () => ordersApi.getOrder(Number(id)),
    refetchInterval: 15_000,
  });

  const cancelMutation = useMutation({
    mutationFn: () => ordersApi.cancelOrder(Number(id)),
    onSuccess: () => {
      addToast('success', 'Order cancelled');
      refetch();
    },
    onError: () => addToast('error', 'Cannot cancel at this stage'),
  });

  if (isLoading || !order) {
    return (
      <div className="fade-in">
        <div className="page-header">
          <button className="btn btn-sm btn-secondary" onClick={() => navigate(-1)}>← Back</button>
          <span className="page-title">Order Status</span>
          <div />
        </div>
        <div className="loading-center"><div className="spinner" /></div>
      </div>
    );
  }

  const canCancel = ['pending_payment', 'payment_rejected'].includes(order.status);
  const canPay = order.status === 'pending_payment';
  const isActive = !['delivered', 'cancelled', 'expired'].includes(order.status);

  return (
    <div className="fade-in" style={{ paddingBottom: 100 }}>
      <div className="page-header">
        <button className="btn btn-sm btn-secondary" onClick={() => navigate(-1)}>← Back</button>
        <span className="page-title">#{order.number}</span>
        <div />
      </div>

      {/* Status Banner */}
      <div
        style={{
          margin: '0 16px 16px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r-lg)',
          padding: 16,
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 8 }}>{STATUS_ICONS[order.status]}</div>
        <div style={{ fontSize: 18, fontWeight: 700 }}>{STATUS_LABELS[order.status]}</div>
        {order.tracking_number && (
          <div style={{ marginTop: 8, fontSize: 13, color: 'var(--success)' }}>
            📮 Tracking: <strong>{order.tracking_number}</strong>
          </div>
        )}
      </div>

      {/* Payment deadline */}
      {order.status === 'pending_payment' && order.payment_deadline_at && (
        <div className="section">
          <div className="countdown">
            ⏰ Pay before {new Date(order.payment_deadline_at).toLocaleString()}
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="section">
        <div className="section-title">Status Timeline</div>
        <div className="timeline">
          {order.status_history.map((h: any, i: number) => (
            <div key={i} className="timeline-item">
              <div className={`timeline-dot ${i === order.status_history.length - 1 ? 'active' : ''}`}>
                {STATUS_ICONS[h.to_status] || '•'}
              </div>
              <div className="timeline-content">
                <div className="timeline-status">{STATUS_LABELS[h.to_status] || h.to_status}</div>
                <div className="timeline-time">
                  {new Date(h.created_at).toLocaleString()}
                  {h.actor_type && ` · ${h.actor_type}`}
                </div>
                {h.comment && <div className="timeline-comment">{h.comment}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Items */}
      <div className="section">
        <div className="section-title">Items</div>
        {order.items.map((item: any, i: number) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ flex: 1, fontSize: 14, color: 'var(--text-secondary)' }}>
              {Object.values(item.title_snapshot)[0] as string} × {item.quantity}
            </div>
            <div style={{ fontWeight: 600 }}>${(item.unit_price * item.quantity).toFixed(2)}</div>
          </div>
        ))}
        <div className="totals" style={{ marginTop: 12 }}>
          <div className="total-row"><span>Subtotal</span><span>${Number(order.subtotal).toFixed(2)}</span></div>
          <div className="total-row"><span>Shipping</span><span>${Number(order.shipping_fee).toFixed(2)}</span></div>
          <div className="total-row"><span>Service fee</span><span>${Number(order.service_fee).toFixed(2)}</span></div>
          <div className="total-row grand">
            <span>Total</span><span className="amount">${Number(order.total).toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Address */}
      {order.address_snapshot && (
        <div className="section">
          <div className="section-title">Delivery Address</div>
          <div className="card">
            <div style={{ fontWeight: 600 }}>{order.address_snapshot.recipient}</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
              {order.address_snapshot.city}, {order.address_snapshot.street}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{order.address_snapshot.phone}</div>
          </div>
        </div>
      )}

      {/* Action buttons */}
      {(canPay || canCancel) && (
        <div style={{ padding: '0 16px', display: 'flex', gap: 12, flexDirection: 'column' }}>
          {canPay && (
            <button
              className="btn btn-primary btn-full"
              onClick={() => navigate(`/payment/${order.id}`)}
            >
              💳 Go to Payment
            </button>
          )}
          {canCancel && (
            <button
              className="btn btn-secondary btn-full"
              onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending}
            >
              Cancel Order
            </button>
          )}
        </div>
      )}
      <div style={{ height: 24 }} />
    </div>
  );
}

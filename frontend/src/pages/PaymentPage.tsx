import { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { paymentsApi, ordersApi } from '../api/client';
import { useStore } from '../store';

function Countdown({ deadline }: { deadline: string }) {
  const [remaining, setRemaining] = useState('');

  useEffect(() => {
    const calc = () => {
      const diff = new Date(deadline).getTime() - Date.now();
      if (diff <= 0) { setRemaining('Expired'); return; }
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1_000);
      setRemaining(`${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`);
    };
    calc();
    const timer = setInterval(calc, 1000);
    return () => clearInterval(timer);
  }, [deadline]);

  return (
    <div className="countdown">
      ⏰ Time remaining: <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{remaining}</strong>
    </div>
  );
}

export default function PaymentPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const addToast = useStore((s) => s.addToast);
  const fileRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const { data: order } = useQuery({
    queryKey: ['order', id],
    queryFn: () => ordersApi.getOrder(Number(id)),
  });

  const { data: payment, refetch } = useQuery({
    queryKey: ['payment', id],
    queryFn: () => paymentsApi.getPayment(Number(id)),
    refetchInterval: 10_000,
  });

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (!tg) return;
    tg.BackButton.show();
    tg.BackButton.onClick(() => navigate(-1));
    return () => tg.BackButton.hide();
  }, [navigate]);

  const uploadMutation = useMutation({
    mutationFn: () => paymentsApi.uploadProof(Number(id), selectedFile!),
    onSuccess: () => {
      addToast('success', 'Payment proof uploaded! Waiting for review.');
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
      refetch();
    },
    onError: () => addToast('error', 'Upload failed. Please try again.'),
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  if (!payment) return <div className="loading-center"><div className="spinner" /></div>;

  const isReview = payment.status === 'review';
  const isRejected = payment.status === 'rejected';

  return (
    <div className="fade-in" style={{ paddingBottom: 100 }}>
      <div className="page-header">
        <button className="btn btn-sm btn-secondary" onClick={() => navigate(-1)}>← Back</button>
        <span className="page-title">💳 Payment</span>
        <div />
      </div>

      <div className="section">
        {/* Status Banner */}
        {isReview && (
          <div
            style={{
              background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.3)',
              borderRadius: 'var(--r-lg)', padding: 16, textAlign: 'center', marginBottom: 20,
            }}
          >
            <div style={{ fontSize: 36 }}>👀</div>
            <div style={{ fontWeight: 700, marginTop: 8 }}>Under Review</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
              Our team is checking your payment. Usually within a few hours.
            </div>
          </div>
        )}

        {isRejected && (
          <div
            style={{
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 'var(--r-lg)', padding: 16, marginBottom: 20,
            }}
          >
            <div style={{ fontWeight: 700, color: 'var(--danger)' }}>❌ Payment Rejected</div>
            {payment.reject_reason && (
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>
                Reason: {payment.reject_reason}
              </div>
            )}
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
              Please upload a new payment screenshot.
            </div>
          </div>
        )}

        {/* Amount */}
        <div
          className="glass-card"
          style={{ padding: 20, textAlign: 'center', marginBottom: 16 }}
        >
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Amount to Pay</div>
          <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--accent-light)', margin: '8px 0' }}>
            ${Number(payment.amount).toFixed(2)}
          </div>
          {order?.payment_deadline_at && <Countdown deadline={order.payment_deadline_at} />}
        </div>

        {/* Payment Method Details */}
        {payment.method && (
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>
              💳 {payment.method.title}
            </div>
            {payment.method.details_text && (
              <div style={{ fontSize: 14, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
                {payment.method.details_text}
              </div>
            )}
            {payment.method.qr_image_url && (
              <div style={{ textAlign: 'center', marginTop: 12 }}>
                <img
                  src={payment.method.qr_image_url}
                  alt="QR Code"
                  style={{ width: 180, height: 180, borderRadius: 'var(--r-md)' }}
                />
              </div>
            )}
          </div>
        )}

        {/* Upload Proof */}
        {!isReview && (
          <>
            <div className="section-title">Upload Payment Screenshot</div>
            <div
              className={`upload-area ${previewUrl ? 'drag-over' : ''}`}
              onClick={() => fileRef.current?.click()}
            >
              {previewUrl ? (
                <img
                  src={previewUrl}
                  style={{ maxWidth: '100%', maxHeight: 240, borderRadius: 'var(--r-md)', objectFit: 'contain' }}
                  alt="Preview"
                />
              ) : (
                <>
                  <div className="upload-area__icon">📸</div>
                  <div className="upload-area__text">Tap to upload screenshot</div>
                  <div className="upload-area__sub">JPEG, PNG or WebP · max 10MB</div>
                </>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
          </>
        )}
      </div>

      {/* Submit button */}
      {!isReview && selectedFile && (
        <div style={{ padding: '0 16px' }}>
          <button
            className="btn btn-primary btn-full"
            onClick={() => uploadMutation.mutate()}
            disabled={uploadMutation.isPending}
          >
            {uploadMutation.isPending ? (
              <><span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> Uploading...</>
            ) : (
              '✅ Submit Payment Proof'
            )}
          </button>
        </div>
      )}

      {isReview && (
        <div style={{ padding: '0 16px' }}>
          <button
            className="btn btn-secondary btn-full"
            onClick={() => navigate(`/order/${id}`)}
          >
            View Order Status
          </button>
        </div>
      )}
      <div style={{ height: 24 }} />
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { catalogApi, cartApi } from '../api/client';
import { useStore } from '../store';

export default function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const lang = useStore((s) => s.lang);
  const t = useStore((s) => s.t);
  const setCart = useStore((s) => s.setCart);
  const addToast = useStore((s) => s.addToast);

  const [imgIndex, setImgIndex] = useState(0);
  const [selectedValues, setSelectedValues] = useState<Record<number, number>>({});
  const [isLiked, setIsLiked] = useState(false);

  const { data: product, isLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: () => catalogApi.getProduct(Number(id)),
  });

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (!tg) return;
    tg.BackButton.show();
    tg.BackButton.onClick(() => navigate(-1));
    return () => tg.BackButton.hide();
  }, [navigate]);

  const likeMutation = useMutation({
    mutationFn: () => catalogApi.toggleLike(Number(id)),
    onMutate: () => {
      setIsLiked((prev) => !prev);
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light');
    },
  });

  const addToCartMutation = useMutation({
    mutationFn: () => {
      const variantId = resolveVariant();
      return cartApi.addItem(Number(id), variantId);
    },
    onSuccess: async () => {
      const cart = await cartApi.getCart();
      setCart(cart);
      addToast('success', t('added_to_cart'));
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
    },
    onError: () => addToast('error', t('failed_add_cart')),
  });

  function resolveVariant(): number | undefined {
    if (!product?.variants?.length) return undefined;
    const valueIds = Object.values(selectedValues);
    const match = product.variants.find((v: any) =>
      valueIds.every((vid) => v.option_value_ids.includes(vid))
    );
    return match?.id;
  }

  function getPrice(): number {
    if (!product) return 0;
    const variantId = resolveVariant();
    const variant = product.variants?.find((v: any) => v.id === variantId);
    return Number(variant?.price ?? product.base_price);
  }

  if (isLoading || !product) {
    return (
      <div className="fade-in">
        <div className="skeleton" style={{ aspectRatio: '1', width: '100%' }} />
        <div style={{ padding: 16 }}>
          <div className="skeleton" style={{ height: 24, marginBottom: 12, width: '80%' }} />
          <div className="skeleton" style={{ height: 32, marginBottom: 16, width: '40%' }} />
          <div className="skeleton" style={{ height: 80 }} />
        </div>
      </div>
    );
  }

  const galleryMedia = product.media.filter((m: any) => m.kind === 'gallery');
  const buyerPhotos = product.media.filter((m: any) => m.kind === 'buyer_photo');

  return (
    <div className="fade-in" style={{ paddingBottom: 100 }}>
      {/* Image Carousel */}
      <div className="carousel" style={{ borderRadius: 0 }}>
        <div
          className="carousel__slides"
          style={{ transform: `translateX(-${imgIndex * 100}%)` }}
        >
          {galleryMedia.length > 0 ? (
            galleryMedia.map((m: any, i: number) => (
              <div key={i} className="carousel__slide">
                <img src={m.url} alt={`Product ${i + 1}`} loading={i === 0 ? 'eager' : 'lazy'} />
              </div>
            ))
          ) : (
            <div
              className="carousel__slide"
              style={{ background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 80 }}
            >
              📦
            </div>
          )}
        </div>
        {galleryMedia.length > 1 && (
          <div className="carousel__dots">
            {galleryMedia.map((_: any, i: number) => (
              <div
                key={i}
                className={`carousel__dot ${i === imgIndex ? 'active' : ''}`}
                onClick={() => setImgIndex(i)}
              />
            ))}
          </div>
        )}
        {/* Like & Back buttons overlay */}
        <div style={{ position: 'absolute', top: 16, left: 16, right: 16, display: 'flex', justifyContent: 'space-between' }}>
          <button
            className="btn btn-sm"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', color: 'white' }}
            onClick={() => navigate(-1)}
          >
            {t('back')}
          </button>
          <button
            className="btn btn-sm"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', color: isLiked ? '#ff6b6b' : 'white' }}
            onClick={() => likeMutation.mutate()}
          >
            {isLiked ? '❤️' : '🤍'} {product.likes_count + (isLiked ? 1 : 0)}
          </button>
        </div>
      </div>

      {/* Info */}
      <div style={{ padding: '16px 16px 0' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, lineHeight: 1.3 }}>
          {t(product.title_i18n)}
        </h1>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 16 }}>
          <span style={{ fontSize: 26, fontWeight: 800, color: 'var(--accent-light)' }}>
            ${getPrice().toFixed(2)}
          </span>
          {product.shipping_fee > 0 && (
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              + ${Number(product.shipping_fee).toFixed(2)} {t('shipping')}
            </span>
          )}
        </div>

        {/* Options */}
        {product.options?.map((opt: any) => (
          <div key={opt.id} className="option-group">
            <div className="option-label">{t(opt.name_i18n)}</div>
            <div className="option-values">
              {opt.values.map((val: any) => (
                <button
                  key={val.id}
                  className={`option-value ${selectedValues[opt.id] === val.id ? 'selected' : ''}`}
                  onClick={() => {
                    setSelectedValues((prev) => ({ ...prev, [opt.id]: val.id }));
                    window.Telegram?.WebApp?.HapticFeedback?.selectionChanged();
                  }}
                >
                  {val.image_url && (
                    <img
                      src={val.image_url}
                      style={{ width: 16, height: 16, borderRadius: '50%', objectFit: 'cover', verticalAlign: 'middle', marginRight: 4 }}
                      alt=""
                    />
                  )}
                  {t(val.value_i18n)}
                </button>
              ))}
            </div>
          </div>
        ))}

        {/* Description */}
        {product.description_i18n && (
          <div style={{ marginBottom: 20 }}>
            <div className="section-title">{t('description')}</div>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              {t(product.description_i18n)}
            </p>
          </div>
        )}

        {/* Buyer Photos */}
        {buyerPhotos.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div className="section-title">Buyer Photos</div>
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
              {buyerPhotos.map((m: any, i: number) => (
                <div key={i} style={{ position: 'relative', flexShrink: 0 }}>
                  <img
                    src={m.url}
                    style={{ width: 80, height: 80, borderRadius: 'var(--r-sm)', objectFit: 'cover' }}
                    loading="lazy"
                  />
                  {m.source_platform && (
                    <span
                      style={{
                        position: 'absolute', bottom: 4, right: 4,
                        background: 'rgba(0,0,0,0.7)', color: 'white',
                        fontSize: 9, padding: '2px 4px', borderRadius: 4,
                      }}
                    >
                      {m.source_platform}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Add to Cart Button - fixed at bottom */}
      <div
        style={{
          position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
          width: '100%', maxWidth: 480, padding: '12px 16px 24px',
          background: 'linear-gradient(to top, var(--bg-primary) 60%, transparent)',
          zIndex: 100,
        }}
      >
        <button
          className="btn btn-primary btn-full"
          style={{ fontSize: 16 }}
          onClick={() => addToCartMutation.mutate()}
          disabled={addToCartMutation.isPending}
        >
          {addToCartMutation.isPending ? (
            <span className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
          ) : (
            `🛒 ${t('add_to_cart')} — $${getPrice().toFixed(2)}`
          )}
        </button>
      </div>
    </div>
  );
}

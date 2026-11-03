import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { catalogApi } from '../api/client';
import { useStore } from '../store';

function ProductSkeleton() {
  return (
    <div className="product-card">
      <div className="skeleton" style={{ aspectRatio: '1', width: '100%' }} />
      <div className="product-card__body">
        <div className="skeleton" style={{ height: 32, marginBottom: 8 }} />
        <div className="skeleton" style={{ height: 18, width: '50%' }} />
      </div>
    </div>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  const lang = useStore((s) => s.lang);
  const t = useStore((s) => s.t);
  const [selectedCat, setSelectedCat] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search
  const handleSearch = useCallback((val: string) => {
    setSearch(val);
    clearTimeout((window as any)._searchTimer);
    (window as any)._searchTimer = setTimeout(() => setDebouncedSearch(val), 400);
  }, []);

  const { data: rawCategories, isError: catError } = useQuery({
    queryKey: ['categories'],
    queryFn: catalogApi.getCategories,
  });

  const { data: rawProducts, isLoading, isError: prodError, error } = useQuery({
    queryKey: ['products', selectedCat, debouncedSearch],
    queryFn: () =>
      catalogApi.getProducts({
        category_id: selectedCat ?? undefined,
        search: debouncedSearch || undefined,
      }),
  });

  const categories = Array.isArray(rawCategories) ? rawCategories : [];
  const products = Array.isArray(rawProducts) ? rawProducts : [];
  const isApiError = catError || prodError;

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="page-header">
        <h1>🛍 EasyBuy</h1>
        <button
          className="btn btn-sm btn-secondary"
          onClick={() => navigate('/how-it-works')}
          style={{ fontSize: 12 }}
        >
          {t('how_it_works')}
        </button>
      </div>

      {isApiError && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.12)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '12px',
          padding: '12px 16px',
          margin: '0 16px 16px',
          color: '#f87171',
          fontSize: '13px'
        }}>
          <strong>⚠️ {t('backend_not_connected')}</strong>
          <p style={{ margin: '4px 0 0', opacity: 0.85 }}>
            {(error as any)?.message || 'Unable to connect to the backend API. Please ensure your PythonAnywhere server is running and VITE_API_URL is configured.'}
          </p>
        </div>
      )}

      {/* Search */}
      <div className="search-bar">
        <span className="search-icon">🔍</span>
        <input
          type="text"
          placeholder={t('search_placeholder')}
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
        />
      </div>

      {/* Category chips */}
      <div className="category-chips">
        <button
          className={`chip ${selectedCat === null ? 'active' : ''}`}
          onClick={() => setSelectedCat(null)}
        >
          {t('all_categories')}
        </button>
        {categories.map((cat: any) => (
          <button
            key={cat.id}
            className={`chip ${selectedCat === cat.id ? 'active' : ''}`}
            onClick={() => setSelectedCat(cat.id)}
          >
            {cat.icon} {t(cat.name_i18n)}
          </button>
        ))}
      </div>

      {/* Product grid */}
      <div className="product-grid">
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => <ProductSkeleton key={i} />)
          : products.length === 0
          ? null
          : products.map((p: any) => (
              <div
                key={p.id}
                className="product-card slide-up"
                onClick={() => navigate(`/product/${p.id}`)}
              >
                {p.thumbnail_url ? (
                  <img
                    className="product-card__image"
                    src={p.thumbnail_url}
                    alt={t(p.title_i18n)}
                    loading="lazy"
                  />
                ) : (
                  <div
                    className="product-card__image"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 40,
                    }}
                  >
                    📦
                  </div>
                )}
                <div className="product-card__body">
                  <div className="product-card__title">{t(p.title_i18n)}</div>
                  <div className="product-card__price">
                    ${Number(p.base_price).toFixed(2)}
                  </div>
                  <div className="product-card__likes">❤️ {p.likes_count}</div>
                </div>
              </div>
            ))}
      </div>

      {!isLoading && !isApiError && products.length === 0 && (
        <div className="empty-state">
          <div className="empty-state__icon">🔍</div>
          <div className="empty-state__title">{t('no_products')}</div>
          <div className="empty-state__desc">{t('try_another_search')}</div>
        </div>
      )}

      <div style={{ height: 24 }} />
    </div>
  );
}

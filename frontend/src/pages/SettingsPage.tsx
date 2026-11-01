import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '../api/client';
import { useStore } from '../store';

export default function SettingsPage() {
  const qc = useQueryClient();
  const lang = useStore((s) => s.lang);
  const setLang = useStore((s) => s.setLang);
  const addToast = useStore((s) => s.addToast);

  const [showAddAddress, setShowAddAddress] = useState(false);
  const [newAddr, setNewAddr] = useState({
    recipient: '', phone: '', city: '', street: '',
    country: 'Uzbekistan', region: '', postal_code: '', is_default: true,
  });

  const { data: profile } = useQuery({ queryKey: ['profile'], queryFn: usersApi.getProfile });
  const { data: addresses = [], refetch: refetchAddr } = useQuery({
    queryKey: ['addresses'],
    queryFn: usersApi.getAddresses,
  });

  const updateLang = useMutation({
    mutationFn: (l: string) => usersApi.updateProfile({ language: l }),
    onSuccess: () => {
      addToast('success', 'Language updated');
      qc.invalidateQueries({ queryKey: ['profile'] });
    },
  });

  const addAddrMutation = useMutation({
    mutationFn: () => usersApi.createAddress(newAddr),
    onSuccess: () => {
      addToast('success', 'Address added');
      setShowAddAddress(false);
      setNewAddr({ recipient: '', phone: '', city: '', street: '', country: 'Uzbekistan', region: '', postal_code: '', is_default: true });
      refetchAddr();
    },
    onError: () => addToast('error', 'Failed to add address'),
  });

  const deleteAddr = useMutation({
    mutationFn: (id: number) => usersApi.deleteAddress(id),
    onSuccess: () => { addToast('success', 'Address removed'); refetchAddr(); },
  });

  return (
    <div className="fade-in" style={{ paddingBottom: 40 }}>
      <div className="page-header">
        <span className="page-title">⚙️ Settings</span>
      </div>

      {/* Profile */}
      <div className="section">
        <div className="section-title">Profile</div>
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 52, height: 52, borderRadius: '50%',
                background: 'var(--accent)', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 22, fontWeight: 700, color: 'white',
              }}
            >
              {profile?.first_name?.[0] || '?'}
            </div>
            <div>
              <div style={{ fontWeight: 700 }}>
                {profile?.first_name} {profile?.last_name}
              </div>
              {profile?.username && (
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>@{profile.username}</div>
              )}
              {profile?.phone && (
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>📞 {profile.phone}</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Language */}
      <div className="section">
        <div className="section-title">Language</div>
        <div style={{ display: 'flex', gap: 10 }}>
          {[
            { code: 'ru', label: '🇷🇺 Русский' },
            { code: 'uz', label: '🇺🇿 O\'zbek' },
          ].map(({ code, label }) => (
            <button
              key={code}
              className={`chip ${lang === code ? 'active' : ''}`}
              onClick={() => {
                setLang(code);
                updateLang.mutate(code);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Addresses */}
      <div className="section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div className="section-title" style={{ marginBottom: 0 }}>Delivery Addresses</div>
          <button className="btn btn-sm btn-secondary" onClick={() => setShowAddAddress(!showAddAddress)}>
            {showAddAddress ? '✕' : '+ Add'}
          </button>
        </div>

        {showAddAddress && (
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="form-group">
              <label className="form-label">Recipient name *</label>
              <input className="form-input" value={newAddr.recipient}
                onChange={(e) => setNewAddr({ ...newAddr, recipient: e.target.value })}
                placeholder="Full name" />
            </div>
            <div className="form-group">
              <label className="form-label">Phone *</label>
              <input className="form-input" value={newAddr.phone}
                onChange={(e) => setNewAddr({ ...newAddr, phone: e.target.value })}
                placeholder="+998 90 000 0000" type="tel" />
            </div>
            <div className="form-group">
              <label className="form-label">City *</label>
              <input className="form-input" value={newAddr.city}
                onChange={(e) => setNewAddr({ ...newAddr, city: e.target.value })}
                placeholder="Tashkent" />
            </div>
            <div className="form-group">
              <label className="form-label">Street / Address *</label>
              <input className="form-input" value={newAddr.street}
                onChange={(e) => setNewAddr({ ...newAddr, street: e.target.value })}
                placeholder="Street, building, apt" />
            </div>
            <div className="form-group">
              <label className="form-label">Region</label>
              <input className="form-input" value={newAddr.region}
                onChange={(e) => setNewAddr({ ...newAddr, region: e.target.value })}
                placeholder="Region (optional)" />
            </div>
            <button
              className="btn btn-primary btn-full"
              onClick={() => addAddrMutation.mutate()}
              disabled={!newAddr.recipient || !newAddr.phone || !newAddr.city || !newAddr.street || addAddrMutation.isPending}
            >
              {addAddrMutation.isPending ? 'Saving...' : 'Save Address'}
            </button>
          </div>
        )}

        {addresses.length === 0 && !showAddAddress && (
          <div style={{ color: 'var(--text-muted)', fontSize: 14, textAlign: 'center', padding: 16 }}>
            No saved addresses yet
          </div>
        )}

        {addresses.map((addr: any) => (
          <div key={addr.id} className="card" style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                {addr.is_default && (
                  <span style={{ fontSize: 11, background: 'var(--accent)', color: 'white', padding: '2px 6px', borderRadius: 'var(--r-full)', marginBottom: 6, display: 'inline-block' }}>
                    Default
                  </span>
                )}
                <div style={{ fontWeight: 600 }}>{addr.recipient}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{addr.city}, {addr.street}</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{addr.phone}</div>
              </div>
              <button
                style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 18, padding: 4 }}
                onClick={() => deleteAddr.mutate(addr.id)}
              >🗑</button>
            </div>
          </div>
        ))}
      </div>

      {/* Support & Legal */}
      <div className="section">
        <div className="section-title">Support & Legal</div>
        <div className="card">
          {[
            { label: '💬 Contact Support', link: 'https://t.me/yoursupport' },
            { label: '📋 Terms of Service', link: '#' },
            { label: '↩️ Refund Policy', link: '#' },
          ].map(({ label, link }) => (
            <a
              key={label}
              href={link}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 0', borderBottom: '1px solid var(--border)',
                color: 'var(--text-primary)', textDecoration: 'none', fontSize: 14,
              }}
            >
              {label} <span style={{ color: 'var(--text-muted)' }}>›</span>
            </a>
          ))}
          <div style={{ padding: '12px 0', fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
            EasyBuy v1.0 · Made with ❤️
          </div>
        </div>
      </div>
    </div>
  );
}

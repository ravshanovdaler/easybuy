import { create } from 'zustand';

interface CartItem {
  id: number;
  product_id: number;
  variant_id?: number;
  quantity: number;
  title_i18n: Record<string, string>;
  unit_price: number;
  currency: string;
  thumbnail_url?: string;
}

interface AppStore {
  // Cart
  cartItems: CartItem[];
  cartCount: number;
  setCart: (items: CartItem[]) => void;

  // Language
  lang: string;
  setLang: (l: string) => void;
  t: (key: Record<string, string>) => string;

  // Auth
  isAuthed: boolean;
  userId: number | null;
  setAuth: (userId: number) => void;

  // Toast
  toasts: { id: number; type: string; message: string }[];
  addToast: (type: string, message: string) => void;
  removeToast: (id: number) => void;
}

let toastId = 0;

export const useStore = create<AppStore>((set, get) => ({
  // Cart
  cartItems: [],
  cartCount: 0,
  setCart: (items) => set({ cartItems: items, cartCount: items.reduce((s, i) => s + i.quantity, 0) }),

  // Language
  lang: localStorage.getItem('lang') || 'ru',
  setLang: (l) => {
    localStorage.setItem('lang', l);
    set({ lang: l });
  },
  t: (key) => {
    const { lang } = get();
    return key[lang] || key['ru'] || key['en'] || Object.values(key)[0] || '';
  },

  // Auth
  isAuthed: !!localStorage.getItem('access_token'),
  userId: null,
  setAuth: (userId) => set({ isAuthed: true, userId }),

  // Toast
  toasts: [],
  addToast: (type, message) => {
    const id = ++toastId;
    set((s) => ({ toasts: [...s.toasts, { id, type, message }] }));
    setTimeout(() => get().removeToast(id), 3500);
  },
  removeToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

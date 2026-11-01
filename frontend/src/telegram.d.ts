// Telegram WebApp SDK types
declare global {
  interface Window {
    Telegram: {
      WebApp: {
        initData: string;
        initDataUnsafe: {
          user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
            language_code?: string;
          };
          start_param?: string;
        };
        ready(): void;
        expand(): void;
        close(): void;
        enableClosingConfirmation(): void;
        disableClosingConfirmation(): void;
        colorScheme: 'light' | 'dark';
        themeParams: {
          bg_color?: string;
          text_color?: string;
          button_color?: string;
        };
        BackButton: {
          show(): void;
          hide(): void;
          onClick(cb: () => void): void;
          offClick(cb: () => void): void;
          isVisible: boolean;
        };
        MainButton: {
          text: string;
          color: string;
          isVisible: boolean;
          isActive: boolean;
          setText(text: string): void;
          show(): void;
          hide(): void;
          enable(): void;
          disable(): void;
          showProgress(): void;
          hideProgress(): void;
          onClick(cb: () => void): void;
          offClick(cb: () => void): void;
        };
        HapticFeedback: {
          impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void;
          notificationOccurred(type: 'error' | 'success' | 'warning'): void;
          selectionChanged(): void;
        };
        safeAreaInsets: {
          top: number; bottom: number; left: number; right: number;
        };
      };
    };
  }
}

export {};

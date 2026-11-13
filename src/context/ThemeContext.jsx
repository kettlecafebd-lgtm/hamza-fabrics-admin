import React, { createContext, useState, useEffect, useCallback, useContext } from 'react';
import { getSystemSettings } from '../lib/systemSettings';

export const ThemeContext = createContext();

const FALLBACK_THEME = 'theme-light-premium';
const AVAILABLE_THEMES = [
  { id: 'theme-light-premium', name: 'Mint Corporate', type: 'Light' },
  { id: 'theme-dark-midnight', name: 'Onyx & Cyber Mint', type: 'Dark' },
  { id: 'theme-ocean-depth', name: 'Ocean Depth', type: 'Dark' },
  { id: 'theme-nordic-frost', name: 'Nordic Frost', type: 'Light' },
  { id: 'theme-rose-quartz', name: 'Rose Quartz', type: 'Light' },
  { id: 'theme-evergreen', name: 'Evergreen', type: 'Dark' },
  { id: 'theme-midnight-sapphire', name: 'Midnight Sapphire', type: 'Dark' },
  { id: 'theme-glassmorphism', name: 'Glassmorphism', type: 'Light' },
  { id: 'theme-sand-night', name: 'Sand & Night', type: 'Light' },
  { id: 'theme-forest-purple', name: 'Forest & Purple', type: 'Dark' },
  { id: 'theme-pop-yellow', name: 'Pop Yellow', type: 'Light' },
  { id: 'theme-silver-slate', name: 'Silver Slate', type: 'Dark' },
  { id: 'theme-dark-orange', name: 'Dark Orange', type: 'Dark' },
  { id: 'light', name: 'Light Mode', type: 'Light' },
  { id: 'dark', name: 'Dark Mode', type: 'Dark' },
];

const getThemeType = (themeId) => {
  const found = AVAILABLE_THEMES.find(t => t.id === themeId);
  return found ? found.type : 'Light';
};

export const ThemeProvider = ({ children }) => {
  const [adminTheme, setAdminTheme] = useState(() => localStorage.getItem('hamzabi-admin-theme') || FALLBACK_THEME);
  const [shopTheme, setShopTheme] = useState(FALLBACK_THEME);

  const isAdminDark = getThemeType(adminTheme) === 'Dark';
  const isShopDark = getThemeType(shopTheme) === 'Dark';

  useEffect(() => {
    const root = window.document.documentElement;
    AVAILABLE_THEMES.forEach(t => root.classList.remove(t.id));
    root.classList.add(adminTheme);
  }, [adminTheme]);

  useEffect(() => {
    let cancelled = false;
    // De-duplicated read: the sidebar and login screen ask for the same payload.
    getSystemSettings()
      .then(data => {
        if (cancelled || !data.success || !data.data) return;
        if (data.data.admin_theme) {
          setAdminTheme(data.data.admin_theme);
          localStorage.setItem('hamzabi-admin-theme', data.data.admin_theme);
        }
        if (data.data.shop_theme) {
          setShopTheme(data.data.shop_theme);
        }
      })
      .catch(err => console.error("Failed to load theme from DB:", err));
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    localStorage.setItem('hamzabi-admin-theme', adminTheme);
  }, [adminTheme]);

  const changeAdminTheme = useCallback((newTheme) => {
    setAdminTheme(newTheme);
    localStorage.setItem('hamzabi-admin-theme', newTheme);
  }, []);

  const changeShopTheme = useCallback((newTheme) => {
    setShopTheme(newTheme);
  }, []);

  const refreshShopTheme = useCallback(() => {
    getSystemSettings({ force: true })
      .then(data => {
        if (data.success && data.data && data.data.shop_theme) {
          setShopTheme(data.data.shop_theme);
        }
      })
      .catch(() => {});
  }, []);

  const toggleTheme = useCallback(() => {
    setAdminTheme((prev) => {
      const currentType = getThemeType(prev);
      const targetType = currentType === 'Dark' ? 'Light' : 'Dark';
      const firstOfType = AVAILABLE_THEMES.find(t => t.type === targetType);
      const next = firstOfType ? firstOfType.id : prev;
      localStorage.setItem('hamzabi-admin-theme', next);
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ adminTheme, shopTheme, isAdminDark, isShopDark, changeAdminTheme, changeShopTheme, refreshShopTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);

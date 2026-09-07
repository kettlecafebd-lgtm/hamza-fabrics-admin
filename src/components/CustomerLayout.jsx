import React, { useEffect, useContext } from 'react';
import { Outlet } from 'react-router-dom';
import { ThemeContext } from '../context/ThemeContext';

import Navbar from './Navbar'; 
import SideCart from './SideCart';
import Footer from './Footer';

export default function CustomerLayout() {
  const { shopTheme, refreshShopTheme } = useContext(ThemeContext);

  useEffect(() => {
    refreshShopTheme();
  }, []);

  useEffect(() => {
    document.documentElement.className = shopTheme;
  }, [shopTheme]);

  return (
    <div className="min-h-screen bg-t-base text-t-main font-sans transition-colors duration-300 flex flex-col relative overflow-x-hidden">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-t-primary focus:text-white focus:rounded-lg">
        Skip to main content
      </a>

      <Navbar />
      <SideCart />

      <main id="main-content" role="main" aria-label="Main content" className="flex-grow pt-20 sm:pt-24">
        <Outlet />
      </main>

      <Footer />
    </div>
  );
}

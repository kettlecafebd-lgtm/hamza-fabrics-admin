import React, { useState, useEffect, useRef, useContext } from 'react';
import { Link } from 'react-router-dom';
// 🔴 ThemeContext ইমপোর্ট করা হলো
import { ThemeContext } from '../context/ThemeContext';

export default function Footer() {
  // 🔴 Context থেকে shopTheme নিয়ে আসা হলো
  const { shopTheme, isShopDark } = useContext(ThemeContext);

  const [footerSettings, setFooterSettings] = useState({
    title: 'Crafted for the modern woman.',
    description: 'Experience the finest quality fabrics, intricate embroideries, and breathtaking designs that make you stand out on every occasion.',
    copyright: '© 2026 HAMZA FABRICS. ALL RIGHTS RESERVED.',
    socialLinks: { 
      facebook: 'https://www.facebook.com/share/1A6gc6zkdi/?mibextid=wwXIfr', 
      instagram: 'https://www.instagram.com/hamza_fabrics_official', 
      tiktok: 'https://www.tiktok.com/@hamza_fabrics' 
    },
    images: ['https://images.unsplash.com/photo-1618932260643-eee4a2f652a6?q=80&w=1000'],
    deliveryPartners: [] 
  });

  const scrollRef = useRef(null);

  useEffect(() => {
    const loadSettings = () => {
      const savedSettings = localStorage.getItem('siteSettings');
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        
        const parsedImages = parsed.footerImages || parsed.footer_images;
        const fallbackImage = parsed.footerImage || parsed.footer_image;
        const parsedPartners = parsed.deliveryPartners || parsed.delivery_partners || [];

        setFooterSettings({
          title: parsed.footerTitle || parsed.footer_title || 'Crafted for the modern woman.',
          description: parsed.footerDescription || parsed.footer_description || 'Experience the finest quality fabrics, intricate embroideries, and breathtaking designs that make you stand out on every occasion.',
          copyright: parsed.footerCopyright || parsed.footer_copyright || '© 2026 HAMZA FABRICS. ALL RIGHTS RESERVED.',
          socialLinks: parsed.socialLinks || parsed.social_links || { 
            facebook: 'https://www.facebook.com/share/1A6gc6zkdi/?mibextid=wwXIfr', 
            instagram: 'https://www.instagram.com/hamza_fabrics_official', 
            tiktok: 'https://www.tiktok.com/@hamza_fabrics' 
          },
          images: parsedImages && parsedImages.length > 0 
                  ? parsedImages 
                  : (fallbackImage ? [fallbackImage] : ['https://images.unsplash.com/photo-1618932260643-eee4a2f652a6?q=80&w=1000']),
          deliveryPartners: parsedPartners
        });
      }
    };

    loadSettings();
    window.addEventListener('storage', loadSettings);
    return () => window.removeEventListener('storage', loadSettings);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (scrollRef.current) {
        const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
        if (scrollLeft + clientWidth >= scrollWidth - 10) {
          scrollRef.current.scrollTo({ left: 0, behavior: 'smooth' });
        } else {
          scrollRef.current.scrollBy({ left: 240, behavior: 'smooth' });
        }
      }
    }, 3500); 
    return () => clearInterval(interval);
  }, []);

  return (
    // 🔴 Main Footer-এ shopTheme ক্লাস যোগ করা হলো
    <footer className={`bg-t-surface pt-16 pb-8 border-t border-t-border mt-16 relative overflow-hidden transition-colors duration-300 ${shopTheme}`}>
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        
        {/* 🔴 mb-12 থেকে mb-8 করা হয়েছে স্পেস কমানোর জন্য */}
        <div className="max-w-3xl mx-auto text-center mb-8">
          {/* 🔴 ফন্ট চেঞ্জ করা হয়েছে: italic রিমুভ করে font-extrabold ও uppercase দেওয়া হয়েছে এবং mb-2 করা হয়েছে */}
          <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold uppercase tracking-[0.15em] text-t-main leading-snug mb-2 transition-colors drop-shadow-sm">
            {footerSettings.title}
          </h2>
          {/* 🔴 ডেসক্রিপশনের লিডিং(line-height) কমিয়ে স্পেস কমানো হয়েছে */}
          <p className="text-t-muted text-[10px] md:text-xs font-bold tracking-[0.2em] uppercase leading-snug mx-auto max-w-xl transition-colors">
            {footerSettings.description}
          </p>
        </div>

        {footerSettings.images.length > 0 && (
          <div className="relative w-full mb-16">
            <div 
              ref={scrollRef}
              className="flex overflow-x-auto gap-3 md:gap-5 pb-4 snap-x snap-mandatory scroll-smooth [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
            >
              {footerSettings.images.map((imgUrl, index) => (
                <div key={index} className="shrink-0 w-[180px] md:w-[220px] aspect-[4/5] snap-center rounded-xl overflow-hidden shadow-sm border border-t-border group relative cursor-grab active:cursor-grabbing bg-t-base">
                  {/* 🔴 ইমেজে ease-in-out এবং brightness ইফেক্ট দিয়ে আরও স্মুথ করা হয়েছে */}
                  <img src={imgUrl} alt={`Gallery ${index + 1}`} className="w-full h-full object-cover transition-all duration-700 ease-in-out group-hover:scale-105 group-hover:brightness-110" loading="lazy" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-700 ease-in-out"></div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="border-t border-t-border pt-10 mb-10 transition-colors">
          <div className="flex flex-col md:flex-row justify-between items-center gap-10">
            
            <div className="text-center md:text-left w-full md:w-1/2">
              <p className="text-[9px] font-black text-t-muted uppercase tracking-[0.2em] mb-4">100% Secure Checkout</p>
              <img src="https://securepay.sslcommerz.com/public/image/SSLCommerz-Pay-With-logo-All-Size-01.png" alt="SSLCOMMERZ Secure Pay" className="w-full max-w-[300px] mx-auto md:mx-0 object-contain opacity-90 hover:opacity-100 transition-opacity" />
            </div>

            <div className="text-center md:text-right w-full md:w-1/2 flex flex-col items-center md:items-end">
              <p className="text-[9px] font-black text-t-muted uppercase tracking-[0.2em] mb-4">Our Delivery Partners</p>
              <div className="flex items-center justify-center md:justify-end gap-5 bg-t-base/80 p-3 rounded-xl border border-t-border/60 transition-colors shadow-sm flex-wrap">
                {footerSettings.deliveryPartners.length > 0 ? (
                  footerSettings.deliveryPartners.map((dp, idx) => (
                    <React.Fragment key={dp.id}>
                      <img src={dp.logoUrl} alt={dp.name} className="h-7 md:h-8 object-contain grayscale hover:grayscale-0 transition-all duration-500 ease-in-out" title={dp.name} />
                      {idx !== footerSettings.deliveryPartners.length - 1 && <div className="h-5 md:h-6 w-px bg-t-border transition-colors"></div>}
                    </React.Fragment>
                  ))
                ) : (
                  <>
                    <img src="https://pathao.com/wp-content/uploads/2019/03/Pathao-Logo-.png" alt="Pathao" className="h-7 md:h-8 object-contain grayscale hover:grayscale-0 transition-all duration-500 ease-in-out" />
                    <div className="h-6 md:h-7 w-px bg-t-border transition-colors"></div>
                    <img src="https://steadfast.com.bd/assets/images/logo.png" alt="Steadfast" className="h-7 md:h-8 object-contain grayscale hover:grayscale-0 transition-all duration-500 ease-in-out" />
                  </>
                )}
              </div>
            </div>

          </div>
        </div>

        <div className="border-t border-t-border pt-8 flex flex-col items-center gap-6 transition-colors">
          <div className="flex flex-col md:flex-row justify-between w-full items-center gap-5 text-[9px] md:text-[10px] font-black text-t-muted tracking-[0.2em] uppercase">
            <p className="text-center md:text-left">{footerSettings.copyright}</p>
            <div className="flex gap-6">
              <Link to="/privacy-policy" className="hover:text-t-primary cursor-pointer transition-colors">Privacy Policy</Link>
              <Link to="/terms-of-service" className="hover:text-t-primary cursor-pointer transition-colors">Terms of Service</Link>
            </div>
          </div>

          <div className="flex justify-center gap-4 w-full pt-2">
            {footerSettings.socialLinks.facebook && footerSettings.socialLinks.facebook !== '#' && (
              <a href={footerSettings.socialLinks.facebook} target="_blank" rel="noreferrer" className="w-10 h-10 rounded-full border border-t-border flex items-center justify-center hover:bg-t-primary hover:text-white hover:border-t-primary transition-all duration-300 shadow-sm group bg-t-base">
                <svg className="w-3.5 h-3.5 text-t-muted group-hover:text-white transition-colors" fill="currentColor" viewBox="0 0 24 24"><path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" /></svg>
              </a>
            )}
            {footerSettings.socialLinks.instagram && footerSettings.socialLinks.instagram !== '#' && (
              <a href={footerSettings.socialLinks.instagram} target="_blank" rel="noreferrer" className="w-10 h-10 rounded-full border border-t-border flex items-center justify-center hover:bg-t-primary hover:text-white hover:border-t-primary transition-all duration-300 shadow-sm group bg-t-base">
                <svg className="w-3.5 h-3.5 text-t-muted group-hover:text-white transition-colors" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" /></svg>
              </a>
            )}
            {footerSettings.socialLinks.tiktok && footerSettings.socialLinks.tiktok !== '#' && (
              <a href={footerSettings.socialLinks.tiktok} target="_blank" rel="noreferrer" className="w-10 h-10 rounded-full border border-t-border flex items-center justify-center hover:bg-t-primary hover:text-white hover:border-t-primary transition-all duration-300 shadow-sm group bg-t-base">
                <svg className="w-3.5 h-3.5 text-t-muted group-hover:text-white transition-colors" fill="currentColor" viewBox="0 0 24 24"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z" /></svg>
              </a>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}
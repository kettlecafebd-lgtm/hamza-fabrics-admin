import React, { useState, useEffect, useContext, useRef } from 'react';
import PropTypes from 'prop-types';
import { Search, X } from 'lucide-react';
import { CartContext } from '../context/CartContext';
import { ThemeContext } from '../context/ThemeContext'; 
import { useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import API_BASE_URL from '../config/api';
import { trackViewItemList, trackViewItem, trackSearch } from '../lib/gtm';
import { fbqEvent } from '../lib/fbq';
import ProductDetailModal from '../components/Shop/ProductDetailModal';

const ProductCard = ({ product, handleOpenQuickAdd, siteSettings }) => {
  const [currentImgIndex, setCurrentImgIndex] = useState(0);

  let images = [product.image_url];
  try {
    if (product.images) {
      images = typeof product.images === 'string' ? JSON.parse(product.images) : product.images;
    } else if (product.gallery) {
      images = typeof product.gallery === 'string' ? JSON.parse(product.gallery) : product.gallery;
    }
  } catch (e) { console.error("Image parse error"); }
  
  const validImages = images.filter(Boolean).length > 0 ? images.filter(Boolean) : [siteSettings.heroImages[0]];

  const hasVariants = product.sizes && product.sizes.trim() !== '';

  useEffect(() => {
    if (validImages.length <= 1 || !hasVariants) return;
    const timer = setInterval(() => {
      setCurrentImgIndex((prev) => (prev + 1) % validImages.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [validImages.length, hasVariants]);

  return (
    <div 
      onClick={(e) => handleOpenQuickAdd(e, product, validImages)}
      className="group flex flex-col bg-t-surface border border-t-border rounded-xl sm:rounded-2xl overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer relative"
    >
      {product.discount > 0 && (
        <div className="absolute top-2 left-2 sm:top-3 sm:left-3 z-10 bg-t-primary shadow-md text-white text-[10px] sm:text-xs font-black px-2.5 py-1 rounded-full">
          -{product.discount}%
        </div>
      )}
      
      <div className="relative aspect-[3/4] bg-t-base overflow-hidden flex items-center justify-center">
        <img 
          src={validImages[currentImgIndex]} 
          alt={product.name} 
          className="w-full h-full object-contain p-2 transition-all duration-500 ease-in-out group-hover:scale-105" 
        />
        <div className="absolute bottom-0 left-0 w-full p-2 sm:p-4 translate-y-0 sm:translate-y-full opacity-100 sm:opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
          <button 
            onClick={(e) => { e.stopPropagation(); handleOpenQuickAdd(e, product, validImages); }} 
            className="w-full bg-t-primary/95 backdrop-blur-sm text-white py-2 sm:py-3.5 text-[10px] sm:text-xs font-bold uppercase tracking-widest shadow-lg hover:bg-t-primary transition-colors rounded-lg sm:rounded-xl"
          >
            Quick View
          </button>
        </div>
      </div>
      
      <div className="text-center p-3 sm:p-4 flex flex-col flex-grow relative z-10 bg-t-surface border-t border-t-border/50">
        <span className="text-[8px] sm:text-[9px] text-t-muted uppercase tracking-[0.2em] mb-1.5 block font-bold">{product.category || 'Exclusive'}</span>
        <h3 className="text-xs sm:text-sm font-aeonik-bold text-t-main mb-1.5 leading-snug line-clamp-2">{product.name}</h3>
        <div className="mt-auto pt-1 flex items-center justify-center gap-3">
          <span className="text-xs sm:text-sm font-black text-t-primary tracking-tight">৳ {product.price}</span>
        </div>
      </div>
    </div>
  );
};

ProductCard.propTypes = {
  product: PropTypes.object.isRequired,
  handleOpenQuickAdd: PropTypes.func.isRequired,
  siteSettings: PropTypes.object.isRequired,
};

const Shop = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const categoryFromUrl = searchParams.get('category');

  const [activeCategory, setActiveCategory] = useState(categoryFromUrl || 'All');
  const [currentPage, setCurrentPage] = useState(1);

  const { shopTheme, isShopDark } = useContext(ThemeContext); 

  const [siteSettings, setSiteSettings] = useState({
    storeName: 'Hamza Fabrics',
    logoUrl: '',
    heroSubtitle: 'The Festive Edit',
    heroTitle: 'Elegance Woven Into Every Thread.',
    heroButtonText: 'Explore',
    heroImages: ["https://images.unsplash.com/photo-1583391733958-d20ed31e1141?q=80&w=2000"],
    navigationMenus: [{ id: 1, name: 'All Collections', value: 'All' }],
    gridLayout: { pcCols: 4, mobileCols: 2, itemsPerPage: 12 }
  });

  const [currentHeroImg, setCurrentHeroImg] = useState(0);
  const { addToCart, setIsCartOpen } = useContext(CartContext);

  const [quickAddProduct, setQuickAddProduct] = useState(null);
  const [quickViewImages, setQuickViewImages] = useState([]); 
  const [activeMainImg, setActiveMainImg] = useState(''); 
  const [modalSize, setModalSize] = useState('');
  const [isFullImage, setIsFullImage] = useState(false); 

  // 🔴 New States for Dynamic Variants
  const [productVariants, setProductVariants] = useState([]);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [selectedColor, setSelectedColor] = useState('');
  const [loadingVariants, setLoadingVariants] = useState(false);

  const [cartPos, setCartPos] = useState({ x: window.innerWidth - 80, y: window.innerHeight - 100 });
  const dragRef = useRef({ isDragging: false, hasMoved: false, startX: 0, startY: 0 });

  const [ratingInput, setRatingInput] = useState(5);
  const [reviewTextInput, setReviewTextInput] = useState('');
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');

  useEffect(() => {
    const fetchShopSettings = async () => {
      const savedSettings = localStorage.getItem('siteSettings');
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
          setSiteSettings(prev => ({
          ...prev,
          ...parsed,
          logoUrl: parsed.logo_url || parsed.logoUrl || prev.logoUrl,
          heroTitle: parsed.heroTitle || parsed.hero_title || prev.heroTitle,
          heroSubtitle: parsed.heroSubtitle || parsed.hero_subtitle || prev.heroSubtitle,
          heroButtonText: parsed.heroButtonText || parsed.hero_button_text || prev.heroButtonText,
          heroImages: parsed.heroImages && parsed.heroImages.length > 0 ? parsed.heroImages.filter(Boolean) : prev.heroImages,
          navigationMenus: parsed.navigationMenus?.length > 0 ? parsed.navigationMenus : prev.navigationMenus,
          gridLayout: parsed.gridLayout || parsed.grid_layout || { pcCols: 4, mobileCols: 2, itemsPerPage: 12 }
        }));
      }

      try {
        const response = await fetch(`${API_BASE_URL}/api/settings/system`);
        const data = await response.json();
        if (data.success && data.data) {
          const apiSettings = data.data;
        setSiteSettings(prev => ({
          ...prev,
          ...apiSettings,
          logoUrl: apiSettings.logo_url || apiSettings.logoUrl || prev.logoUrl,
          heroTitle: apiSettings.heroTitle || apiSettings.hero_title || prev.heroTitle,
          heroSubtitle: apiSettings.heroSubtitle || apiSettings.hero_subtitle || prev.heroSubtitle,
          heroButtonText: apiSettings.heroButtonText || apiSettings.hero_button_text || prev.heroButtonText,
          heroImages: apiSettings.heroImages || apiSettings.hero_images || prev.heroImages,
          navigationMenus: apiSettings.navigationMenus || apiSettings.navigation_menus || prev.navigationMenus,
          gridLayout: apiSettings.gridLayout || apiSettings.grid_layout || { pcCols: 4, mobileCols: 2, itemsPerPage: 12 }
        }));
          const currentLocal = JSON.parse(localStorage.getItem('siteSettings') || '{}');
          localStorage.setItem('siteSettings', JSON.stringify({...currentLocal, ...apiSettings}));
        }
      } catch (error) { console.error("Failed to fetch settings:", error); }
    };
    fetchShopSettings();
  }, []);

  useEffect(() => {
    if (categoryFromUrl) setActiveCategory(categoryFromUrl);
    else setActiveCategory(siteSettings.navigationMenus[0]?.value || 'All');
    setCurrentPage(1); 
  }, [categoryFromUrl, siteSettings.navigationMenus]);

  useEffect(() => {
    if (siteSettings.heroImages.length <= 1) return;
    const timer = setInterval(() => setCurrentHeroImg((prev) => (prev + 1) % siteSettings.heroImages.length), 3000); 
    return () => clearInterval(timer);
  }, [siteSettings.heroImages.length]);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/products`)
      .then(res => res.json())
      .then(data => { 
        if (data.success) {
          const parsedProducts = data.data.map(p => ({
            ...p,
            parsedReviews: p.reviews ? (typeof p.reviews === 'string' ? JSON.parse(p.reviews) : p.reviews) : []
          }));
          setProducts(parsedProducts); 
        }
        loading && setLoading(false); 
      })
      .catch(() => { setError('Server is offline.'); loading && setLoading(false); });
  }, [loading]);

  const filteredProducts = (() => {
    let result = activeCategory === 'All' || activeCategory === siteSettings.navigationMenus[0]?.value
      ? products : products.filter(p => p.category?.toLowerCase() === activeCategory.toLowerCase());
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p => p.name?.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q));
    }
    return result;
  })();

  const itemsPerPage = siteSettings.gridLayout?.itemsPerPage || 12;
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentProducts = filteredProducts.slice(indexOfFirstItem, indexOfLastItem);

  // Layer 1: The Senses — Fire view_item_list when products render
  useEffect(() => {
    if (currentProducts.length > 0) {
      trackViewItemList(currentProducts, activeCategory);
    }
  }, [currentProducts, activeCategory]);

  // Layer 1: The Senses — Fire search event when searchQuery changes
  useEffect(() => {
    if (searchQuery.trim().length >= 2) {
      trackSearch(searchQuery, filteredProducts.length);
    }
  }, [searchQuery]);

  // 🔴 Updated handleOpenQuickAdd to fetch real variations
  const handleOpenQuickAdd = async (e, product, imagesArray) => {
    e.stopPropagation();
    // Layer 1: The Senses — view_item
    trackViewItem(product);
    fbqEvent('ViewContent', {
      content_ids: [String(product.id || product.sku || '')],
      content_type: 'product',
      value: parseFloat(product?.price || product?.discountPrice || 0) || 0,
      currency: 'BDT'
    });
    setQuickAddProduct(product);
    setQuickViewImages(imagesArray);
    setActiveMainImg(imagesArray[0]); 
    setModalSize(null);
    setProductVariants([]);
    setSelectedVariant(null);
    
    // Fetch variants from DB
    setLoadingVariants(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/variants/${product.id}`);
      const result = await response.json();
      if (result.success && result.variants && result.variants.length > 0) {
        setProductVariants(result.variants);
        const colorGroups = {};
        result.variants.forEach(v => {
          const color = v.color || 'Default';
          if (!colorGroups[color]) colorGroups[color] = [];
          colorGroups[color].push(v);
        });
        const firstColor = Object.keys(colorGroups)[0];
        setSelectedColor(firstColor || '');
        const firstColorVariants = colorGroups[firstColor] || [];
        if (firstColorVariants.length > 0) {
          setSelectedVariant(firstColorVariants[0]);
        }
      } else {
        if (product.sizes && product.sizes.trim() !== '') {
          setModalSize(product.sizes.split(',')[0].trim());
        }
      }
    } catch (err) {
      console.error("Failed to fetch variations", err);
    } finally {
      setLoadingVariants(false);
    }
  };

  const confirmAddToCart = () => {
    const selectedSize = modalSize || null;
    const dynamicSku = selectedSize && quickAddProduct.sku_code
      ? `${quickAddProduct.sku_code}-${selectedSize.toUpperCase().replace(/\s+/g, '')}`
      : quickAddProduct.sku_code;

    const cartItem = {
      ...quickAddProduct,
      selectedSize,
      dynamicSku,
      variant: selectedVariant ? {
        id: selectedVariant.id,
        name: selectedVariant.variant_name,
        size: selectedVariant.size
      } : null,
      price: quickAddProduct.price,
      image_url: activeMainImg || quickAddProduct.image_url
    };

    addToCart(cartItem);
    toast.success('Added to Cart!');
    setQuickAddProduct(null);
    setIsCartOpen(true); 
  };

  const submitReview = (e) => {
    e.preventDefault();
    if(!reviewTextInput.trim()) return toast.error("Please write a review.");
    toast.success("Thank you! Your review has been submitted for approval.");
    setReviewTextInput('');
    setRatingInput(5);
  };

  const relatedProducts = quickAddProduct 
    ? products.filter(p => p.category === quickAddProduct.category && p.id !== quickAddProduct.id).slice(0, 4) 
    : [];

  const handlePointerDown = (e) => {
    dragRef.current.isDragging = true;
    dragRef.current.hasMoved = false; 
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    dragRef.current.startX = clientX - cartPos.x;
    dragRef.current.startY = clientY - cartPos.y;
  };
  
  useEffect(() => {
    const handlePointerMove = (e) => {
      if (!dragRef.current.isDragging) return;
      dragRef.current.hasMoved = true;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      let newX = clientX - dragRef.current.startX;
      let newY = clientY - dragRef.current.startY;
      const maxX = window.innerWidth - 64; const maxY = window.innerHeight - 64;
      if (newX < 0) newX = 0; if (newX > maxX) newX = maxX;
      if (newY < 0) newY = 0; if (newY > maxY) newY = maxY;
      setCartPos({ x: newX, y: newY });
    };
    const handlePointerUp = () => { dragRef.current.isDragging = false; };
    window.addEventListener('mousemove', handlePointerMove); 
    window.addEventListener('mouseup', handlePointerUp);
    window.addEventListener('touchmove', handlePointerMove, { passive: false }); 
    window.addEventListener('touchend', handlePointerUp);
    return () => {
      window.removeEventListener('mousemove', handlePointerMove); window.removeEventListener('mouseup', handlePointerUp);
      window.removeEventListener('touchmove', handlePointerMove); window.removeEventListener('touchend', handlePointerUp);
    };
  }, [cartPos]);

  const getGridClasses = () => {
    const { mobileCols, pcCols } = siteSettings.gridLayout || { pcCols: 4, mobileCols: 2 };
    let gridClass = "grid gap-3 sm:gap-6 ";
    gridClass += mobileCols === 1 ? "grid-cols-1 " : "grid-cols-2 ";
    gridClass += "md:grid-cols-3 ";
    if (pcCols === 3) gridClass += "lg:grid-cols-3";
    else if (pcCols === 5) gridClass += "lg:grid-cols-5";
    else gridClass += "lg:grid-cols-4";
    return gridClass;
  };

  const scrollToProducts = () => {
    const productsSection = document.getElementById('products-section');
    if (productsSection) productsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className={`bg-t-base min-h-screen font-sans text-t-main transition-colors duration-300 ${shopTheme}`}>
      
      {/* Draggable Floating Cart */}
      <div 
        onMouseDown={handlePointerDown} onTouchStart={handlePointerDown}
        onClick={() => { if(!dragRef.current.hasMoved) setIsCartOpen(true) }}
        style={{ left: `${cartPos.x}px`, top: `${cartPos.y}px`, touchAction: 'none' }}
        className="fixed z-50 w-14 h-14 sm:w-16 sm:h-16 bg-black/90 backdrop-blur-md rounded-full shadow-2xl border-2 border-t-primary/50 flex items-center justify-center cursor-grab active:cursor-grabbing hover:bg-t-primary transition-colors text-white"
      >
        <div className="relative">
          <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
          <span className="absolute -top-2 -right-3 bg-red-500 text-white text-[9px] sm:text-[10px] font-bold w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center rounded-full shadow-md">🛒</span>
        </div>
      </div>

      {/* Hero Section */}
      <section className="relative w-full h-[70vh] sm:h-[95vh] bg-black overflow-hidden">
        {siteSettings.heroImages.map((img, index) => {
          const mobileImg = siteSettings.heroMobileImages && siteSettings.heroMobileImages[index] ? siteSettings.heroMobileImages[index] : img;
          const isActive = index === currentHeroImg;
          return (
            <div key={index} className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${isActive ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}>
              <div className="absolute inset-0 bg-black/50 z-10"></div>
              {/* Desktop Image */}
              <img src={img} alt="Banner" className={`hidden lg:block absolute inset-0 w-full h-full object-cover object-top transition-transform duration-[4000ms] ease-out ${isActive ? 'scale-105' : 'scale-100'}`} />
              {/* Mobile Image */}
              <img src={mobileImg} alt="Banner" className={`block lg:hidden absolute inset-0 w-full h-full object-cover object-top transition-transform duration-[4000ms] ease-out ${isActive ? 'scale-105' : 'scale-100'}`} />
            </div>
          );
        })}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4 z-20">
          <div className="flex items-center justify-center gap-3 mb-4 sm:mb-6">
            {siteSettings.logoUrl && (
              <img src={siteSettings.logoUrl} alt={siteSettings.storeName} className="h-8 sm:h-12 w-auto object-contain drop-shadow-xl" />
            )}
            <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white drop-shadow-xl">{siteSettings.storeName}</h1>
          </div>
          <span className="text-[10px] sm:text-sm tracking-[0.4em] text-white/90 uppercase mb-4 sm:mb-5 font-semibold drop-shadow-md">{siteSettings.heroSubtitle}</span>
          <h2 className="text-3xl sm:text-5xl md:text-7xl font-serif text-white mb-8 sm:mb-10 leading-tight drop-shadow-lg max-w-4xl px-2">{siteSettings.heroTitle}</h2>
          <button onClick={scrollToProducts} className="bg-t-primary text-white px-8 py-3 sm:px-10 sm:py-4 hover:opacity-90 transition-opacity text-[10px] sm:text-xs font-bold tracking-[0.2em] uppercase shadow-xl">{siteSettings.heroButtonText}</button>
        </div>
      </section>

      {/* Products Section */}
      <section id="products-section" className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-16 sm:py-24 transition-colors duration-300">
        

        
        {loading ? ( 
          <div className="flex justify-center items-center h-64"><div className="text-sm font-bold tracking-widest uppercase text-t-primary animate-pulse">Curating collections...</div></div>
        ) : error ? ( 
          <div className="text-center text-red-500 p-4 border border-red-500/20 bg-red-500/10 rounded-lg font-bold">{error}</div>
        ) : filteredProducts.length === 0 ? ( 
          <div className="text-center text-t-muted p-12 text-sm tracking-widest uppercase font-semibold border border-dashed border-t-border rounded-xl">No products found.</div>
        ) : (
          <>
            <div className={getGridClasses()}>
              {currentProducts.map((product) => (
                <ProductCard 
                  key={product.id} 
                  product={product} 
                  handleOpenQuickAdd={handleOpenQuickAdd} 
                  siteSettings={siteSettings} 
                />
              ))}
            </div>

            {/* Pagination UI Controls */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center mt-16 gap-3 sm:gap-5 border-t border-t-border pt-8">
                <button 
                  onClick={() => { setCurrentPage(prev => Math.max(prev - 1, 1)); scrollToProducts(); }}
                  disabled={currentPage === 1}
                  className="px-5 py-2.5 rounded-xl bg-t-surface border border-t-border text-t-main disabled:opacity-40 disabled:cursor-not-allowed hover:bg-t-primary hover:text-white hover:border-t-primary transition-all font-bold text-xs uppercase tracking-widest shadow-sm"
                >
                  ← Prev
                </button>
                
                <span className="text-xs font-black text-t-muted uppercase tracking-widest bg-t-base px-4 py-2.5 rounded-xl border border-t-border">
                  Page <span className="text-t-primary">{currentPage}</span> of {totalPages}
                </span>

                <button 
                  onClick={() => { setCurrentPage(prev => Math.min(prev + 1, totalPages)); setTimeout(scrollToProducts, 100); }} 
                  disabled={currentPage === totalPages}
                  className="px-5 py-2.5 rounded-xl bg-t-surface border border-t-border text-t-main disabled:opacity-40 disabled:cursor-not-allowed hover:bg-t-primary hover:text-white hover:border-t-primary transition-all font-bold text-xs uppercase tracking-widest shadow-sm"
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {/* Premium Product Detail Modal (Module: AI-Personalized) */}
      {quickAddProduct && !isFullImage && (
        <ProductDetailModal
          product={quickAddProduct}
          images={quickViewImages}
          onClose={() => setQuickAddProduct(null)}
        />
      )}

      {/* Full Screen Image Zoom Modal */}
      {isFullImage && (
        <div className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center p-2 backdrop-blur-lg animate-fade-in" onClick={() => setIsFullImage(false)}>
          <button onClick={(e) => { e.stopPropagation(); setIsFullImage(false); }} className="absolute top-4 right-4 z-[210] bg-white/10 text-white hover:bg-red-500 w-10 h-10 rounded-full flex items-center justify-center transition-colors text-xl">✕</button>
          <img 
            src={isFullImage} 
            className="max-w-full max-h-full object-contain cursor-zoom-out scale-100 transition-all duration-300 animate-zoom-in" 
            alt="Zoomed product"
            onClick={(e) => { e.stopPropagation(); setIsFullImage(false); }}
          />
        </div>
      )}

    </div>
  );
};

export default Shop;
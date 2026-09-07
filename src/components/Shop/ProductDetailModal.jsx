import React, { useState, useEffect, useContext, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, ShoppingBag, Star, Shield, Truck, Sparkles } from 'lucide-react';
import { CartContext } from '../../context/CartContext';
import { ThemeContext } from '../../context/ThemeContext';
import { CustomerAIProfileContext } from '../../context/CustomerAIProfile';
import toast from 'react-hot-toast';
import API_BASE_URL from '../../config/api';

/**
 * ProductDetailModal — Premium Shop Product Details
 *
 * Features:
 * - Interactive image gallery with smooth framer-motion transitions
 * - AI-powered variant auto-selection based on customer affinity
 * - "Recommended for You" badge for high-match products
 * - Dynamic pill-shaped variant selector (sizes + colors)
 * - Seamless SideCart integration
 */
const ProductDetailModal = ({ product, images = [], onClose }) => {
  const { addToCart, setIsCartOpen } = useContext(CartContext);
  const { shopTheme } = useContext(ThemeContext);
  const { profile, getProductMatch, getDefaultVariant } = useContext(CustomerAIProfileContext);

  // ── Image Gallery State ──
  const [mainImageIndex, setMainImageIndex] = useState(0);
  const [direction, setDirection] = useState(0);

  // ── Variant State ──
  const [variants, setVariants] = useState([]);
  const [loadingVariants, setLoadingVariants] = useState(false);
  const [selectedColor, setSelectedColor] = useState('');
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedVariant, setSelectedVariant] = useState(null);

  // ── AI Match ──
  const [aiMatch, setAiMatch] = useState({ isRecommended: false, matchScore: 0, matchReasons: [] });

  // ── Quantity ──
  const [quantity, setQuantity] = useState(1);

  // Fetch variants on mount
  useEffect(() => {
    if (!product?.id) return;
    setLoadingVariants(true);
    fetch(`${API_BASE_URL}/api/variants/${product.id}`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.variants?.length > 0) {
          setVariants(data.variants);

          // Group by color
          const colorGroups = {};
          data.variants.forEach(v => {
            const color = v.color || 'Default';
            if (!colorGroups[color]) colorGroups[color] = [];
            colorGroups[color].push(v);
          });

          // AI: Auto-select preferred color
          const defaultVariant = getDefaultVariant(data.variants);
          if (defaultVariant) {
            setSelectedColor(defaultVariant.color || 'Default');
            setSelectedVariant(defaultVariant);
            setSelectedSize(defaultVariant.size || '');
          } else {
            const firstColor = Object.keys(colorGroups)[0];
            setSelectedColor(firstColor || '');
          }
        } else if (product.sizes) {
          // Simple size-based product
          const sizes = product.sizes.split(',').map(s => s.trim()).filter(Boolean);
          setSelectedSize(sizes[0] || '');
        }
      })
      .catch(() => {})
      .finally(() => setLoadingVariants(false));

    // AI match check
    setAiMatch(getProductMatch(product));
  }, [product?.id]);

  // Get available sizes for selected color
  const getSizesForColor = useCallback(() => {
    if (variants.length === 0) {
      return product?.sizes ? product.sizes.split(',').map(s => s.trim()).filter(Boolean) : [];
    }
    return variants
      .filter(v => (v.color || 'Default') === selectedColor)
      .map(v => v.size)
      .filter(Boolean);
  }, [variants, selectedColor, product?.sizes]);

  // Get color groups
  const getColorGroups = useCallback(() => {
    const groups = {};
    variants.forEach(v => {
      const color = v.color || 'Default';
      if (!groups[color]) groups[color] = [];
      groups[color].push(v);
    });
    return groups;
  }, [variants]);

  // Update selected variant when color/size changes
  useEffect(() => {
    if (variants.length === 0) return;
    const match = variants.find(v =>
      (v.color || 'Default') === selectedColor && v.size === selectedSize
    );
    if (match) setSelectedVariant(match);
  }, [selectedColor, selectedSize, variants]);

  // ── Image Gallery Navigation ──
  const validImages = images.filter(Boolean).length > 0 ? images.filter(Boolean) : [product?.image_url];
  const goToImage = (newIndex) => {
    setDirection(newIndex > mainImageIndex ? 1 : -1);
    setMainImageIndex(newIndex);
  };
  const nextImage = () => goToImage((mainImageIndex + 1) % validImages.length);
  const prevImage = () => goToImage((mainImageIndex - 1 + validImages.length) % validImages.length);

  // ── Add to Cart ──
  const handleAddToCart = () => {
    const cartItem = {
      ...product,
      selectedSize: selectedSize || selectedVariant?.size || null,
      dynamicSku: selectedVariant?.sku || product.sku_code,
      variant: selectedVariant ? {
        id: selectedVariant.id,
        name: selectedVariant.variant_name || `${selectedColor} ${selectedSize}`,
        size: selectedSize || selectedVariant.size,
        color: selectedColor,
      } : null,
      price: product.price,
      image_url: validImages[mainImageIndex] || product.image_url,
      quantity,
    };

    for (let i = 0; i < quantity; i++) {
      addToCart(cartItem);
    }
    toast.success(`${product.name} added to cart!`);
    onClose();
  };

  // ── Keyboard Navigation ──
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') prevImage();
      if (e.key === 'ArrowRight') nextImage();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [mainImageIndex]);

  if (!product) return null;

  const availableSizes = getSizesForColor();
  const colorGroups = getColorGroups();
  const colors = Object.keys(colorGroups);
  const currentPrice = selectedVariant?.price || product.price;
  const originalPrice = product.discount > 0
    ? (currentPrice / (1 - product.discount / 100)).toFixed(0)
    : null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-md p-2 sm:p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className={`relative w-full max-w-5xl max-h-[95vh] bg-t-surface rounded-2xl sm:rounded-3xl border border-t-border shadow-2xl overflow-hidden flex flex-col lg:flex-row ${shopTheme}`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-30 w-10 h-10 bg-t-base/80 backdrop-blur-md rounded-full border border-t-border flex items-center justify-center text-t-muted hover:text-red-500 hover:border-red-500 transition-all"
          >
            <X size={20} />
          </button>

          {/* ═══ LEFT: Image Gallery ═══ */}
          <div className="lg:w-1/2 h-[45vh] lg:h-auto relative bg-t-base flex flex-col">
            {/* Main Image */}
            <div className="flex-1 relative overflow-hidden flex items-center justify-center">
              <AnimatePresence mode="wait" custom={direction}>
                <motion.img
                  key={mainImageIndex}
                  src={validImages[mainImageIndex]}
                  alt={product.name}
                  custom={direction}
                  initial={{ opacity: 0, x: direction * 100 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: direction * -100 }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                  className="w-full h-full object-contain p-4"
                />
              </AnimatePresence>

              {/* Navigation Arrows */}
              {validImages.length > 1 && (
                <>
                  <button
                    onClick={prevImage}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-t-base/80 backdrop-blur-md rounded-full border border-t-border flex items-center justify-center text-t-muted hover:text-t-main hover:bg-t-surface transition-all"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <button
                    onClick={nextImage}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-t-base/80 backdrop-blur-md rounded-full border border-t-border flex items-center justify-center text-t-muted hover:text-t-main hover:bg-t-surface transition-all"
                  >
                    <ChevronRight size={20} />
                  </button>
                </>
              )}

              {/* AI Recommended Badge */}
              {aiMatch.isRecommended && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="absolute top-4 left-4 z-20 flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-black px-3 py-1.5 rounded-full shadow-lg uppercase tracking-wider"
                >
                  <Sparkles size={12} />
                  Recommended for You
                </motion.div>
              )}

              {/* Discount Badge */}
              {product.discount > 0 && (
                <div className="absolute top-4 right-16 z-20 bg-t-primary text-white text-[10px] font-black px-3 py-1.5 rounded-full shadow-lg">
                  -{product.discount}%
                </div>
              )}

              {/* Image Counter */}
              {validImages.length > 1 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 bg-t-base/80 backdrop-blur-md text-t-muted text-[10px] font-bold px-3 py-1 rounded-full border border-t-border">
                  {mainImageIndex + 1} / {validImages.length}
                </div>
              )}
            </div>

            {/* Thumbnail Strip */}
            {validImages.length > 1 && (
              <div className="flex gap-2 p-3 overflow-x-auto custom-scrollbar bg-t-base border-t border-t-border">
                {validImages.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => goToImage(idx)}
                    className={`flex-shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-lg border-2 overflow-hidden transition-all ${
                      idx === mainImageIndex
                        ? 'border-t-primary shadow-md scale-105'
                        : 'border-t-border opacity-60 hover:opacity-100 hover:border-t-primary/50'
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ═══ RIGHT: Product Info ═══ */}
          <div className="lg:w-1/2 flex flex-col overflow-y-auto p-5 sm:p-6 lg:p-8 space-y-5">
            {/* Category + Name */}
            <div>
              <span className="text-[10px] text-t-muted uppercase tracking-[0.2em] font-bold">
                {product.category || 'Exclusive Collection'}
              </span>
              <h2 className="text-xl sm:text-2xl font-aeonik-bold text-t-main mt-1 leading-tight">
                {product.name}
              </h2>
            </div>

            {/* Price */}
            <div className="flex items-baseline gap-3">
              <span className="text-2xl sm:text-3xl font-black text-t-primary tracking-tight">
                ৳ {currentPrice}
              </span>
              {originalPrice && (
                <span className="text-sm text-t-muted line-through">৳ {originalPrice}</span>
              )}
            </div>

            {/* AI Match Reasons */}
            {aiMatch.matchReasons.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {aiMatch.matchReasons.map((reason, i) => (
                  <span
                    key={i}
                    className="text-[9px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20 px-2.5 py-1 rounded-full uppercase tracking-wider"
                  >
                    {reason}
                  </span>
                ))}
              </div>
            )}

            {/* Color Selector (Pill-shaped) */}
            {colors.length > 0 && !(colors.length === 1 && colors[0] === 'Default') && (
              <div>
                <label className="text-[10px] text-t-muted font-bold uppercase tracking-widest mb-2 block">
                  Color — <span className="text-t-main">{selectedColor}</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {colors.map(color => (
                    <button
                      key={color}
                      onClick={() => {
                        setSelectedColor(color);
                        // Auto-select first size for new color
                        const sizesForColor = variants
                          .filter(v => (v.color || 'Default') === color)
                          .map(v => v.size)
                          .filter(Boolean);
                        if (sizesForColor.length > 0) setSelectedSize(sizesForColor[0]);
                      }}
                      className={`px-4 py-2 rounded-full text-xs font-bold border-2 transition-all duration-200 ${
                        selectedColor === color
                          ? 'bg-t-main text-t-base border-t-main shadow-md'
                          : 'bg-t-base text-t-main border-t-border hover:border-t-primary/50'
                      }`}
                    >
                      {color}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Size Selector (Pill-shaped) */}
            {availableSizes.length > 0 && (
              <div>
                <label className="text-[10px] text-t-muted font-bold uppercase tracking-widest mb-2 block">
                  Size — <span className="text-t-main">{selectedSize || 'Select'}</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {availableSizes.map(size => {
                    const variant = variants.find(v =>
                      (v.color || 'Default') === selectedColor && v.size === size
                    );
                    const inStock = variant ? (variant.stock_quantity || 0) > 0 : true;
                    return (
                      <button
                        key={size}
                        onClick={() => inStock && setSelectedSize(size)}
                        disabled={!inStock}
                        className={`px-4 py-2 rounded-full text-xs font-bold border-2 transition-all duration-200 min-w-[44px] ${
                          selectedSize === size
                            ? 'bg-t-main text-t-base border-t-main shadow-md'
                            : inStock
                              ? 'bg-t-base text-t-main border-t-border hover:border-t-primary/50'
                              : 'bg-t-base text-t-muted border-t-border/50 opacity-40 cursor-not-allowed line-through'
                        }`}
                      >
                        {size}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quantity + Add to Cart */}
            <div className="flex items-center gap-4 pt-2">
              {/* Quantity Stepper */}
              <div className="flex items-center border-2 border-t-border rounded-full">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-10 h-10 flex items-center justify-center text-t-muted hover:text-t-main transition-colors font-bold"
                >
                  −
                </button>
                <span className="w-10 text-center text-sm font-black text-t-main">{quantity}</span>
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="w-10 h-10 flex items-center justify-center text-t-muted hover:text-t-main transition-colors font-bold"
                >
                  +
                </button>
              </div>

              {/* Add to Cart Button */}
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleAddToCart}
                className="flex-1 bg-t-primary hover:bg-t-primary/90 text-white py-3.5 rounded-xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 shadow-lg shadow-t-primary/20 transition-all"
              >
                <ShoppingBag size={16} />
                Add to Cart
              </motion.button>
            </div>

            {/* Trust Badges */}
            <div className="grid grid-cols-3 gap-3 pt-2 border-t border-t-border">
              <div className="flex flex-col items-center gap-1 text-center">
                <Truck size={16} className="text-t-primary" />
                <span className="text-[9px] text-t-muted font-bold uppercase">Free Delivery</span>
              </div>
              <div className="flex flex-col items-center gap-1 text-center">
                <Shield size={16} className="text-t-primary" />
                <span className="text-[9px] text-t-muted font-bold uppercase">Quality Assured</span>
              </div>
              <div className="flex flex-col items-center gap-1 text-center">
                <Star size={16} className="text-t-primary" />
                <span className="text-[9px] text-t-muted font-bold uppercase">Easy Returns</span>
              </div>
            </div>

            {/* Product Description */}
            {product.description && (
              <div className="pt-2 border-t border-t-border">
                <h4 className="text-[10px] text-t-muted font-bold uppercase tracking-widest mb-2">Description</h4>
                <p className="text-xs text-t-main/80 leading-relaxed line-clamp-4">
                  {product.description}
                </p>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ProductDetailModal;

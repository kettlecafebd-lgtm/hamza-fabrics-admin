import React, { useState, useEffect, useContext, useCallback, useRef } from 'react';
import API_BASE_URL from '../config/api';
import { ThemeContext } from '../context/ThemeContext';
import VariantMatrix from '../components/ui/VariantMatrix';
import { GlassModal } from '../components/ui/GlassCard';
import { getToken } from '../utils/auth';
import { prepareImageForUpload, describeSaving } from '../lib/imageOptimize';
import { appendStorageFields, deleteMedia, isUrlStillReferenced } from '../lib/mediaClient';
import { cachedFetch, invalidateCache, CACHE_TTLS } from '../lib/dataCache';

/** Rows per page. A paging-aware backend honours this; a legacy one returns all. */
const PAGE_SIZE = 100;

export default function Products() {
  const { adminTheme, isAdminDark } = useContext(ThemeContext);
  const isDark = isAdminDark;
  const bgCard = isDark ? 'bg-gray-800' : 'bg-white';
  const textColor = isDark ? 'text-gray-100' : 'text-gray-800';
  const mutedText = isDark ? 'text-gray-400' : 'text-gray-500';
  const borderColor = isDark ? 'border-gray-700' : 'border-gray-200';
  const inputBg = isDark ? 'bg-gray-700' : 'bg-gray-50';
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [searchQuery, setSearchQuery] = useState('');
  // Debounced copy of `searchQuery`: typing must not fire a request per keystroke.
  const [serverSearch, setServerSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [serverPaginated, setServerPaginated] = useState(false);
  const [expandedRows, setExpandedRows] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [imageViewer, setImageViewer] = useState({ open: false, url: '' });
  const [editingId, setEditingId] = useState(null);
  const [openActionId, setOpenActionId] = useState(null);
  const [historyModal, setHistoryModal] = useState({ open: false, product: null, type: 'edit' });
  const [historyData, setHistoryData] = useState([]);

  const [baseProd, setBaseProd] = useState({
    name: '', sku: '', category: '', brand: '', color: '', details: '', cost_price: '', price: '', discount: '0', stock: '0', hasSizes: false, sizes: [{ id: Date.now(), size: '', stock: '', price: '' }]
  });

  const [baseImage, setBaseImage] = useState(null);
  const [extraVariants, setExtraVariants] = useState([]);
  const [reviews, setReviews] = useState([]);



  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  };

  const fetchData = useCallback(async () => {
    const token = getToken();
    const headers = { 'Authorization': `Bearer ${token}` };

    // Only ask for the page we render. `search` is sent to the server while
    // paging; a backend that ignores these params returns everything, and the
    // `total` check below drops us back to client-side filtering.
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    if (serverSearch) params.set('search', serverSearch);

    try {
      const [prodRes, taxonomyRes] = await Promise.all([
        cachedFetch(`${API_BASE_URL}/api/products?${params}`, {
          headers, token, ttl: CACHE_TTLS.list,
        }),
        // Taxonomy changes a few times a year; a 10-minute TTL is generous.
        cachedFetch(`${API_BASE_URL}/api/taxonomy`, { headers, token, ttl: CACHE_TTLS.reference }),
      ]);

      const prodResult = await prodRes.json();
      if (prodResult.success) {
        const rows = prodResult.data || [];
        setProducts(rows);
        if (typeof prodResult.total === 'number') {
          setTotal(prodResult.total);
          setServerPaginated(true);
        } else {
          // Legacy backend: no paging. Keep every row and filter in the browser.
          setTotal(rows.length);
          setServerPaginated(false);
        }
      }

      const taxonomyResult = await taxonomyRes.json();
      if (taxonomyResult.success) {
        setCategories(taxonomyResult.data.Categories || []);
        setBrands(taxonomyResult.data.Brands || []);
      }
    } catch (err) { console.error("Fetch Error:", err); }
    setLoading(false);
  }, [page, serverSearch]);

  // Mutations must never be answered from the cache: clear the affected URLs,
  // then refetch. `fetchDataRef` lets the debounced refresher call the latest one.
  const fetchDataRef = useRef(fetchData);
  useEffect(() => { fetchDataRef.current = fetchData; }, [fetchData]);

  const refreshProducts = useCallback(async () => {
    invalidateCache('/api/products');
    invalidateCache('/api/variants');
    await fetchDataRef.current();
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // 300 ms after typing stops, run the search. Page resets in the input handler.
  useEffect(() => {
    const timer = setTimeout(() => setServerSearch(searchQuery.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Close image viewer on Escape
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && imageViewer.open) setImageViewer({ open: false, url: '' }); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [imageViewer.open]);

  const toggleRowExpand = async (id) => {
    if (expandedRows.includes(id)) {
      setExpandedRows(prev => prev.filter(rowId => rowId !== id));
      return;
    }

    const prod = products.find(p => p.id === id);
    if (prod && (!prod.variants || prod.variants.length === 0)) {
      try {
        const res = await cachedFetch(`${API_BASE_URL}/api/variants/${id}`, {
          headers: { 'Authorization': `Bearer ${getToken()}` },
          token: getToken(),
          ttl: CACHE_TTLS.list,
        });
        const json = await res.json();
        if (json.success && Array.isArray(json.variants)) {
          setProducts(prev => prev.map(p => p.id === id ? { ...p, variants: json.variants } : p));
        }
      } catch (err) {
        console.error('Fetch variants error:', err);
      }
    }

    setExpandedRows(prev => [...prev, id]);
  };

  const handleEdit = (product) => {
    let loadedBaseSizes = [];
    let loadedExtraVariantsMap = {};

    if (product.variants && product.variants.length > 0) {
        // Group all variants by color first
        const colorGroups = {};
        product.variants.forEach(v => {
            const color = v.color || 'Base';
            if (!colorGroups[color]) colorGroups[color] = [];
            colorGroups[color].push(v);
        });

        const colors = Object.keys(colorGroups);
        const hasNoBaseColor = !product.color || product.color === '';

        // Determine which color is "base": match product.color, or first color if product has no color set
        let baseColor = null;
        if (product.color && colorGroups[product.color]) {
            baseColor = product.color;
        } else if (colors.length === 1) {
            baseColor = colors[0]; // Only one color — it's the base
        } else if (hasNoBaseColor && colors.length > 1) {
            // Multiple colors, no product-level color — treat all as extra variants
            baseColor = null;
        } else {
            baseColor = colors[0]; // Fallback: first color is base
        }

        product.variants.forEach(v => {
            const vCost = v.cost_price || '';
            const isBase = baseColor && v.color === baseColor;

            if (isBase) {
                loadedBaseSizes.push({
                    id: v.id || Date.now() + Math.random(), size: v.size || '', stock: v.stock || '0', price: product.price, cost_price: vCost
                });
            } else {
                const groupKey = `${product.sku_code || product.sku}_${v.color}`;
                if (!loadedExtraVariantsMap[groupKey]) {
                    loadedExtraVariantsMap[groupKey] = {
                        id: Date.now() + Math.random(), name: product.name, sku: product.sku_code || product.sku, color: v.color, price: product.price,
                        stock: 0, hasSizes: true, sizes: [], imageFile: null, existing_image_url: ''
                    };
                }
                loadedExtraVariantsMap[groupKey].sizes.push({
                    id: v.id || Date.now() + Math.random(), size: v.size || '', stock: v.stock || '0', price: product.price, cost_price: vCost
                });
            }
        });
    }

    const extraVarsArray = Object.values(loadedExtraVariantsMap).map(ev => ({
        ...ev, stock: ev.sizes.reduce((sum, sz) => sum + parseInt(sz.stock || 0), 0).toString()
    }));

    let loadedReviews = [];
    if (product.reviews) {
        try {
            loadedReviews = JSON.parse(product.reviews).map(r => ({
                id: Date.now() + Math.random(), name: r.name || '', comment: r.comment || '',
                imageFile: null, existing_image: r.image || null
            }));
        } catch(e) {}
    }

    setBaseProd({
      name: product.name || '', sku: product.sku || product.sku_code || '', category: product.category || '', brand: product.brand || '',
      color: product.color || '', details: product.details || '', cost_price: product.cost_price || '', price: product.price || '',
      discount: product.discount || '0', stock: product.stock_quantity || '0',
      hasSizes: loadedBaseSizes.length > 0,
      sizes: loadedBaseSizes.length > 0 ? loadedBaseSizes : [{ id: Date.now(), size: '', stock: '', price: product.price || '' }]
    });

    setExtraVariants(extraVarsArray);
    setReviews(loadedReviews);
    setBaseImage(null);
    setEditingId(product.id);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if(!window.confirm("Are you sure you want to delete this product?")) return;
    const target = products.find(p => p.id === id);
    try {
      const response = await fetch(`${API_BASE_URL}/api/products/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${getToken()}` } });
      if(response.ok) {
        // The DB row is gone; now release the objects it was pointing at.
        // Anything another product still references is left alone.
        const candidates = [
          target?.image_url,
          ...(target?.variants || []).map(v => v.image_url || v.image),
        ].filter(Boolean);

        const orphans = candidates.filter(url =>
          !isUrlStillReferenced(url, products, ['image_url', 'image'], [id])
        );

        // With server paging we only hold one page, so a client-side sweep
        // cannot prove an object is unreferenced. Leave it to the server-side GC.
        if (!serverPaginated && orphans.length) {
          deleteMedia(orphans, { apiBase: API_BASE_URL, token: getToken() });
        }

        refreshProducts();
        showToast('Product Deleted!', 'success');
      }
    } catch(err) { showToast('Delete failed!', 'error'); }
  };

  const updateBaseSize = (id, field, value) => setBaseProd(prev => {
      const newSizes = prev.sizes.map(s => s.id === id ? { ...s, [field]: value } : s);
      const newTotalStock = field === 'stock' && prev.hasSizes ? newSizes.reduce((sum, sz) => sum + (parseInt(sz.stock) || 0), 0).toString() : prev.stock;
      return { ...prev, sizes: newSizes, stock: newTotalStock };
  });
  const addBaseSize = () => setBaseProd(prev => ({ ...prev, sizes: [...prev.sizes, { id: Date.now(), size: '', stock: '', price: prev.price, cost_price: prev.cost_price }] }));
  const removeBaseSize = (id) => setBaseProd(prev => {
      const newSizes = prev.sizes.filter(s => s.id !== id);
      return { ...prev, sizes: newSizes, stock: prev.hasSizes ? newSizes.reduce((sum, sz) => sum + (parseInt(sz.stock) || 0), 0).toString() : prev.stock };
  });
  const toggleBaseHasSizes = (checked) => setBaseProd(prev => ({ ...prev, hasSizes: checked, stock: checked ? prev.sizes.reduce((sum, sz) => sum + (parseInt(sz.stock) || 0), 0).toString() : '0' }));

  const addExtraVariant = () => setExtraVariants([...extraVariants, { id: Date.now(), name: '', sku: '', color: '', cost_price: '', price: '', stock: '0', hasSizes: false, sizes: [{ id: Date.now(), size: '', stock: '', price: '', cost_price: '' }], imageFile: null }]);
  const removeExtraVariant = (id) => setExtraVariants(extraVariants.filter(v => v.id !== id));
  const updateExtraVariant = (varId, field, value) => setExtraVariants(prev => prev.map(v => v.id === varId ? { ...v, [field]: value } : v));
  const toggleExtraVariantSizes = (varId, checked) => setExtraVariants(prev => prev.map(v => v.id === varId ? { ...v, hasSizes: checked, stock: checked ? v.sizes.reduce((sum, sz) => sum + (parseInt(sz.stock) || 0), 0).toString() : '0' } : v));
  const updateExtraVariantSize = (varId, sizeId, field, value) => setExtraVariants(prev => prev.map(v => {
      if (v.id === varId) {
        const newSizes = v.sizes.map(s => s.id === sizeId ? { ...s, [field]: value } : s);
        return { ...v, sizes: newSizes, stock: v.hasSizes && field === 'stock' ? newSizes.reduce((sum, sz) => sum + (parseInt(sz.stock) || 0), 0).toString() : v.stock };
      }
      return v;
  }));
  const addExtraVariantSize = (varId) => setExtraVariants(prev => prev.map(v => v.id === varId ? { ...v, sizes: [...v.sizes, { id: Date.now(), size: '', stock: '', price: v.price, cost_price: v.cost_price }] } : v));
  const removeExtraVariantSize = (varId, sizeId) => setExtraVariants(prev => prev.map(v => {
      if(v.id === varId) {
          const newSizes = v.sizes.filter(s => s.id !== sizeId);
          return { ...v, sizes: newSizes, stock: v.hasSizes ? newSizes.reduce((sum, sz) => sum + (parseInt(sz.stock) || 0), 0).toString() : v.stock };
      }
      return v;
  }));

  const addReview = () => setReviews([...reviews, { id: Date.now(), name: '', comment: '', imageFile: null, existing_image: null }]);
  const updateReview = (id, field, value) => setReviews(reviews.map(r => r.id === id ? { ...r, [field]: value } : r));
  const removeReview = (id) => setReviews(reviews.filter(r => r.id !== id));

  // Shared picker: `accept` is advisory only, so validate before we hold the
  // file. Oversized files are still caught at submit time by the optimiser.
  const handlePickImage = (e, onPick) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type?.startsWith('image/')) {
      showToast('That is not an image — please choose a JPG, PNG or WebP.', 'error');
      e.target.value = '';
      return;
    }
    onPick(file);
  };

  // 🟢 [FIXED]: FormData Submit Logic
  const handleAddProduct = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    const submissionData = new FormData();

    // 1. Append Text Data
    submissionData.append('name', baseProd.name);
    submissionData.append('sku', baseProd.sku);
    submissionData.append('category', baseProd.category);
    submissionData.append('brand', baseProd.brand);
    submissionData.append('color', baseProd.color);
    submissionData.append('details', baseProd.details);
    submissionData.append('cost_price', baseProd.cost_price || 0);
    submissionData.append('price', baseProd.price || 0);
    submissionData.append('discount', baseProd.discount || 0);
    submissionData.append('stock_quantity', baseProd.stock || 0);

    // 2. Main Image — capped at 1200 px / WebP q0.80 before it leaves the browser.
    const existingProduct = editingId ? products.find(p => p.id === editingId) : null;
    const previousMainImage = existingProduct?.image_url || null;
    let newMainImageUrl;
    const replacedSideImages = [];
    // Images this same product keeps. Two variants (or a variant and a review)
    // can legitimately share one file; replacing one must not delete the other.
    const keptSideImages = [];

    if (baseImage) {
        try {
            const { file: prepared, originalBytes, bytes, changed } = await prepareImageForUpload(baseImage, 'product');
            submissionData.append('image', prepared);
            appendStorageFields(submissionData, prepared);
            if (changed) console.info('[products] main image', describeSaving(originalBytes, bytes));
        } catch (err) {
            showToast(err.message || 'Main image is too large.', 'error');
            setIsSubmitting(false);
            return;
        }
        if (previousMainImage) submissionData.append('previous_image_url', previousMainImage);
    } else if (editingId) {
        submissionData.append('image_url', previousMainImage || '');
    }

    // 3. Variant JSON Array Processing
    let allVariantsToSubmit = [];

    // Base Sizes
    if (baseProd.hasSizes && baseProd.sizes.length > 0) {
        allVariantsToSubmit.push({
            color: baseProd.color || 'Base',
            sku: baseProd.sku,
            sizes: baseProd.sizes.map(s => ({
                size: s.size,
                stock: s.stock,
                price: s.price || baseProd.price,
                cost_price: s.cost_price || 0,
                child_sku: `${baseProd.sku}_${s.size}`
            }))
        });
    }

    // Extra Variants
    extraVariants.forEach((v) => {
        let variantSizes = v.hasSizes && v.sizes.length > 0
            ? v.sizes.map(s => ({
                size: s.size,
                stock: s.stock,
                price: s.price || v.price,
                cost_price: s.cost_price || 0,
                child_sku: `${v.sku}_${s.size}`
            }))
            : [{
                size: 'Free Size',
                stock: v.stock,
                price: v.price,
                cost_price: v.cost_price || 0,
                child_sku: `${v.sku}_FS`
            }];

        allVariantsToSubmit.push({
            color: v.color || '',
            sku: v.sku,
            sizes: variantSizes,
            image_url: v.existing_image_url || ''
        });
    });

    // 4. Submit Variants JSON & Match Image Indexes Properly
    if (allVariantsToSubmit.length > 0) {
        submissionData.append('hasVariants', 'true');
        submissionData.append('variantsData', JSON.stringify(allVariantsToSubmit));

        // 🟢 FIX: Calculate exactly where extra variants start in the JSON array
        const extraVariantOffset = (baseProd.hasSizes && baseProd.sizes.length > 0) ? 1 : 0;

        for (const [index, v] of extraVariants.entries()) {
            if (!v.imageFile) {
                if (v.existing_image_url) keptSideImages.push(v.existing_image_url);
                continue;
            }
            const correctIndex = extraVariantOffset + index;
            try {
                const { file: prepared } = await prepareImageForUpload(v.imageFile, 'variant');
                // এখন variantImage_1, variantImage_2 ব্যাকএন্ডের লুপের সাথে ঠিক মিলবে
                submissionData.append(`variantImage_${correctIndex}`, prepared);
                submissionData.append(`variantImageContentType_${correctIndex}`, prepared.type || 'image/webp');
                if (v.existing_image_url) {
                    submissionData.append(`variantImagePrevious_${correctIndex}`, v.existing_image_url);
                    replacedSideImages.push(v.existing_image_url);
                }
            } catch (err) {
                showToast(err.message || `Variant image for ${v.color || 'variant'} is too large.`, 'error');
                setIsSubmitting(false);
                return;
            }
        }
    } else {
        submissionData.append('hasVariants', 'false');
    }

    // 5. Reviews Array & Images
    const reviewsToSubmit = reviews.map(r => ({ name: r.name, comment: r.comment, existing_image: r.existing_image || null }));
    if(reviewsToSubmit.length > 0) {
        submissionData.append('reviewsData', JSON.stringify(reviewsToSubmit));
        for (const [index, r] of reviews.entries()) {
            if (!r.imageFile) {
                if (r.existing_image) keptSideImages.push(r.existing_image);
                continue;
            }
            try {
                const { file: prepared } = await prepareImageForUpload(r.imageFile, 'review');
                submissionData.append(`reviewImage_${index}`, prepared);
                submissionData.append(`reviewImageContentType_${index}`, prepared.type || 'image/webp');
                if (r.existing_image) {
                    submissionData.append(`reviewImagePrevious_${index}`, r.existing_image);
                    replacedSideImages.push(r.existing_image);
                }
            } catch (err) {
                showToast(err.message || 'A review image is too large.', 'error');
                setIsSubmitting(false);
                return;
            }
        }
    }

    const url = editingId ? `${API_BASE_URL}/api/products/${editingId}` : `${API_BASE_URL}/api/products`;
    try {
      // 🟢 Note: Do NOT manually set 'Content-Type': 'multipart/form-data'. Fetch handles boundaries automatically when passing FormData object.
      const response = await fetch(url, {
          method: editingId ? 'PUT' : 'POST',
          headers: { 'Authorization': `Bearer ${getToken()}` },
          body: submissionData
      });
      const result = await response.json();
      if (result.success) {
          newMainImageUrl = result.image_url || result.data?.image_url || null;

          // Only after the DB committed, only when the server confirmed a new URL,
          // and only if nothing else still uses the old one.
          const stillEditing = editingId ? [editingId] : [];
          const oldUrls = [
              ...(newMainImageUrl && previousMainImage !== newMainImageUrl ? [previousMainImage] : []),
              ...replacedSideImages,
          ].filter(Boolean);

          const orphans = oldUrls.filter(url =>
              !keptSideImages.includes(url) &&
              !isUrlStillReferenced(url, products, ['image_url', 'image', 'existing_image'], stillEditing)
          );
          if (!serverPaginated && orphans.length) {
            // (see handleDelete: a single page cannot prove non-reference)
            deleteMedia(orphans, { apiBase: API_BASE_URL, token: getToken() });
          }

          closeAndResetModal();
          refreshProducts();
          showToast(editingId ? 'Product Updated!' : 'Product Saved!', 'success');
      } else {
          showToast(result.message || 'Action failed!', 'error');
      }
    } catch (error) {
        showToast('Server connection failed.', 'error');
    } finally {
        setIsSubmitting(false);
    }
  };

  const closeAndResetModal = () => {
    setShowModal(false); setEditingId(null); setBaseImage(null); setExtraVariants([]); setReviews([]);
    setBaseProd({ name: '', sku: '', category: '', brand: '', color: '', details: '', cost_price: '', price: '', discount: '0', stock: '0', hasSizes: false, sizes: [{ id: Date.now(), size: '', stock: '', price: '', cost_price: '' }] });
  };

  const handleToggleActive = async (id, current) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/products/${id}/toggle`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !current })
      });
      const json = await res.json();
      if (json.success) { refreshProducts(); showToast(json.message, 'success'); }
      else showToast(json.message || 'Toggle failed', 'error');
    } catch (err) { showToast('Toggle failed', 'error'); }
  };

  const handleDuplicate = async (id) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/products/${id}/duplicate`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      const json = await res.json();
      if (json.success) { refreshProducts(); showToast('Product duplicated', 'success'); }
      else showToast(json.message || 'Duplicate failed', 'error');
    } catch (err) { showToast('Duplicate failed', 'error'); }
  };

  const openHistoryModal = async (product, type) => {
    const endpoint = type === 'edit' ? 'edit-history' : 'stock-history';
    try {
      const res = await fetch(`${API_BASE_URL}/api/products/${product.id}/${endpoint}`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      const json = await res.json();
      if (json.success) { setHistoryData(json.data || []); setHistoryModal({ open: true, product, type }); }
      else showToast('Failed to load history', 'error');
    } catch (err) { showToast('Failed to load history', 'error'); }
  };

  const getProductReportUrl = (product) => {
    const params = new URLSearchParams({ name: product.name, sku: product.sku_code || product.sku, price: product.price, stock: product.stock_quantity });
    return `/admin/report?product_id=${product.id}&${params.toString()}`;
  };

  const handleTag = async (product) => {
    const tag = window.prompt('Enter tag for ' + product.name + ':', product.tags || '');
    if (tag === null) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/products/${product.id}/tag`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: tag })
      });
      const json = await res.json();
      if (json.success) { refreshProducts(); showToast('Tag updated', 'success'); }
      else showToast(json.message || 'Tag failed', 'error');
    } catch (err) { showToast('Tag failed', 'error'); }
  };

  useEffect(() => {
    const handleClickOutside = () => setOpenActionId(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  // When the backend paged *and* searched, the rows we hold are already the
  // answer. Otherwise fall back to filtering the full list in the browser.
  const filteredProducts = serverPaginated
    ? products
    : products.filter(p => p.name?.toLowerCase().includes(searchQuery.toLowerCase()) || (p.sku_code || p.sku || '')?.toLowerCase().includes(searchQuery.toLowerCase()));

  // ── Inline edit plumbing ────────────────────────────────────────────────────
  // Inline stock/price edits used to call fetchData() each time, re-downloading
  // the entire catalogue + taxonomy for a single cell change. Now the row is
  // patched optimistically and one coalesced refresh reconciles with the server.
  const refreshTimer = useRef(null);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => { refreshProducts(); }, 1500);
  }, [refreshProducts]);

  useEffect(() => () => { if (refreshTimer.current) clearTimeout(refreshTimer.current); }, []);

  const patchVariantLocally = useCallback((productId, variantId, patch) => {
    setProducts(prev => prev.map(p => {
      if (p.id !== productId) return p;
      const variants = (p.variants || []).map(v =>
        String(v.id) === String(variantId) ? { ...v, ...patch } : v
      );
      const next = { ...p, variants };
      // Keep the product-level roll-up honest while we wait for the refresh.
      if (variants.length > 0 && patch.stock != null) {
        next.stock_quantity = variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
      }
      return next;
    }));
  }, []);

  // Inline stock/price update handlers for VariantMatrix
  const handleInlineStockUpdate = useCallback(async (productId, variantId, newStock) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/variants/${variantId}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ stock: newStock })
      });
      const json = await res.json();
      if (json.success) {
        patchVariantLocally(productId, variantId, { stock: newStock });
        scheduleRefresh();
        showToast('Stock updated', 'success');
      } else {
        showToast(json.message || 'Stock update failed', 'error');
      }
    } catch { showToast('Stock update failed', 'error'); }
  }, [patchVariantLocally, scheduleRefresh]);

  const handleInlinePriceUpdate = useCallback(async (productId, variantId, newPrice) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/variants/${variantId}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ price: newPrice })
      });
      const json = await res.json();
      if (json.success) {
        patchVariantLocally(productId, variantId, { price: newPrice });
        scheduleRefresh();
        showToast('Price updated', 'success');
      } else {
        showToast(json.message || 'Price update failed', 'error');
      }
    } catch { showToast('Price update failed', 'error'); }
  }, [patchVariantLocally, scheduleRefresh]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full bg-t-base min-h-screen text-t-main relative">
      {/* ── Premium Toast ── */}
      {toast.show && (
        <div
          role="alert"
          aria-live="assertive"
          className={`
            fixed top-6 right-6 z-[1000]
            px-6 py-4 rounded-2xl
            backdrop-blur-xl
            shadow-2xl shadow-black/15
            border border-white/20
            font-bold flex items-center gap-3
            transition-all duration-300 animate-in fade-in slide-in-from-right-4
            ${toast.type === 'success'
              ? 'bg-emerald-500/90 text-white'
              : 'bg-red-500/90 text-white'
            }
          `}
        >
          <span className="text-lg">{toast.type === 'success' ? '✓' : '✕'}</span>
          {toast.message}
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            Products Hub
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
            {serverPaginated
              ? `${total} products · showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)}`
              : `${filteredProducts.length} products`} · Click ▸ to expand variants
          </p>
        </div>
        <button
          onClick={() => { closeAndResetModal(); setShowModal(true); }}
          className="
            px-6 py-3 rounded-2xl text-sm font-bold text-white
            bg-gradient-to-r from-indigo-600 to-purple-600
            hover:from-indigo-700 hover:to-purple-700
            shadow-lg shadow-indigo-500/25
            hover:shadow-xl hover:shadow-indigo-500/30
            hover:-translate-y-0.5
            transition-all duration-300
            flex items-center gap-2
          "
        >
          <span className="text-lg leading-none">+</span>
          Add Product
        </button>
      </div>

      {/* ── Search Bar ── */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search products by name or SKU..."
            aria-label="Search products"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
            className="w-full pl-11 pr-4 py-3 text-sm border border-gray-200/60 dark:border-white/10 bg-white/60 dark:bg-white/[0.03] backdrop-blur-xl rounded-2xl focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all duration-200 text-gray-900 dark:text-white placeholder-gray-400"
          />
        </div>
      </div>

      {/* ── Product Matrix Table ── */}
      <VariantMatrix
        products={filteredProducts}
        API_BASE_URL={API_BASE_URL}
        onEditProduct={handleEdit}
        onDeleteProduct={handleDelete}
        onDuplicateProduct={handleDuplicate}
        onToggleActive={handleToggleActive}
        onStockUpdate={handleInlineStockUpdate}
        onPriceUpdate={handleInlinePriceUpdate}
        onViewImage={(url) => setImageViewer({ open: true, url })}
        onTag={handleTag}
        onHistory={openHistoryModal}
      />

      {/* ── Pager (only when the backend actually paged) ── */}
      {serverPaginated && total > PAGE_SIZE && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-5">
          <p className="text-xs font-semibold text-t-muted">
            Page {page} of {Math.max(1, Math.ceil(total / PAGE_SIZE))}
            <span className="mx-2 opacity-40">·</span>
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-4 py-2 rounded-xl text-xs font-bold border border-t-border bg-t-surface text-t-main disabled:opacity-40 disabled:cursor-not-allowed hover:border-t-primary transition-colors"
            >
              ← Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              disabled={page * PAGE_SIZE >= total}
              className="px-4 py-2 rounded-xl text-xs font-bold border border-t-border bg-t-surface text-t-main disabled:opacity-40 disabled:cursor-not-allowed hover:border-t-primary transition-colors"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {showModal && (
        <div role="dialog" aria-modal="true" aria-label={editingId ? 'Edit product' : 'Add new product'} className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-md">
          <div className="bg-white/80 dark:bg-gray-900/75 backdrop-blur-2xl rounded-3xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col border border-white/40 dark:border-white/10">

            <div className="px-8 py-5 border-b border-gray-200/50 dark:border-white/10 flex justify-between items-center shrink-0">
              <h2 className="text-xl font-extrabold text-gray-900 dark:text-white">{editingId ? 'Edit Directory Configuration' : 'New Product Registration'}</h2>
              <button type="button" onClick={closeAndResetModal} className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/20 dark:hover:text-red-400 transition-all duration-200 text-xl font-bold">&times;</button>
            </div>

            <form onSubmit={handleAddProduct} className="p-8 overflow-y-auto space-y-8 flex-1">

              <div className="bg-t-surface p-6 rounded-xl border border-t-border shadow-sm grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="col-span-1 md:col-span-2 border-b border-t-border pb-2 mb-2 flex items-center gap-2">
                   <div className="w-2 h-6 bg-indigo-500 rounded-full"></div>
                   <h3 className="text-lg font-bold text-t-main">Master Information</h3>
                </div>

                <div className="space-y-4">
                  <div>
                      <label className="block text-xs font-bold text-t-muted mb-1 uppercase">Product Title</label>
                      <input required aria-required="true" type="text" value={baseProd.name} onChange={(e)=>setBaseProd({...baseProd, name: e.target.value})} className="w-full border border-t-border bg-t-base rounded-lg p-2.5 outline-none focus:border-indigo-500 font-medium text-sm transition" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                      <div>
                          <label className="block text-xs font-bold text-t-muted mb-1 uppercase">Category</label>
                          <select value={baseProd.category} onChange={(e)=>setBaseProd({...baseProd, category: e.target.value})} className="w-full border border-t-border bg-t-base rounded-lg p-2.5 outline-none text-sm transition focus:border-indigo-500">
                            <option value="">Select Category</option>
                            {Array.isArray(categories) && categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                          </select>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-t-muted mb-1 uppercase">Brand</label>
                          <select value={baseProd.brand} onChange={(e)=>setBaseProd({...baseProd, brand: e.target.value})} className="w-full border border-t-border bg-t-base rounded-lg p-2.5 outline-none text-sm transition focus:border-indigo-500">
                            <option value="">Select Brand</option>
                            {Array.isArray(brands) && brands.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                          </select>
                      </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                      <div>
                          <label className="block text-xs font-bold text-t-muted mb-1 uppercase">Master SKU</label>
                          <input required aria-required="true" type="text" placeholder="e.g. A60" value={baseProd.sku} onChange={(e)=>setBaseProd({...baseProd, sku: e.target.value})} className="w-full border border-indigo-200 bg-indigo-50/30 rounded-lg p-2.5 outline-none text-indigo-700 font-black text-sm" />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-t-muted mb-1 uppercase">Base Color</label>
                          <input type="text" placeholder="Optional" value={baseProd.color} onChange={(e)=>setBaseProd({...baseProd, color: e.target.value})} className="w-full border border-t-border bg-t-base rounded-lg p-2.5 outline-none text-sm focus:border-indigo-500" />
                      </div>
                  </div>
                </div>

                <div className="space-y-4 flex flex-col">
                  <div>
                      <label className="block text-xs font-bold text-t-muted mb-1 uppercase">Main Image Upload</label>
                      <input type="file" accept="image/*" onChange={(e) => handlePickImage(e, setBaseImage)} className="w-full border border-dashed border-t-border bg-t-base rounded-lg p-2 text-sm" />
                      {editingId && !baseImage && <span className="text-[10px] text-green-600 font-bold mt-1 block">System maintaining previous image.</span>}
                  </div>
                  <div className="flex-1">
                      <label className="block text-xs font-bold text-t-muted mb-1 uppercase">Detailed Description</label>
                      <textarea rows="5" placeholder="General description..." value={baseProd.details} onChange={(e)=>setBaseProd({...baseProd, details: e.target.value})} className="w-full h-[calc(100%-20px)] border border-t-border bg-t-base rounded-lg p-2.5 outline-none text-sm resize-none focus:border-indigo-500 transition"></textarea>
                  </div>
                </div>
              </div>

              <div className="bg-t-surface p-6 rounded-xl border border-t-border shadow-sm">
                <div className="border-b border-t-border pb-2 mb-4 flex items-center gap-2">
                   <div className="w-2 h-6 bg-green-500 rounded-full"></div>
                   <h3 className="text-lg font-bold text-t-main">Pricing & Stock Map</h3>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
                  <div><label className="block text-xs font-bold text-t-muted mb-1 uppercase">Cost Price ৳</label><input type="number" value={baseProd.cost_price} onChange={(e)=>setBaseProd({...baseProd, cost_price: e.target.value})} className="w-full border border-t-border bg-t-base rounded-lg p-2.5 text-sm" /></div>
                  <div><label className="block text-xs font-bold text-t-muted mb-1 uppercase">Sell Price ৳</label><input required aria-required="true" type="number" value={baseProd.price} onChange={(e)=>setBaseProd({...baseProd, price: e.target.value})} className="w-full border border-indigo-200 bg-indigo-50/10 rounded-lg p-2.5 text-sm font-bold" /></div>
                  <div><label className="block text-xs font-bold text-t-muted mb-1 uppercase">Discount %</label><input type="number" value={baseProd.discount} onChange={(e)=>setBaseProd({...baseProd, discount: e.target.value})} placeholder="0" className="w-full border border-t-border bg-t-base rounded-lg p-2.5 text-sm" /></div>
                  <div>
                      <label className="block text-xs font-bold text-t-muted mb-1 uppercase">Base Stock Qty</label>
                      <input required aria-required="true" type="number" disabled={baseProd.hasSizes} value={baseProd.stock} onChange={(e)=>setBaseProd({...baseProd, stock: e.target.value})} className={`w-full border border-t-border rounded-lg p-2.5 text-sm font-bold ${baseProd.hasSizes ? `bg-gray-100 ${mutedText} cursor-not-allowed` : 'bg-t-base text-t-primary'}`} />
                  </div>
                </div>

                <div className="bg-t-base border border-t-border p-4 rounded-lg">
                    <div className="flex items-center gap-3 mb-3">
                        <input type="checkbox" id="addBaseSize" checked={baseProd.hasSizes} onChange={(e) => toggleBaseHasSizes(e.target.checked)} className="w-5 h-5 accent-indigo-600 cursor-pointer" />
                        <label htmlFor="addBaseSize" className="text-sm font-bold cursor-pointer select-none">Deploy Size Matrix for Master SKU</label>
                    </div>

                        {baseProd.hasSizes && (
                    <div className="pl-8 space-y-3 mt-4 border-l-2 border-indigo-200">
                        {baseProd.sizes.map((sz) => (
                        <div key={sz.id} className="flex flex-wrap md:flex-nowrap gap-4 items-end bg-t-surface p-3 rounded-lg border border-t-border shadow-sm">
                            <div className="w-full md:w-1/6">
                                <label className="text-[10px] font-bold text-t-muted uppercase block mb-1">Size Value</label>
                                <input type="text" placeholder="e.g. 40" value={sz.size} onChange={(e) => updateBaseSize(sz.id, 'size', e.target.value)} className="w-full border border-t-border bg-t-base rounded-lg p-2 text-sm font-medium focus:border-indigo-500 outline-none transition" />
                            </div>
                            <div className="w-full md:w-1/6">
                                <label className="text-[10px] font-bold text-t-muted uppercase block mb-1">Cost ৳</label>
                                <input type="number" placeholder="Cost" value={sz.cost_price} onChange={(e) => updateBaseSize(sz.id, 'cost_price', e.target.value)} className="w-full border border-t-border bg-t-base rounded-lg p-2 text-sm focus:border-indigo-500 outline-none transition" />
                            </div>
                            <div className="w-full md:w-1/6">
                                <label className="text-[10px] font-bold text-t-muted uppercase block mb-1">Assigned Stock</label>
                                <input type="number" placeholder="Qty" value={sz.stock} onChange={(e) => updateBaseSize(sz.id, 'stock', e.target.value)} className="w-full border border-t-border bg-t-base rounded-lg p-2 text-sm font-bold text-indigo-600 focus:border-indigo-500 outline-none transition" />
                            </div>
                            <div className="w-full md:w-1/6">
                                <label className="text-[10px] font-bold text-t-muted uppercase block mb-1">Price Override ৳</label>
                                <input type="number" placeholder="Price" value={sz.price} onChange={(e) => updateBaseSize(sz.id, 'price', e.target.value)} className="w-full border border-t-border bg-t-base rounded-lg p-2 text-sm focus:border-indigo-500 outline-none transition" />
                            </div>
                            <div className="w-full md:w-1/6 bg-indigo-50/50 p-2 rounded-lg border border-indigo-100 flex justify-between items-center">
                                <div>
                                    <label className="text-[10px] font-bold text-indigo-400 uppercase block mb-0.5">System SKU Code</label>
                                    <span className="text-sm font-black text-indigo-700 tracking-wide">{baseProd.sku ? `${baseProd.sku}_${sz.size || '?'}` : 'Pending'}</span>
                                </div>
                            </div>
                            <div className="w-full md:w-1/6 flex justify-end">
                                {baseProd.sizes.length > 1 && <button type="button" onClick={() => removeBaseSize(sz.id)} className="text-red-500 hover:text-white hover:bg-red-500 rounded-md w-7 h-7 flex items-center justify-center font-bold transition">✕</button>}
                            </div>
                        </div>
                        ))}
                        <button type="button" onClick={addBaseSize} className="text-sm font-bold text-indigo-600 hover:bg-indigo-50 px-4 py-2 rounded-lg border border-indigo-100 mt-2 transition-colors">+ Attach Sub-Size</button>
                    </div>
                    )}
                </div>
              </div>

              <div className="bg-t-surface p-6 rounded-xl border border-t-border shadow-sm">
                <div className="border-b border-t-border pb-2 mb-4 flex items-center justify-between">
                   <div className="flex items-center gap-2">
                       <div className="w-2 h-6 bg-orange-500 rounded-full"></div>
                       <h3 className="text-lg font-bold text-t-main">Extension Variants Array (Design / Color)</h3>
                   </div>
                   <button type="button" onClick={addExtraVariant} className="text-sm font-bold bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 shadow-sm transition">+ Inject Variant</button>
                </div>

                {extraVariants.length === 0 ? (
                    <div className="text-center py-8 text-t-muted text-sm font-medium border-2 border-dashed border-t-border rounded-xl">No extensions active. Master product will act as sole entity.</div>
                ) : (
                    <div className="space-y-6">
                        {extraVariants.map((variant, index) => (
                        <div key={variant.id} className="bg-t-base p-5 rounded-xl border border-t-border relative shadow-sm">
                            <button type="button" onClick={() => removeExtraVariant(variant.id)} className="absolute top-4 right-4 text-red-400 hover:text-red-600 font-bold p-1 bg-red-50 rounded px-3 text-xs transition">Remove</button>

                            <h4 className="font-bold text-t-main text-sm mb-4">Variant Module #{index + 1}</h4>

                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                            <div><label className="block text-[10px] font-bold text-t-muted mb-1 uppercase">Color</label><input type="text" placeholder="e.g. Red" value={variant.color} onChange={(e) => updateExtraVariant(variant.id, 'color', e.target.value)} className="w-full border border-t-border bg-t-surface rounded-lg p-2 text-sm focus:border-orange-400 outline-none transition" /></div>
                            <div><label className="block text-[10px] font-bold text-orange-600 mb-1 uppercase">Color SKU Code</label><input required type="text" placeholder="e.g. D10" value={variant.sku} onChange={(e) => updateExtraVariant(variant.id, 'sku', e.target.value)} className="w-full border border-orange-200 bg-orange-50 rounded-lg p-2 text-sm outline-none font-bold text-orange-700" /></div>
                            <div><label className="block text-[10px] font-bold text-t-muted mb-1 uppercase">Cost Price ৳</label><input required type="number" value={variant.cost_price} onChange={(e) => updateExtraVariant(variant.id, 'cost_price', e.target.value)} className="w-full border border-t-border bg-t-surface rounded-lg p-2 text-sm font-bold focus:border-orange-400 outline-none transition" /></div>
                            <div><label className="block text-[10px] font-bold text-t-muted mb-1 uppercase">Sell Price ৳</label><input required type="number" value={variant.price} onChange={(e) => updateExtraVariant(variant.id, 'price', e.target.value)} className="w-full border border-t-border bg-t-surface rounded-lg p-2 text-sm font-bold focus:border-orange-400 outline-none transition" /></div>
                            <div>
                                <label className="block text-[10px] font-bold text-t-muted mb-1 uppercase">Stock Qty</label>
                                <input required type="number" disabled={variant.hasSizes} value={variant.stock} onChange={(e) => updateExtraVariant(variant.id, 'stock', e.target.value)} className={`w-full border border-t-border rounded-lg p-2 text-sm font-bold ${variant.hasSizes ? `bg-gray-100 ${mutedText}` : 'bg-t-surface focus:border-orange-400 outline-none transition'}`} />
                            </div>
                            <div className="col-span-2 md:col-span-5">
                                <label className="block text-[10px] font-bold text-t-muted mb-1 uppercase">Color Image</label>
                                <input type="file" accept="image/*" onChange={(e) => handlePickImage(e, (file) => updateExtraVariant(variant.id, 'imageFile', file))} className="w-full border border-dashed border-t-border bg-t-surface rounded-lg p-1.5 text-xs" />
                                {variant.existing_image_url && !variant.imageFile && <span className="text-[10px] text-green-600 font-bold mt-1 block">Image saved — replace above to change</span>}
                            </div>
                            </div>

                            <div className="mt-4 bg-t-surface p-4 rounded-lg border border-t-border">
                                <div className="flex items-center gap-2 mb-3">
                                    <input type="checkbox" id={`addSz_${variant.id}`} checked={variant.hasSizes} onChange={(e) => toggleExtraVariantSizes(variant.id, e.target.checked)} className="w-4 h-4 cursor-pointer accent-orange-500" />
                                    <label htmlFor={`addSz_${variant.id}`} className="text-sm font-bold cursor-pointer text-t-main">Activate Size Matrix</label>
                                </div>
                                {variant.hasSizes && (
                                    <div className="space-y-3 mt-3 border-l-2 border-orange-200 pl-4">
                                        {variant.sizes.map(sz => (
                                            <div key={sz.id} className="flex flex-wrap md:flex-nowrap gap-3 items-center">
                                                <input type="text" placeholder="Size" value={sz.size} onChange={(e) => updateExtraVariantSize(variant.id, sz.id, 'size', e.target.value)} className="w-full md:w-1/5 border border-t-border rounded-md p-1.5 text-sm bg-t-base focus:border-orange-400 outline-none transition" />
                                                <input type="number" placeholder="Cost ৳" value={sz.cost_price} onChange={(e) => updateExtraVariantSize(variant.id, sz.id, 'cost_price', e.target.value)} className="w-full md:w-1/5 border border-t-border rounded-md p-1.5 text-sm bg-t-base focus:border-orange-400 outline-none transition" />
                                                <input type="number" placeholder="Qty" value={sz.stock} onChange={(e) => updateExtraVariantSize(variant.id, sz.id, 'stock', e.target.value)} className="w-full md:w-1/5 border border-t-border rounded-md p-1.5 text-sm bg-t-base text-orange-600 font-bold focus:border-orange-400 outline-none transition" />
                                                <input type="number" placeholder="Price ৳" value={sz.price} onChange={(e) => updateExtraVariantSize(variant.id, sz.id, 'price', e.target.value)} className="w-full md:w-1/5 border border-t-border rounded-md p-1.5 text-sm bg-t-base focus:border-orange-400 outline-none transition" />
                                                <div className={`w-full md:w-1/5 text-[10px] font-bold ${mutedText} flex justify-between items-center ${inputBg} px-2 py-1.5 rounded-md border`}>
                                                    <span>Code: <span className="text-orange-600">{variant.sku ? `${variant.sku}_${sz.size || '?'}` : 'Wait'}</span></span>
                                                    {variant.sizes.length > 1 && <button type="button" onClick={() => removeExtraVariantSize(variant.id, sz.id)} className="text-red-500 font-bold text-sm bg-red-50 w-5 h-5 rounded flex items-center justify-center">✕</button>}
                                                </div>
                                            </div>
                                        ))}
                                        <button type="button" onClick={() => addExtraVariantSize(variant.id)} className="text-xs font-bold text-orange-600 mt-2 hover:underline">+ Attach Row</button>
                                    </div>
                                )}
                            </div>
                        </div>
                        ))}
                    </div>
                )}
              </div>

              <div className="bg-t-surface p-6 rounded-xl border border-t-border shadow-sm">
                <div className="border-b border-t-border pb-2 mb-4 flex items-center justify-between">
                   <div className="flex items-center gap-2">
                       <div className="w-2 h-6 bg-pink-500 rounded-full"></div>
                       <h3 className="text-lg font-bold text-t-main">Client Feedback Registry</h3>
                   </div>
                   <button type="button" onClick={addReview} className="text-sm font-bold bg-pink-50 text-pink-600 border border-pink-200 px-4 py-2 rounded-lg hover:bg-pink-100 transition shadow-sm">+ Log Review</button>
                </div>

                {reviews.length === 0 ? (
                    <div className="text-center py-6 text-t-muted text-sm font-medium border-2 border-dashed border-t-border rounded-xl">No manual reviews registered.</div>
                ) : (
                    <div className="space-y-4">
                        {reviews.map((review, index) => (
                        <div key={review.id} className="bg-t-base p-5 rounded-xl border border-pink-100 relative shadow-sm flex flex-col md:flex-row gap-6">
                            <button type="button" onClick={() => removeReview(review.id)} className="absolute top-2 right-2 text-red-400 hover:text-red-600 font-bold p-2 text-xl leading-none">&times;</button>

                            <div className="w-full md:w-1/3 space-y-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-t-muted mb-1 uppercase">Client Name</label>
                                    <input type="text" value={review.name} onChange={(e) => updateReview(review.id, 'name', e.target.value)} className="w-full border border-t-border bg-t-surface rounded-lg p-2 text-sm focus:border-pink-300 outline-none transition" placeholder="e.g. Nusrat Jahan" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-t-muted mb-1 uppercase">Asset (Image)</label>
                                    <input type="file" accept="image/*" onChange={(e) => handlePickImage(e, (file) => updateReview(review.id, 'imageFile', file))} className="w-full border border-dashed border-t-border bg-t-surface rounded-lg p-1.5 text-xs" />
                                    {review.existing_image && !review.imageFile && <a href={review.existing_image} target="_blank" rel="noreferrer" className="text-[10px] text-pink-600 mt-1 font-bold block underline">Inspect Current Image</a>}
                                </div>
                            </div>
                            <div className="w-full md:w-2/3">
                                <label className="block text-[10px] font-bold text-t-muted mb-1 uppercase">Feedback Transcription</label>
                                <textarea rows="5" value={review.comment} onChange={(e) => updateReview(review.id, 'comment', e.target.value)} className="w-full border border-t-border bg-t-surface rounded-lg p-3 text-sm resize-none outline-none focus:border-pink-300 transition" placeholder="Transcribe feedback..."></textarea>
                            </div>
                        </div>
                        ))}
                    </div>
                )}
              </div>

            </form>

            <div className="px-8 py-4 border-t border-gray-200/50 dark:border-white/10 flex justify-end gap-4 shrink-0">
                <button type="button" onClick={closeAndResetModal} className="px-6 py-2.5 rounded-xl font-bold text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 transition border border-gray-200 dark:border-white/10">Halt Process</button>
                <button type="submit" onClick={handleAddProduct} disabled={isSubmitting} className="px-8 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-extrabold text-sm hover:from-indigo-700 hover:to-purple-700 shadow-lg shadow-indigo-500/25 hover:shadow-xl transition-all duration-300 active:scale-95 flex items-center gap-2">
                    {isSubmitting ? 'Transmitting Data...' : 'Execute Data Commit'}
                </button>
            </div>

          </div>
        </div>
      )}

      {imageViewer.open && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/80 backdrop-blur-lg" onClick={() => setImageViewer({ open: false, url: '' })}>
          <button aria-label="Close image" className="absolute top-6 right-6 z-[1300] w-10 h-10 bg-white/10 backdrop-blur-xl text-white rounded-full flex items-center justify-center hover:bg-white/20 transition-all" onClick={() => setImageViewer({ open: false, url: '' })}>✕</button>
          <div className="max-w-[80vw] max-h-[80vh] p-2">
            <img src={imageViewer.url} alt="preview" className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl border border-white/10" />
          </div>
        </div>
      )}

      {historyModal.open && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-md" onClick={() => setHistoryModal({ open: false, product: null, type: 'edit' })}>
          <div className="bg-white/80 dark:bg-gray-900/75 backdrop-blur-2xl rounded-3xl shadow-2xl w-full max-w-3xl max-h-[80vh] overflow-hidden flex flex-col border border-white/40 dark:border-white/10" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-200/50 dark:border-white/10 flex justify-between items-center">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">{historyModal.type === 'edit' ? 'Edit History' : 'Stock History'} — {historyModal.product?.name}</h2>
              <button onClick={() => setHistoryModal({ open: false, product: null, type: 'edit' })} className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 dark:bg-white/10 text-gray-500 hover:bg-red-50 hover:text-red-500 transition-all font-bold">&times;</button>
            </div>
            <div className="overflow-y-auto p-6">
              {historyData.length === 0 ? (
                <div className="text-center py-10 text-gray-400 font-medium">No history records found.</div>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-200/50 dark:border-white/10 text-gray-500 dark:text-gray-500">
                      <th className="p-3 text-xs uppercase tracking-wider">Date</th>
                      {historyModal.type === 'edit' && <th className="p-3 text-xs uppercase tracking-wider">Action</th>}
                      <th className="p-3 text-xs uppercase tracking-wider">Changes</th>
                      <th className="p-3 text-xs uppercase tracking-wider">By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyData.map((h, i) => (
                      <tr key={h.id || i} className="border-b border-gray-100/50 dark:border-white/5 hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors">
                        <td className="p-3 text-xs text-gray-500">{new Date(h.created_at).toLocaleString()}</td>
                        {historyModal.type === 'edit' && <td className="p-3 font-bold capitalize text-gray-900 dark:text-white">{h.action}</td>}
                        <td className="p-3 text-xs font-mono max-w-[300px] truncate text-gray-600 dark:text-gray-400">{typeof h.changes === 'string' ? h.changes : JSON.stringify(h.changes)}</td>
                        <td className="p-3 text-xs text-gray-600 dark:text-gray-400">{h.created_by || 'Admin'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-200/50 dark:border-white/10 flex justify-end">
              <button onClick={() => setHistoryModal({ open: false, product: null, type: 'edit' })} className="px-6 py-2 rounded-xl font-bold border border-gray-200 dark:border-white/10 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 transition">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
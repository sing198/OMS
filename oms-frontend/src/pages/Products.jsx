import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import axios from 'axios';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import Navbar from './Navbar';
import { useTranslation } from 'react-i18next';

const PLATFORM_STYLES = {
  Steam: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  Epic: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  Origin: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  Ubisoft: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
};

export default function Products() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('default'); // default | price_asc | price_desc | discount_desc
  const catalogRef = useRef(null);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useTranslation();

  // Pagination & Filter State
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [platform, setPlatform] = useState(searchParams.get('platform') || '');
  const itemsPerPage = 10;

  useEffect(() => {
    const urlSearch = searchParams.get('search') || '';
    const urlPlatform = searchParams.get('platform') || '';
    if (urlSearch !== search) setSearch(urlSearch);
    if (urlPlatform !== platform) setPlatform(urlPlatform);
  }, [searchParams]);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      let url = `${import.meta.env.VITE_API_URL || 'http://localhost:8080'}/products?page=${currentPage}&limit=${itemsPerPage}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      if (platform) url += `&platform=${encodeURIComponent(platform)}`;

      const response = await axios.get(url);
      setProducts(response.data.data || []);
      setTotalPages(response.data.meta?.total_pages || 1);
      setTotalItems(response.data.meta?.total || 0);
      setLoading(false);
    } catch {
      toast.error('ไม่สามารถดึงข้อมูลสินค้าได้');
      setLoading(false);
    }
  }, [currentPage, search, platform]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const sortedProducts = useMemo(() => {
    const list = [...products];
    const netPrice = (p) => p.price * (1 - (p.discount_percent || 0) / 100);
    if (sortBy === 'price_asc') {
      list.sort((a, b) => netPrice(a) - netPrice(b));
    } else if (sortBy === 'price_desc') {
      list.sort((a, b) => netPrice(b) - netPrice(a));
    } else if (sortBy === 'discount_desc') {
      list.sort((a, b) => (b.discount_percent || 0) - (a.discount_percent || 0));
    }
    return list;
  }, [products, sortBy]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    const params = {};
    if (search.trim()) params.search = search.trim();
    if (platform) params.platform = platform;
    setSearchParams(params);
  };

  const handleClearFilters = () => {
    setSearch('');
    setPlatform('');
    setSortBy('default');
    setCurrentPage(1);
    setSearchParams({});
  };

  const handlePlatformChange = (p) => {
    setPlatform(p);
    setCurrentPage(1);
    const params = {};
    if (search.trim()) params.search = search.trim();
    if (p) params.platform = p;
    setSearchParams(params);
  };

  const addToCart = (product, isBuyNow = false) => {
    let cart = JSON.parse(localStorage.getItem('cart')) || [];
    const existingItemIndex = cart.findIndex(item => item.id === product.id);
    
    if (existingItemIndex !== -1) {
      if (cart[existingItemIndex].cartQuantity >= product.stock_quantity) {
        toast.error(`เกม ${product.name} มีสต็อกไม่พอให้เพิ่มแล้ว!`);
        return;
      } else {
        cart[existingItemIndex].cartQuantity += 1;
        if (!isBuyNow) toast.success(`เพิ่มคีย์ ${product.name} เป็น ${cart[existingItemIndex].cartQuantity} คีย์แล้ว! 🛒`);
      }
    } else {
      cart.push({ ...product, cartQuantity: 1 });
      if (!isBuyNow) toast.success(`เพิ่ม ${product.name} ลงตะกร้าแล้ว! 🛒`);
    }

    localStorage.setItem('cart', JSON.stringify(cart));
    window.dispatchEvent(new Event('cartUpdated'));

    if (isBuyNow) {
      const updatedItem = cart.find(item => item.id === product.id);
      if (updatedItem) {
        localStorage.setItem('checkout_items', JSON.stringify([updatedItem]));
      }
      navigate('/checkout');
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0c10] font-sans text-gray-200 flex flex-col">
      <Navbar />

      <div className="max-w-[1400px] w-full mx-auto px-6 py-8 flex-1">
        
        {/* HERO BANNER */}
        <div
          onClick={() => catalogRef.current?.scrollIntoView({ behavior: 'smooth' })}
          className="w-full aspect-[16/9] sm:aspect-[21/9] md:aspect-[3.8/1] bg-[#12141c] rounded-3xl mb-8 relative overflow-hidden group cursor-pointer shadow-2xl border border-gray-800/80"
        >
          <img
            src="https://preview.redd.it/attacking-the-braithwaite-mission-wallpaper-with-ai-v0-ni5zilybc6ie1.jpeg?width=1080&crop=smart&auto=webp&s=c86f054bfb2947a2e6686e63d0a0c36d9887e1c9"
            alt="Featured Game Banner"
            className="w-full h-full object-cover opacity-65 group-hover:opacity-80 group-hover:scale-105 transition-all duration-700"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0b0c10] via-[#0b0c10]/70 to-transparent flex flex-col justify-center px-8 md:px-16">
            <div className="inline-flex items-center gap-2 bg-rose-600/20 border border-rose-500/30 text-rose-400 font-black tracking-widest text-xs px-3 py-1 rounded-full w-max mb-3 uppercase">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
              {t('hot_deal')}
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-white leading-tight mb-3 max-w-xl tracking-tight">
              RED DEAD REDEMPTION 2
            </h1>
            <p className="text-gray-300 text-sm md:text-base max-w-lg mb-6 hidden sm:block line-clamp-2">
              {t('hot_deal_detail')}
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="bg-rose-600 hover:bg-rose-500 text-white px-7 py-3 rounded-full font-black text-sm transition-all shadow-lg shadow-rose-600/25 active:scale-95 flex items-center gap-2"
              >
                {t('shop_now')}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
              </button>
              <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-full hidden md:inline-flex items-center gap-1.5">
                ⚡ Instant Digital Key
              </span>
            </div>
          </div>
        </div>

        {/* TRUST HIGHLIGHTS BAR */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          <div className="bg-[#12141c] border border-gray-800/80 rounded-2xl p-4 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 text-lg flex-shrink-0">
              ⚡
            </div>
            <div>
              <h3 className="text-white font-bold text-sm">Instant Key Delivery</h3>
              <p className="text-gray-500 text-xs">Receive activation keys right after payment</p>
            </div>
          </div>
          <div className="bg-[#12141c] border border-gray-800/80 rounded-2xl p-4 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 text-lg flex-shrink-0">
              🛡️
            </div>
            <div>
              <h3 className="text-white font-bold text-sm">100% Official & Verified</h3>
              <p className="text-gray-500 text-xs">Authentic global keys for Steam, Epic & more</p>
            </div>
          </div>
          <div className="bg-[#12141c] border border-gray-800/80 rounded-2xl p-4 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 text-lg flex-shrink-0">
              🔒
            </div>
            <div>
              <h3 className="text-white font-bold text-sm">Concurrent Stock Protection</h3>
              <p className="text-gray-500 text-xs">Guaranteed stock reservation on checkout</p>
            </div>
          </div>
        </div>

        {/* SEARCH, PLATFORM & SORT BAR */}
        <div ref={catalogRef} className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center mb-8 gap-4 bg-[#161821] p-4 rounded-2xl border border-gray-800 shadow-lg">
          <div className="flex gap-2 overflow-x-auto pb-1 lg:pb-0 custom-scrollbar">
            {[
              { label: 'All Games', value: '' },
              { label: 'Steam', value: 'Steam' },
              { label: 'Epic Games', value: 'Epic' },
              { label: 'EA / Origin', value: 'Origin' },
              { label: 'Ubisoft', value: 'Ubisoft' },
            ].map((tab) => (
              <button
                key={tab.value}
                onClick={() => handlePlatformChange(tab.value)}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
                  platform === tab.value
                    ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/25'
                    : 'bg-[#0b0c10] text-gray-400 hover:text-white border border-gray-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-[#0b0c10] border border-gray-700/80 focus:border-rose-500 rounded-xl py-2 px-3.5 text-xs sm:text-sm font-bold text-gray-300 focus:outline-none cursor-pointer"
            >
              <option value="default">Sort: Featured</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="discount_desc">Biggest Discount</option>
            </select>

            <form onSubmit={handleSearchSubmit} className="relative flex-1 sm:w-64">
              <input 
                type="text" 
                placeholder="Search games..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[#0b0c10] border border-gray-700/80 rounded-xl py-2 pl-9 pr-8 text-sm text-white focus:outline-none focus:border-rose-500 transition-colors"
              />
              <button type="submit" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
              </button>
              {search && (
                <button
                  type="button"
                  onClick={() => { setSearch(''); setCurrentPage(1); setSearchParams(platform ? { platform } : {}); }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white text-xs"
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </form>
          </div>
        </div>

        {/* SECTION HEADER */}
        <div className="flex flex-wrap justify-between items-center mb-6 gap-2">
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight uppercase flex items-center gap-3">
            {platform ? `${platform} Games` : t('best_seller')}
            <span className="text-xs bg-rose-600/15 border border-rose-500/20 text-rose-400 px-3 py-1 rounded-full font-bold">
              {totalItems || products.length} Games
            </span>
          </h2>

          {(search || platform || sortBy !== 'default') && (
            <button
              onClick={handleClearFilters}
              className="text-xs font-bold text-gray-400 hover:text-rose-400 transition-colors flex items-center gap-1"
            >
              ✕ Reset filters
            </button>
          )}
        </div>

        {/* PRODUCT GRID */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
            {Array.from({ length: 10 }).map((_, idx) => (
              <div key={idx} className="bg-[#161821] rounded-2xl overflow-hidden border border-gray-800/80 animate-pulse flex flex-col">
                <div className="w-full aspect-[3/4] bg-gray-800/60" />
                <div className="p-4 space-y-3">
                  <div className="h-4 bg-gray-800 rounded w-3/4" />
                  <div className="h-3 bg-gray-800/80 rounded w-1/3" />
                  <div className="pt-3 border-t border-gray-800 flex justify-between items-center">
                    <div className="h-6 bg-gray-800 rounded w-16" />
                    <div className="h-8 bg-gray-800 rounded-full w-20" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : sortedProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-[#161821] rounded-2xl border border-gray-800 text-center px-4">
            <div className="text-4xl mb-3">🎮</div>
            <p className="text-white font-bold text-lg mb-1">No games matching your filter</p>
            <p className="text-gray-500 text-sm mb-6">Try searching with different keywords or clearing your active filters.</p>
            <button
              onClick={handleClearFilters}
              className="px-6 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-black uppercase tracking-wider rounded-full transition-colors"
            >
              Show All Games
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
            {sortedProducts.map((product) => {
              const plat = product.platform || 'Steam';
              const platBadgeClass = PLATFORM_STYLES[plat] || 'bg-gray-800 text-gray-300 border-gray-700';
              const netPrice = product.price - (product.price * (product.discount_percent || 0) / 100);

              return (
                <div
                  key={product.id}
                  className="bg-[#161821] rounded-2xl group flex flex-col overflow-hidden transition-all duration-300 hover:shadow-[0_12px_35px_-10px_rgba(225,29,72,0.28)] hover:-translate-y-1.5 relative border border-gray-800/90 hover:border-rose-500/40"
                >
                  <div 
                    onClick={() => navigate(`/product/${product.id}`)}
                    className="w-full aspect-[3/4] relative overflow-hidden bg-[#0b0c10] cursor-pointer"
                  >
                    <img 
                      src={product.image_url ? (product.image_url.startsWith('/') ? `${import.meta.env.VITE_API_URL || 'http://localhost:8080'}${product.image_url}` : product.image_url) : 'https://via.placeholder.com/300x400/1e293b/94a3b8'} 
                      alt={product.name} 
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#161821] via-transparent to-transparent opacity-60 pointer-events-none" />
                    
                    {product.discount_percent > 0 && (
                      <div className="absolute top-3 left-3 bg-rose-600 text-white text-xs font-black px-2.5 py-1 rounded-lg shadow-lg z-10">
                        -{product.discount_percent}%
                      </div>
                    )}

                    {product.stock_quantity > 0 && product.stock_quantity <= 5 && (
                      <div className="absolute top-3 right-3 bg-amber-500/90 backdrop-blur-sm text-black text-[10px] font-black px-2 py-0.5 rounded-md shadow z-10">
                        {product.stock_quantity} LEFT
                      </div>
                    )}
                    
                    {product.stock_quantity <= 0 && (
                      <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px] flex items-center justify-center z-20">
                        <span className="bg-[#0b0c10]/90 text-rose-500 text-xs font-black px-4 py-2 rounded-full border border-rose-500/40 shadow-2xl tracking-wider">
                          OUT OF STOCK
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <div className="p-4 flex flex-col flex-grow relative z-30 bg-[#161821]">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${platBadgeClass}`}>
                        {plat}
                      </span>
                      {product.category?.name && (
                        <span className="text-[10px] text-gray-500 font-bold truncate">
                          {product.category.name}
                        </span>
                      )}
                    </div>

                    <h3
                      onClick={() => navigate(`/product/${product.id}`)} 
                      className="text-sm md:text-base font-bold text-white line-clamp-1 group-hover:text-rose-400 transition-colors cursor-pointer mb-3"
                      title={product.name}
                    >
                      {product.name}
                    </h3>

                    <div className="mt-auto pt-3 border-t border-gray-800/80 flex justify-between items-end gap-2">
                      <div className="flex flex-col">
                        {product.discount_percent > 0 ? (
                          <span className="text-gray-500 text-[11px] line-through leading-none mb-1">
                            ฿{product.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        ) : <div className="h-3.5" />}
                        <span className="text-lg font-black text-white leading-none">
                          ฿{netPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      
                      <div className="flex gap-1.5">
                        <button 
                          onClick={() => addToCart(product, false)}
                          disabled={product.stock_quantity <= 0}
                          className="w-8 h-8 rounded-full bg-gray-800 hover:bg-rose-600 text-gray-300 hover:text-white flex items-center justify-center transition-all disabled:opacity-40 cursor-pointer"
                          title={t('add_to_cart')}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"></path></svg>
                        </button>
                        <button 
                          onClick={() => addToCart(product, true)}
                          disabled={product.stock_quantity <= 0}
                          className="bg-white hover:bg-emerald-400 text-black text-xs font-black px-3.5 h-8 rounded-full transition-all disabled:opacity-40 cursor-pointer active:scale-95"
                        >
                          {t('buy')}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* PAGINATION */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center mt-12 gap-4">
            <button 
              onClick={() => { setCurrentPage(prev => Math.max(prev - 1, 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }} 
              disabled={currentPage === 1} 
              className="px-6 py-2.5 bg-[#161821] border border-gray-800 text-sm font-bold rounded-full text-gray-400 hover:text-white hover:border-gray-600 disabled:opacity-40 transition-all shadow-lg cursor-pointer"
            >
              ← Previous
            </button>
            <div className="text-sm font-black text-gray-400 bg-[#161821] px-5 py-2.5 rounded-full border border-gray-800">
              Page <span className="text-white">{currentPage}</span> of {totalPages}
            </div>
            <button 
              onClick={() => { setCurrentPage(prev => Math.min(prev + 1, totalPages)); window.scrollTo({ top: 0, behavior: 'smooth' }); }} 
              disabled={currentPage === totalPages} 
              className="px-6 py-2.5 bg-[#161821] border border-gray-800 text-sm font-bold rounded-full text-gray-400 hover:text-white hover:border-gray-600 disabled:opacity-40 transition-all shadow-lg cursor-pointer"
            >
              Next →
            </button>
          </div>
        )}

      </div>

      {/* FOOTER */}
      <footer className="border-t border-gray-800/80 bg-[#08090c] mt-20 py-10 px-6">
        <div className="max-w-[1400px] mx-auto flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-gray-500">
          <div className="flex items-center gap-3">
            <span className="text-lg font-black text-white tracking-tighter">
              DGKeys<span className="text-rose-600">.</span>
            </span>
            <span>© {new Date().getFullYear()} Digital Game Key Storefront. All rights reserved.</span>
          </div>
          <div className="flex gap-6 font-bold">
            <span onClick={() => navigate('/products')} className="hover:text-gray-300 cursor-pointer">Catalog</span>
            <span onClick={() => navigate('/cart')} className="hover:text-gray-300 cursor-pointer">Cart</span>
            <span onClick={() => navigate('/my-orders')} className="hover:text-gray-300 cursor-pointer">My Orders</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
import { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Navbar from './Navbar';
import { useTranslation } from 'react-i18next';

export default function Products() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  // Pagination & Filter State
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [platform, setPlatform] = useState('');
  const itemsPerPage = 10;

  useEffect(() => {
    fetchProducts();
  }, [currentPage, search, platform]); // Re-fetch when page changes

  const fetchProducts = async () => {
    setLoading(true);
    try {
      let url = `${import.meta.env.VITE_API_URL || 'http://localhost:8080'}/products?page=${currentPage}&limit=${itemsPerPage}`;
      if (search) url += `&search=${search}`;
      if (platform) url += `&platform=${platform}`;

      const response = await axios.get(url);
      setProducts(response.data.data);
      setTotalPages(response.data.meta.total_pages);
      setLoading(false);
    } catch (error) {
      toast.error('ไม่สามารถดึงข้อมูลสินค้าได้');
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchProducts();
  };

  const handlePlatformChange = (p) => {
    setPlatform(p);
    setCurrentPage(1);
    // 💡 ลบการ Fetch แบบแมนนวลออก ให้ useEffect จัดการเองเมื่อค่าเปลี่ยน
  };

  const addToCart = (product, isBuyNow = false) => {
    let cart = JSON.parse(localStorage.getItem('cart')) || [];
    const existingItemIndex = cart.findIndex(item => item.id === product.id);
    
    if (existingItemIndex !== -1) {
      if (cart[existingItemIndex].cartQuantity >= product.stock_quantity) {
        toast.error(`เกม ${product.name} มีสต็อกไม่พอให้เพิ่มแล้ว!`);
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
      navigate('/cart');
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0c10] font-sans text-gray-200">
      <Navbar />

      <div className="max-w-[1400px] mx-auto px-6 py-8">
        
        {/* HERO BANNER MOCKUP */}
        <div className="w-full aspect-[21/9] md:aspect-[4/1] bg-gray-900 rounded-3xl mb-12 relative overflow-hidden group cursor-pointer shadow-2xl border border-gray-800">
          <img src="https://preview.redd.it/attacking-the-braithwaite-mission-wallpaper-with-ai-v0-ni5zilybc6ie1.jpeg?width=1080&crop=smart&auto=webp&s=c86f054bfb2947a2e6686e63d0a0c36d9887e1c9" alt="Banner" className="w-full h-full object-cover opacity-60 group-hover:opacity-80 group-hover:scale-105 transition-all duration-700" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/50 to-transparent flex flex-col justify-center px-10 md:px-20">
            <span className="text-rose-500 font-bold tracking-widest text-sm mb-2">{t('hot_deal')}</span>
            <h1 className="text-4xl md:text-6xl font-black text-white leading-tight mb-4 max-w-xl">RED DEAD REDEMPTION 2</h1>
            <p className="text-gray-300 max-w-md mb-6 hidden md:block">{t('hot_deal_detail')}</p>
            <button className="bg-white text-black px-8 py-3 rounded-full font-bold w-max hover:bg-gray-200 transition-colors shadow-xl shadow-white/10">{t('shop_now')}</button>
          </div>
        </div>

        {/* SEARCH AND FILTER BAR */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 bg-[#161821] p-4 rounded-2xl border border-gray-800">
            <div className="flex gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 custom-scrollbar">
                <button onClick={() => handlePlatformChange('')} className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-colors ${platform === '' ? 'bg-rose-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>All Games</button>
                <button onClick={() => handlePlatformChange('Steam')} className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-colors ${platform === 'Steam' ? 'bg-rose-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>Steam</button>
                <button onClick={() => handlePlatformChange('Epic')} className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-colors ${platform === 'Epic' ? 'bg-rose-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>Epic Games</button>
                <button onClick={() => handlePlatformChange('Origin')} className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-colors ${platform === 'Origin' ? 'bg-rose-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>Origin</button>
            </div>
            <form onSubmit={handleSearchSubmit} className="relative w-full md:w-72">
                <input 
                    type="text" 
                    placeholder="Search games..." 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-[#0b0c10] border border-gray-700 rounded-xl py-2 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-rose-500"
                />
                <button type="submit" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                </button>
            </form>
        </div>

        <h2 className="text-3xl font-black text-white mb-6 tracking-tight uppercase flex items-center gap-3">
            {platform ? `${platform} Games` : t('best_seller')}
            <span className="text-xs bg-rose-600/20 text-rose-500 px-3 py-1 rounded-full">{products.length} Items</span>
        </h2>

        {/* PRODUCT GRID */}
        {loading ? (
            <div className="flex justify-center py-20 text-gray-500 font-bold">Loading...</div>
        ) : products.length === 0 ? (
            <div className="flex justify-center py-20 bg-[#161821] rounded-2xl border border-gray-800 text-gray-500 font-bold">No games found.</div>
        ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
            {products.map((product) => (
                <div key={product.id} className="bg-[#161821] rounded-2xl group flex flex-col overflow-hidden transition-all duration-300 hover:shadow-2xl hover:shadow-rose-900/20 hover:-translate-y-1 relative border border-gray-800 hover:border-gray-600">
                
                <div 
                    onClick={() => navigate(`/product/${product.id}`)}
                    className="w-full aspect-[3/4] relative overflow-hidden bg-gray-900 cursor-pointer">
                    <img 
                    src={product.image_url ? (product.image_url.startsWith('/') ? `${import.meta.env.VITE_API_URL || 'http://localhost:8080'}${product.image_url}` : product.image_url) : 'https://via.placeholder.com/300x400/1e293b/94a3b8'} 
                    alt={product.name} 
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                    />
                    
                    {product.discount_percent > 0 && (
                    <div className="absolute top-3 left-3 bg-rose-600 text-white text-xs font-black px-2.5 py-1 rounded-md shadow-lg z-10">
                        -{product.discount_percent}%
                    </div>
                    )}
                    
                    {product.stock_quantity <= 0 && (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-20">
                        <span className="bg-gray-900 text-rose-500 font-bold px-4 py-2 rounded-full border border-rose-500/30 shadow-2xl">OUT OF STOCK</span>
                    </div>
                    )}
                </div>
                
                <div className="p-4 flex flex-col flex-grow relative z-30 bg-[#161821]">
                    <div className="flex justify-between items-start gap-2 mb-1">
                    <h3
                        onClick={() => navigate(`/product/${product.id}`)} 
                        className="text-sm md:text-base font-bold text-white line-clamp-1 group-hover:text-rose-400 transition-colors cursor-pointer" title={product.name}>
                        {product.name}
                    </h3>
                    </div>
                    
                    <p className="text-[11px] text-gray-500 font-bold uppercase tracking-wider mb-3">
                    {product.platform || 'Steam'}
                    </p>

                    <div className="mt-auto pt-3 border-t border-gray-800 flex justify-between items-end">
                    <div className="flex flex-col">
                        {product.discount_percent > 0 ? (
                        <span className="text-gray-500 text-[10px] line-through mb-0.5">
                            ฿{product.price.toFixed(2)}
                        </span>
                        ) : <div className="h-4"></div>}
                        <span className="text-lg font-black text-white">
                        ฿{(product.price - (product.price * (product.discount_percent || 0) / 100)).toFixed(2)}
                        </span>
                    </div>
                    
                    <div className="flex gap-1.5">
                        <button 
                        onClick={() => addToCart(product, false)}
                        disabled={product.stock_quantity <= 0}
                        className="w-8 h-8 rounded-full bg-gray-800 hover:bg-white text-gray-300 hover:text-black flex items-center justify-center transition-colors disabled:opacity-50 disabled:hover:bg-gray-800 disabled:hover:text-gray-300"
                        title="Add to Cart"
                        >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"></path></svg>
                        </button>
                        <button 
                        onClick={() => addToCart(product, true)}
                        disabled={product.stock_quantity <= 0}
                        className="bg-white hover:bg-gray-200 text-black text-xs font-black px-3 h-8 rounded-full transition-colors disabled:opacity-50"
                        >
                        {t('buy')}
                        </button>
                    </div>
                    </div>
                </div>
                </div>
            ))}
            </div>
        )}

        {/* PAGINATION */}
        {totalPages > 1 && (
            <div className="flex justify-center items-center mt-12 gap-4">
                <button 
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} 
                    disabled={currentPage === 1} 
                    className="px-6 py-2 bg-[#161821] border border-gray-800 text-sm font-bold rounded-full text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-40 transition-all shadow-lg"
                >
                    Previous
                </button>
                <div className="text-sm font-black text-gray-400 bg-[#161821] px-4 py-2 rounded-full border border-gray-800">
                    <span className="text-white">{currentPage}</span> / {totalPages}
                </div>
                <button 
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} 
                    disabled={currentPage === totalPages} 
                    className="px-6 py-2 bg-[#161821] border border-gray-800 text-sm font-bold rounded-full text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-40 transition-all shadow-lg"
                >
                    Next
                </button>
            </div>
        )}

      </div>
    </div>
  );
}
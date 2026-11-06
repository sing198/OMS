import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { jwtDecode } from 'jwt-decode';
import { useTranslation } from 'react-i18next';

export default function Navbar() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [cartCount, setCartCount] = useState(0);
  const [username, setUsername] = useState(null);
  const [role, setRole] = useState(null);
  const [navSearch, setNavSearch] = useState(searchParams.get('search') || '');

  const { t, i18n } = useTranslation();

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
    localStorage.setItem('language', lng);
  };

  const updateCartCount = () => {
    try {
      const cart = JSON.parse(localStorage.getItem('cart')) || [];
      setCartCount(cart.reduce((acc, item) => acc + (item.cartQuantity || 0), 0));
    } catch {
      setCartCount(0);
    }
  };

  useEffect(() => {
    setNavSearch(searchParams.get('search') || '');
  }, [searchParams]);

  useEffect(() => {
    updateCartCount();
    window.addEventListener('cartUpdated', updateCartCount);

    const token = localStorage.getItem('token');
    const user = localStorage.getItem('username');
    if (token) {
      try {
        const decoded = jwtDecode(token);
        if (decoded.exp && decoded.exp * 1000 < Date.now()) {
          localStorage.removeItem('token');
          localStorage.removeItem('username');
        } else {
          setRole(decoded.role?.toLowerCase());
          setUsername(user || 'Gamer');
        }
      } catch {
        localStorage.removeItem('token');
        localStorage.removeItem('username');
      }
    }

    return () => window.removeEventListener('cartUpdated', updateCartCount);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    setUsername(null);
    setRole(null);
    toast.success('ออกจากระบบเรียบร้อยแล้ว');
    navigate('/');
  };

  const handleNavSearch = (e) => {
    e.preventDefault();
    const q = navSearch.trim();
    if (q) {
      navigate(`/products?search=${encodeURIComponent(q)}`);
    } else {
      navigate('/products');
    }
  };

  const handlePlatformNav = (platform) => {
    if (platform) {
      navigate(`/products?platform=${encodeURIComponent(platform)}`);
    } else {
      navigate('/products');
    }
  };

  return (
    <header className="bg-[#12141c]/95 backdrop-blur-md border-b border-gray-800 sticky top-0 z-50">
      <div className="max-w-[1400px] mx-auto px-6 py-4 flex items-center justify-between gap-6">
        {/* Logo */}
        <div 
          onClick={() => navigate('/products')}
          className="text-2xl font-black tracking-tighter text-white flex-shrink-0 cursor-pointer select-none"
        >
          DGKeys<span className="text-rose-600">.</span>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleNavSearch} className="flex-1 max-w-xl relative hidden md:block">
          <input 
            type="text" 
            value={navSearch}
            onChange={(e) => setNavSearch(e.target.value)}
            placeholder={t('search_placeholder')} 
            className="w-full bg-[#0b0c10] border border-gray-700 focus:border-rose-500 text-white placeholder-gray-500 rounded-full py-2.5 pl-11 pr-4 text-sm font-medium focus:outline-none transition-colors"
          />
          <button type="submit" className="text-gray-500 hover:text-white absolute left-4 top-1/2 -translate-y-1/2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
          </button>
        </form>

        {/* Right Actions */}
        <div className="flex items-center gap-6">
          <div className="hidden sm:flex items-center gap-3 text-xs font-black text-gray-500 bg-[#0b0c10] px-3 py-1.5 rounded-full border border-gray-800">
            <button 
              type="button"
              onClick={() => changeLanguage('en')}
              className={`cursor-pointer hover:text-white transition-colors ${i18n.language === 'en' ? 'text-rose-500' : ''}`}
            >
              ENG
            </button>
            <span className="text-gray-700">|</span>
            <button 
              type="button"
              onClick={() => changeLanguage('th')}
              className={`cursor-pointer hover:text-white transition-colors ${i18n.language === 'th' ? 'text-rose-500' : ''}`}
            >
              TH
            </button>
          </div>
          <div className="flex items-center gap-4 border-l border-gray-800 pl-6">
            {username && (
              <div className="text-sm font-bold text-white hidden sm:flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-rose-500 to-rose-700 flex items-center justify-center text-xs font-black shadow-md">
                  {username.charAt(0).toUpperCase()}
                </div>
                <span className="max-w-[120px] truncate">{username}</span>
              </div>
            )}

            <button onClick={() => navigate('/cart')} className="relative text-gray-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-gray-800/60" title={t('my_cart')}>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
              {cartCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-rose-600 text-white text-[10px] font-black min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full border border-[#12141c]">
                  {cartCount}
                </span>
              )}
            </button>

            {username && (
              <button onClick={() => navigate('/my-orders')} className="text-gray-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-gray-800/60" title={t('my_orders')}>
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>
              </button>
            )}

            {(role === 'admin' || role === 'superadmin') && (
              <button 
                onClick={() => navigate('/admin')}
                className="text-xs font-black text-rose-400 hover:text-white hover:bg-rose-600 transition-colors border border-rose-500/40 px-3 py-1.5 rounded-full uppercase tracking-wider"
              >
                Admin
              </button>
            )}  
            
            {username ? (
              <button onClick={handleLogout} className="text-sm font-bold text-gray-400 hover:text-rose-500 transition-colors">
                {t('logout')}
              </button>
            ) : (
              <button onClick={() => navigate('/')} className="text-sm font-bold bg-rose-600 hover:bg-rose-500 text-white px-4 py-1.5 rounded-full transition-colors">
                {t('login')}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Sub Navbar (Platforms & Quick Filters) */}
      <div className="max-w-[1400px] mx-auto px-6 py-2.5 flex gap-6 text-xs font-bold text-gray-400 border-t border-gray-800/80 overflow-x-auto">
        <button type="button" onClick={() => handlePlatformNav('')} className="hover:text-white cursor-pointer transition-colors uppercase">All Platforms</button>
        <button type="button" onClick={() => handlePlatformNav('Steam')} className="hover:text-white cursor-pointer transition-colors uppercase">Steam</button>
        <button type="button" onClick={() => handlePlatformNav('Epic')} className="hover:text-white cursor-pointer transition-colors uppercase">Epic Games</button>
        <button type="button" onClick={() => handlePlatformNav('Origin')} className="hover:text-white cursor-pointer transition-colors uppercase">EA / Origin</button>
        <button type="button" onClick={() => handlePlatformNav('Ubisoft')} className="hover:text-white cursor-pointer transition-colors uppercase">Ubisoft</button>
        <div className="flex-1"></div>
        <button type="button" onClick={() => navigate('/my-orders')} className="hover:text-emerald-400 text-emerald-500/90 cursor-pointer transition-colors flex items-center gap-1">
          <span>🔑</span> {t('my_orders')}
        </button>
      </div>
    </header>
  );
}
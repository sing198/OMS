import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { jwtDecode } from 'jwt-decode';


import { useTranslation } from 'react-i18next';


export default function Navbar() {
  const navigate = useNavigate();
  const [cartCount, setCartCount] = useState(0);
  const [username, setUsername] = useState(null);
  const [role, setRole] = useState(null);

  const { t, i18n } = useTranslation();

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
    localStorage.setItem('language', lng); // บันทึกค่าไว้เผื่อลูกค้ารีเฟรชหน้าเว็บ
  };

  // ฟังก์ชันคำนวณตัวเลขตะกร้า
  const updateCartCount = () => {
    const cart = JSON.parse(localStorage.getItem('cart')) || [];
    setCartCount(cart.reduce((acc, item) => acc + item.cartQuantity, 0));
  };

  useEffect(() => {
    updateCartCount();
    window.addEventListener('cartUpdated', updateCartCount);

    // 1. ดึงชื่อจาก LocalStorage โดยตรง
    const user = localStorage.getItem('username');
    if (user) {
      setUsername(user);
    }

    // 2. ดึง Role จาก Token (ถ้า token มี)
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const decoded = jwtDecode(token);
        // เช็คค่า role ที่นี่เลย ไม่ต้องรอ console.log
        setRole(decoded.role); 
      } catch (e) { 
        console.error("Token error:", e); 
      }
    }
    
    return () => window.removeEventListener('cartUpdated', updateCartCount);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    toast.success('ออกจากระบบเรียบร้อยแล้ว');
    navigate('/');
  };

  return (
    <header className="bg-[#12141c] border-b border-gray-800 sticky top-0 z-50">
      <div className="max-w-[1400px] mx-auto px-6 py-4 flex items-center justify-between gap-6">
        {/* Logo */}
        <div 
          onClick={() => navigate('/products')}
          className="text-2xl font-black tracking-tighter text-white flex-shrink-0 cursor-pointer"
        >
          DGKeys<span className="text-rose-600">.</span>
        </div>

        {/* Search Bar */}
        <div className="flex-1 max-w-xl relative hidden md:block">
          <input 
            type="text" 
            placeholder={t('search_placeholder')} 
            className="w-full bg-white text-gray-900 rounded-full py-2.5 pl-10 pr-4 text-sm font-medium focus:outline-none"
          />
          <svg className="w-4 h-4 text-gray-500 absolute left-4 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-6">
          <div className="hidden sm:flex items-center gap-4 text-sm font-bold text-gray-400">
            <span 
              onClick={() => changeLanguage('en')}
              className={`cursor-pointer hover:text-white ${i18n.language === 'en' ? 'text-white' : ''}`}
            >
              ENG
            </span>
            <span 
              onClick={() => changeLanguage('th')}
              className={`cursor-pointer hover:text-white ${i18n.language === 'th' ? 'text-white' : ''}`}
            >
              TH
            </span>
          </div>
          <div className="flex items-center gap-5 border-l border-gray-700 pl-6">
            {/*แสดงชื่อ Username*/}
            {username && (
              <div className="text-sm font-bold text-white flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-rose-600 flex items-center justify-center text-xs">
                  {username.charAt(0).toUpperCase()}
                </div>
                {username}
              </div>
            )}
            <button className="text-gray-400 hover:text-white transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg>
            </button>
            <button onClick={() => navigate('/cart')} className="relative text-gray-400 hover:text-white transition-colors" title="Cart">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-2 bg-rose-600 text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full border border-[#12141c]">
                  {cartCount}
                </span>
              )}
            </button>

            {/* My Orders Button */}
            {username && (
              <button onClick={() => navigate('/my-orders')} className="text-gray-400 hover:text-white transition-colors" title="My Orders">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>
              </button>
            )}

            {/* ปุ่ม Admin Dashboard - แสดงเฉพาะ admin หรือ superadmin */}
            {(role === 'admin' || role === 'superadmin') && (
              <button 
                onClick={() => navigate('/admin')} // 🟢 เปลี่ยน path ให้ตรงกับที่ตั้งไว้ใน Router
                className="text-sm font-bold text-rose-500 hover:text-white transition-colors border border-rose-500 px-3 py-1 rounded-full"
              >
                Admin
              </button>
            )}  
            
            <button onClick={handleLogout} className="text-sm font-bold text-gray-400 hover:text-rose-500 transition-colors">
              {t('logout')}
            </button>
          </div>
        </div>
      </div>

      {/* Sub Navbar (Categories) */}
      <div className="max-w-[1400px] mx-auto px-6 py-3 flex gap-8 text-[13px] font-bold text-gray-400 border-t border-gray-800 overflow-x-auto">
        <span className="hover:text-white cursor-pointer flex items-center gap-1">PC <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg></span>
        <span className="hover:text-white cursor-pointer flex items-center gap-1">PLAYSTATION <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg></span>
        <span className="hover:text-white cursor-pointer flex items-center gap-1">XBOX <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg></span>
        <div className="flex-1"></div>
        <span className="hover:text-white cursor-pointer"> {t('deals')}</span>
        <span className="hover:text-white cursor-pointer"> {t('latest_games')}</span>
      </div>
    </header>
  );
}
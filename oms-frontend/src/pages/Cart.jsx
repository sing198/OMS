import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import axios from 'axios';
import Navbar from './Navbar'; // 👉 อย่าลืม Import Navbar เข้ามาด้วยนะครับ
import { useTranslation } from 'react-i18next';

export default function Cart() {
  const [cartItems, setCartItems] = useState([]);
  const navigate = useNavigate();

  const { t, i18n } = useTranslation();

  const changeLanguage = (lng) => {
      i18n.changeLanguage(lng);
      localStorage.setItem('language', lng); // บันทึกค่าไว้เผื่อลูกค้ารีเฟรชหน้าเว็บ
  };

  useEffect(() => {
    const fetchAndVerifyCart = async () => {
      try {
        const localCart = JSON.parse(localStorage.getItem('cart')) || [];
        if (localCart.length === 0) {
          setCartItems([]);
          return;
        }

        const validCart = [];
        const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080';

        // 💡 ดึงข้อมูลทีละเกมจาก API ย่อย เพราะ /products หลักติด Pagination ไปแล้ว
        await Promise.all(localCart.map(async (item) => {
          try {
            const res = await axios.get(`${baseUrl}/products/${item.id}`);
            const productInDb = res.data;

            if (productInDb && productInDb.is_active && productInDb.stock_quantity > 0) {
              validCart.push({ 
                ...item, 
                price: productInDb.price, 
                stock_quantity: productInDb.stock_quantity,
                discount_percent: productInDb.discount_percent,
                image_url: productInDb.image_url,
                name: productInDb.name,
                platform: productInDb.platform
              });
            } else if (productInDb.stock_quantity <= 0 || !productInDb.is_active) {
               toast.error(`เกม ${item.name} หมดสต็อกหรือเลิกขายแล้ว ระบบนำออกจากตะกร้าอัตโนมัติ`);
            }
          } catch (err) {
            console.error(`ไม่พบข้อมูลเกม ID ${item.id}`);
          }
        }));

        localStorage.setItem('cart', JSON.stringify(validCart));
        setCartItems(validCart);
        // อัปเดต Navbar ทันทีตอนโหลดเสร็จ
        window.dispatchEvent(new Event('cartUpdated')); 
      } catch (error) {
        console.error("Error fetching cart data:", error);
      }
    };

    fetchAndVerifyCart();
  }, []);

  const updateCart = (newCart) => {
    setCartItems(newCart);
    localStorage.setItem('cart', JSON.stringify(newCart));
    window.dispatchEvent(new Event('cartUpdated')); // 👉 สั่ง Navbar ให้อัปเดตตัวเลข
  };

  const removeFromCart = (productId) => {
    const newCart = cartItems.filter(item => item.id !== productId);
    updateCart(newCart);
    toast.success('ลบออกจากตะกร้าแล้ว');
  };

  const changeQuantity = (productId, delta) => {
    const newCart = cartItems.map(item => {
      if (item.id === productId) {
        const newQuantity = item.cartQuantity + delta;
        if (newQuantity >= 1 && newQuantity <= item.stock_quantity) {
          return { ...item, cartQuantity: newQuantity };
        } else if (newQuantity > item.stock_quantity) {
          toast.error(`เกมนี้เหลือสต็อกแค่ ${item.stock_quantity} คีย์`);
        }
      }
      return item;
    });
    updateCart(newCart);
  };

  const clearCart = () => {
    localStorage.removeItem('cart');
    localStorage.removeItem('checkout_items');
    setCartItems([]);
    window.dispatchEvent(new Event('cartUpdated'));
    toast.success('ล้างตะกร้าเรียบร้อยแล้ว');
  };

  const handleCheckout = () => {
    localStorage.setItem('checkout_items', JSON.stringify(cartItems));
    navigate('/checkout');
  };

  const totalItems = cartItems.reduce((sum, item) => sum + item.cartQuantity, 0);
  
  // 👉 แก้ไข: คำนวณราคาสุทธิที่หักส่วนลดแล้วให้ถูกต้อง
  const totalPrice = cartItems.reduce((sum, item) => {
    const discount = item.discount_percent || 0;
    const currentPrice = item.price - (item.price * discount / 100);
    return sum + (currentPrice * item.cartQuantity);
  }, 0);

  return (
    <div className="min-h-screen bg-[#0b0c10] font-sans text-gray-200 flex flex-col">
      
      {/* 🟢 นำ Navbar มาใช้ให้เป็นมาตรฐานเดียวกัน */}
      <Navbar />
      
      <div className="w-full max-w-4xl mx-auto px-6 py-10 flex-1 flex flex-col">
        
        {/* Header */}
        <div className="flex justify-between items-end mb-8 border-b border-gray-800 pb-4">
          <h1 className="text-3xl font-black text-white uppercase tracking-tight">
            {t('my_cart')} <span className="text-lg font-medium text-gray-500 lowercase tracking-normal ml-2">{totalItems} {t('item')}</span>
          </h1>
          {cartItems.length > 0 && (
            <button 
              onClick={clearCart}
              className="text-sm font-bold text-gray-500 hover:text-rose-500 transition-colors"
            >
                {t('clear_cart')}
            </button>
          )}
        </div>

        {cartItems.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500 mt-10">
            <svg className="w-24 h-24 mb-6 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
            <p className="text-2xl font-bold mb-6 text-gray-400">Your cart is empty</p>
            <button 
              onClick={() => navigate('/products')}
              className="bg-white text-black px-8 py-3 rounded-full font-bold hover:bg-gray-200 transition-colors shadow-lg"
            >
              CONTINUE SHOPPING
            </button>
          </div>
        ) : (
          <div className="flex flex-col flex-1">
            
            {/* รายการสินค้าในตะกร้า */}
            <div className="space-y-4 mb-8">
              {cartItems.map((item) => {
                const discount = item.discount_percent || 0;
                const currentPrice = item.price - (item.price * discount / 100);

                return (
                  <div key={item.id} className="bg-[#161821] p-4 rounded-2xl flex flex-col sm:flex-row gap-6 border border-gray-800 hover:border-gray-600 transition-colors relative group">
                    
                    {/* รูปภาพแนวตั้ง (Portrait) */}
                    <div 
                      onClick={() => navigate(`/product/${item.id}`)}
                      className="w-24 sm:w-28 aspect-[3/4] flex-shrink-0 bg-gray-900 rounded-xl overflow-hidden cursor-pointer"
                    >
                      <img 
                        src={item.image_url || 'https://via.placeholder.com/300x400/1e293b/94a3b8'} 
                        alt={item.name} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    </div>

                    <div className="flex flex-col flex-1 justify-center py-1">
                      <div>
                        {/* ชื่อเกม & ป้ายลดราคา */}
                        <div className="flex justify-between items-start gap-4">
                          <h3 
                            onClick={() => navigate(`/product/${item.id}`)}
                            className="font-bold text-lg md:text-xl text-white cursor-pointer hover:text-rose-400 transition-colors line-clamp-2"
                          >
                            {item.name}
                          </h3>
                          <button 
                            onClick={() => removeFromCart(item.id)}
                            className="text-gray-500 hover:text-rose-500 p-1 transition-colors flex-shrink-0"
                            title="Remove"
                          >
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                        
                        {/* แพลตฟอร์ม */}
                        <p className="text-[11px] text-gray-500 mt-1 uppercase font-bold">
                          {item.platform || 'STEAM KEY | GLOBAL'}
                        </p>

                        {/* ป้ายเตือนถ้าซื้อมากกว่า 1 ชิ้น */}
                        {item.cartQuantity > 1 && (
                          <div className="inline-block bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[10px] font-bold px-2.5 py-1 rounded mt-2">
                            {t('multiple_items_selected')}
                          </div>
                        )}
                      </div>

                      <div className="flex justify-between items-end mt-auto pt-4">
                        
                        {/* Control จำนวนสินค้า */}
                        <div className="flex items-center bg-[#0b0c10] border border-gray-800 rounded-lg overflow-hidden h-9">
                          <button 
                            onClick={() => changeQuantity(item.id, -1)}
                            className="w-9 h-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                          >
                            -
                          </button>
                          <span className="w-10 text-center text-sm font-bold text-white">
                            {item.cartQuantity}
                          </span>
                          <button 
                            onClick={() => changeQuantity(item.id, 1)}
                            className="w-9 h-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                          >
                            +
                          </button>
                        </div>

                        {/* ราคา */}
                        <div className="text-right">
                          {discount > 0 ? (
                            <div className="flex items-center gap-2 justify-end mb-0.5">
                              <span className="bg-rose-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded shadow-lg">
                                -{discount}%
                              </span>
                              <span className="text-gray-500 text-xs line-through">
                                ฿{item.price.toLocaleString(undefined, {minimumFractionDigits: 2})}
                              </span>
                            </div>
                          ) : (
                            <div className="h-4"></div>
                          )}
                          <span className="text-2xl font-black text-white">
                            ฿{currentPrice.toLocaleString(undefined, {minimumFractionDigits: 2})}
                          </span>
                        </div>

                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer สรุปยอดและปุ่ม Checkout */}
            <div className="mt-auto border-t border-gray-800 pt-8 pb-12 flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="flex flex-col w-full md:w-auto">
                <span className="font-bold text-sm tracking-widest text-gray-500 uppercase">{t('estimated_total')}</span>
                <span className="font-black text-4xl text-white">
                  ฿{totalPrice.toLocaleString(undefined, {minimumFractionDigits: 2})}
                </span>
              </div>
              <button 
                onClick={handleCheckout}
                className="w-full md:w-auto bg-emerald-500 hover:bg-emerald-400 text-black px-12 py-4 rounded-xl font-black text-lg transition-transform shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:shadow-[0_0_25px_rgba(16,185,129,0.4)] active:scale-95 flex items-center justify-center gap-2"
              >
                {t('secure_checkout')}
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            </div>
            
          </div>
        )}

      </div>
    </div>
  );
}
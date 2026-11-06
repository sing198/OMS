import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import Navbar from './Navbar';
import { useTranslation } from 'react-i18next';

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [game, setGame] = useState(null);
  const { t } = useTranslation();

  useEffect(() => {
    const fetchGame = async () => {
      try {
        const response = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:8080'}/products/${id}`);
        setGame(response.data);
      } catch {
        toast.error('ไม่พบข้อมูลเกมนี้');
        navigate('/products');
      }
    };
    
    fetchGame();
  }, [id, navigate]);

  const handleAddToCart = () => {
    let cart = JSON.parse(localStorage.getItem('cart')) || [];
    const existingItemIndex = cart.findIndex(item => item.id === game.id);
    
    if (existingItemIndex !== -1) {
      if (cart[existingItemIndex].cartQuantity >= game.stock_quantity) {
        toast.error(`เกม ${game.name} มีสต็อกไม่พอให้เพิ่มแล้ว!`);
        return false;
      }
      cart[existingItemIndex].cartQuantity += 1;
    } else {
      cart.push({ ...game, cartQuantity: 1 });
    }
    
    localStorage.setItem('cart', JSON.stringify(cart));
    window.dispatchEvent(new Event('cartUpdated'));
    toast.success('เพิ่มลงตะกร้าเรียบร้อยแล้ว!');
    return true;
  };

  const handleBuyNow = () => {
    handleAddToCart();
    // 🔧 ต้องเซ็ต checkout_items ก่อนไปหน้า Checkout ไม่งั้นมันจะ redirect กลับมาหน้า Cart
    const updatedCart = JSON.parse(localStorage.getItem('cart')) || [];
    const thisItem = updatedCart.find(item => item.id === game.id);
    if (thisItem) {
      localStorage.setItem('checkout_items', JSON.stringify([thisItem]));
    }
    navigate('/checkout');
  };

  if (!game) {
    return (
      <div className="min-h-screen bg-[#0b0c10] flex items-center justify-center">
         <p className="text-rose-500 font-bold text-xl animate-pulse">Loading...</p>
      </div>
    );
  }

  // คำนวณราคาสุทธิ (ป้องกันกรณี discount_percent ไม่มีค่า)
  const discount = game.discount_percent || 0;
  const currentPrice = game.price - (game.price * discount / 100);

  return (
    <div className="min-h-screen bg-[#0b0c10] font-sans text-gray-200 pb-20">
      
      {/* 🟢 TOP NAVBAR */}
      <Navbar />

      <div className="max-w-[1200px] mx-auto px-6 py-8">
        
        {/* Breadcrumb */}
        <div className="text-xs text-gray-500 mb-6 font-medium">
          <span className="cursor-pointer hover:text-white" onClick={() => navigate('/products')}>Home</span> 
          <span className="mx-2">/</span> PC <span className="mx-2">/</span> Games <span className="mx-2">/</span> <span className="text-gray-300">{game.name}</span>
        </div>

        {/* 🟢 TOP SECTION: Cover & Buy Box */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 mb-16">
          
          {/* ซ้าย: รูปปกเกม (แก้เป็น image_url) */}
          <div className="md:col-span-4 lg:col-span-4">
            <div className="w-full aspect-[3/4] bg-[#161821] rounded-xl overflow-hidden shadow-2xl border border-gray-800">
              <img src={game.image_url ? (game.image_url.startsWith('/') ? `${import.meta.env.VITE_API_URL || 'http://localhost:8080'}${game.image_url}` : game.image_url) : 'https://via.placeholder.com/400x600?text=No+Image'} alt={game.name} className="w-full h-full object-cover" />
            </div>
          </div>

          {/* ขวา: ข้อมูลการซื้อ */}
          <div className="md:col-span-8 lg:col-span-8 flex flex-col justify-center">
            <div className="flex justify-between items-start gap-4 mb-6">
              <h1 className="text-3xl md:text-4xl font-black text-white leading-tight">
                {game.name}
              </h1>
            </div>

            {/* ราคา */}
            <div className="mb-6">
              {discount > 0 && (
                <span className="text-gray-500 line-through text-sm font-medium">
                  ฿{Number(game.price).toLocaleString()}
                </span>
              )}
              <div className="flex items-center gap-4 mt-1">
                <span className="text-4xl font-black text-white">
                  ฿{Number(currentPrice).toLocaleString()}
                </span>
                {discount > 0 && (
                  <span className="bg-rose-600 text-white text-xs font-black px-3 py-1.5 rounded-md shadow-lg">
                    {discount}% OFF
                  </span>
                )}
              </div>
            </div>

            {/* สถานะสต็อก */}
            <div className="mb-6">
              <span className={`px-3 py-1.5 rounded-md text-sm font-bold ${game.stock_quantity > 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                {game.stock_quantity > 0 ? `✔ ${t('in_stock', { count: game.stock_quantity })}` : `❌ ${t('out_of_stock')}`}
              </span>
            </div>

            {/* ปุ่มกด */}
            <div className="flex gap-4 mb-8">
              <button 
                onClick={handleAddToCart} 
                disabled={game.stock_quantity <= 0}
                className="flex-1 py-3.5 bg-[#161821] border border-gray-700 hover:border-gray-500 hover:bg-gray-800 text-white rounded-lg font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {t('add_to_cart')}
              </button>
              <button 
                onClick={handleBuyNow} 
                disabled={game.stock_quantity <= 0}
                className="flex-1 py-3.5 bg-emerald-500 hover:bg-emerald-400 text-black rounded-lg font-black transition-all disabled:opacity-50 disabled:bg-gray-700"
              >
                {t('buy_now')} {'>'}
              </button>
            </div>

            {/* Meta Grid (ใส่ค่า Hardcode ไปก่อนเพราะ DB ยังไม่มี) */}
            <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-xs border-t border-gray-800 pt-6">
              <div className="flex justify-between"><span className="text-gray-500">{t('platform')}</span> <span className="text-gray-300 font-bold">{game.platform || 'Steam'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">{t('delivery')}</span> <span className="text-gray-300 font-bold">{t('instant_delivery')}</span></div>
            </div>

          </div>
        </div>

        {/* 🟢 DESCRIPTION */}
        <div className="border-t border-gray-800 pt-12">
          <div className="mb-12">
            <h2 className="text-2xl font-black text-white mb-6 uppercase">{t('about_game')}</h2>
            <div className="text-gray-400 space-y-6 text-sm leading-relaxed max-w-4xl whitespace-pre-line">
              {game.description || 'ไม่มีคำอธิบายสำหรับเกมนี้'}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
import { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Navbar from './Navbar'; // 👉 อย่าลืม Import Navbar
import { useTranslation } from 'react-i18next';

export default function Checkout() {
  const [cartItems] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('checkout_items'));
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  });
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [paymentMode, setPaymentMode] = useState('instant'); // 'instant' | 'later'
  const [appliedCoupon, setAppliedCoupon] = useState('');
  const navigate = useNavigate();

  const { t } = useTranslation();

  useEffect(() => {
    if (cartItems.length === 0) {
      toast.error('ไม่มีสินค้าที่เลือกชำระเงิน');
      navigate('/cart');
      return;
    }
  }, [navigate, cartItems]);

  const totalPrice = cartItems.reduce((sum, item) => {
    const priceAfterProductDiscount = item.price - (item.price * (item.discount_percent || 0) / 100);
    return sum + (priceAfterProductDiscount * item.cartQuantity);
  }, 0);

  const [couponCode, setCouponCode] = useState('');
  const [discountPercent, setDiscountPercent] = useState(0);

  const applyCoupon = async () => {
    try {
      const res = await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:8080'}/validate-coupon`, { code: couponCode });
      setDiscountPercent(res.data.discount);
      setAppliedCoupon(couponCode);
      toast.success(`ใช้โค้ดลดราคา ${res.data.discount}% สำเร็จ!`);
    } catch {
      setDiscountPercent(0);
      setAppliedCoupon('');
      toast.error('โค้ดไม่ถูกต้อง');
    }
  };

  const finalTotal = totalPrice - (totalPrice * (discountPercent / 100));

  const confirmPayment = async (e) => {
    e.preventDefault();
    if (submitting) return;
    
    if (!email) {
      toast.error('กรุณาระบุอีเมลเพื่อรับคีย์เกม');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      toast.error('กรุณาเข้าสู่ระบบก่อนชำระเงิน');
      navigate('/');
      return;
    }

    setSubmitting(true);
    const loadingToast = toast.loading(t('creating_order')); 
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080';

    try {
      const orderItems = cartItems.map(item => ({
        product_id: item.id,
        quantity: item.cartQuantity 
      }));

      const payload = {
        items: orderItems,
        coupon_code: appliedCoupon,
        delivery_email: email
      };

      const orderRes = await axios.post(
        `${baseUrl}/orders`, 
        payload, 
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const createdOrderId = orderRes.data.order_id;

      if (paymentMode === 'instant' && createdOrderId) {
        await axios.post(
          `${baseUrl}/orders/${createdOrderId}/pay`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }

      const currentCart = JSON.parse(localStorage.getItem('cart')) || [];
      const updatedCart = currentCart.filter(cartItem => 
        !cartItems.some(checkoutItem => checkoutItem.id === cartItem.id)
      );
      
      localStorage.setItem('cart', JSON.stringify(updatedCart)); 
      localStorage.removeItem('checkout_items'); 
      window.dispatchEvent(new Event('cartUpdated'));

      if (paymentMode === 'instant') {
        toast.success('ชำระเงินสำเร็จ! จัดส่งคีย์เกมดิจิทัลเรียบร้อยแล้ว 🔑', { id: loadingToast, duration: 5000 });
      } else {
        toast.success(t('order_pending_confirmation'), { id: loadingToast, duration: 5000 });
      }
      navigate('/my-orders'); 

    } catch (error) {
      toast.error('สร้างคำสั่งซื้อไม่สำเร็จ: ' + (error.response?.data?.error || error.message), { id: loadingToast });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0c10] font-sans text-gray-200 flex flex-col">
      
      {/* 🟢 เรียกใช้ Navbar ให้เหมือนทุกหน้า */}
      <Navbar />

      <div className="w-full max-w-5xl mx-auto px-6 py-10 flex-1">
        
        {/* Header */}
        <div className="flex justify-between items-end mb-8 border-b border-gray-800 pb-4">
          <h2 className="text-3xl font-black text-white uppercase tracking-tight">
            {t('secure_checkout')}
          </h2>
          <button 
            onClick={() => navigate('/cart')} 
            className="text-sm font-bold text-gray-500 hover:text-white transition-colors flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            {t('back_to_cart')}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* 🟢 คอลัมน์ซ้าย: ฟอร์มกรอกข้อมูลและ QR Code (พื้นที่ 7 ส่วน) */}
          <div className="lg:col-span-7 space-y-6">
            <form onSubmit={confirmPayment} className="bg-[#161821] rounded-2xl border border-gray-800 p-6 md:p-8">
              
              <h3 className="text-xl font-bold text-white mb-6">{t('payment_details')}</h3>

              {/* Email Input */}
              <div className="mb-6">
                <label className="block text-sm font-bold text-gray-400 mb-2">
                  {t('delivery_email')} <span className="text-rose-500">*</span>
                </label>
                <input 
                  type="email" 
                  required
                  placeholder="yourmail@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-[#0b0c10] border border-gray-700 rounded-xl text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                />
                <p className="text-xs text-gray-500 mt-2">{t('delivery_email_notice')}</p>
              </div>

              {/* Coupon Code */}
              <div className="mb-8">
                <label className="block text-sm font-bold text-gray-400 mb-2">{t('discount_code')}</label>
                <div className="flex gap-2">
                  <input 
                    value={couponCode}
                    onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setAppliedCoupon(''); setDiscountPercent(0); }}
                    placeholder="e.g. GAME10"
                    className="flex-1 px-4 py-3 bg-[#0b0c10] border border-gray-700 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                  />
                  <button 
                    type="button" 
                    onClick={applyCoupon} 
                    className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white font-bold rounded-xl transition-colors border border-gray-700"
                  >
                    {t('apply')}
                  </button>
                </div>
                {discountPercent > 0 && (
                  <p className="text-emerald-400 text-xs mt-2 font-bold flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                    Code applied: {discountPercent}% off
                  </p>
                )}
              </div>

              {/* Payment Method Selection */}
              <div className="mb-8">
                <label className="block text-sm font-bold text-gray-400 mb-3">{t('payment_method')}</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentMode('instant')}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      paymentMode === 'instant'
                        ? 'bg-emerald-500/10 border-emerald-500 text-white shadow-lg shadow-emerald-500/10'
                        : 'bg-[#0b0c10] border-gray-800 text-gray-400 hover:border-gray-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-black text-sm flex items-center gap-2">
                        ⚡ Instant Pay (PromptPay)
                      </span>
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-500 text-black">Instant Key</span>
                    </div>
                    <p className="text-xs text-gray-400">Receive digital activation keys immediately</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMode('later')}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      paymentMode === 'later'
                        ? 'bg-amber-500/10 border-amber-500 text-white shadow-lg shadow-amber-500/10'
                        : 'bg-[#0b0c10] border-gray-800 text-gray-400 hover:border-gray-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-black text-sm">🕒 Reserve & Pay Later</span>
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-amber-500/20 text-amber-400">30m Hold</span>
                    </div>
                    <p className="text-xs text-gray-400">Reserve stock now and complete payment from My Orders</p>
                  </button>
                </div>

                <p className="text-xs text-gray-400 mt-3 bg-[#0b0c10] p-3 rounded-xl border border-gray-800/80">
                  {paymentMode === 'instant' ? t('instant_payment_desc') : t('manual_payment_notice')}
                </p>
              </div>

              <button 
                type="submit"
                disabled={submitting || cartItems.length === 0}
                className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-black rounded-xl font-black text-lg transition-transform shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:shadow-[0_0_25px_rgba(16,185,129,0.4)] active:scale-95 flex items-center justify-center gap-2"
              >
                {submitting ? t('creating_order') : (paymentMode === 'instant' ? t('pay_now_instant') : t('place_order'))}
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </button>
            </form>
          </div>

          {/* 🟢 คอลัมน์ขวา: สรุปคำสั่งซื้อ (พื้นที่ 5 ส่วน) */}
          <div className="lg:col-span-5">
            <div className="bg-[#161821] rounded-2xl border border-gray-800 p-6 md:p-8 sticky top-24">
              <h3 className="text-lg font-bold text-white mb-6 border-b border-gray-800 pb-4 uppercase tracking-wider">{t('order_summary')}</h3>
                
              <ul className="space-y-4 mb-6">
                {cartItems.map(item => {
                  const pricePerItemAfterDiscount = item.price - (item.price * (item.discount_percent || 0) / 100);
                  const itemTotal = (pricePerItemAfterDiscount * item.cartQuantity) * (1 - discountPercent / 100);
                
                  return (
                    <li key={item.id} className="flex gap-4 items-center">
                      <div className="w-12 h-16 bg-gray-900 rounded-md overflow-hidden flex-shrink-0 border border-gray-800">
                        <img src={item.image_url ? (item.image_url.startsWith('/') ? `${import.meta.env.VITE_API_URL || 'http://localhost:8080'}${item.image_url}` : item.image_url) : 'https://via.placeholder.com/150x200'} alt={item.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex flex-col flex-1 truncate">
                        <span className="text-gray-200 font-bold text-sm truncate">{item.name}</span>
                        <span className="text-gray-500 text-xs mt-1">
                          {item.cartQuantity} x ฿{pricePerItemAfterDiscount.toLocaleString(undefined, {minimumFractionDigits: 2})}
                        </span>
                      </div>
                      <span className="text-white font-black text-sm whitespace-nowrap">
                        ฿{itemTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}
                      </span>
                    </li>
                  );
                })}
              </ul>

              <div className="border-t border-gray-800 pt-4 space-y-3 mb-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500 font-medium">{t('subtotal')}</span>
                  <span className="text-white font-bold">฿{totalPrice.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                </div>
                
                {discountPercent > 0 && (
                  <div className="flex justify-between items-center text-sm text-emerald-400">
                    <span className="font-bold">Discount ({discountPercent}%)</span>
                    <span className="font-bold">-฿{(totalPrice - finalTotal).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                  </div>
                )}
              </div>
                
              <div className="border-t border-gray-800 pt-4 flex justify-between items-center mt-2">
                <span className="text-gray-400 font-bold uppercase tracking-widest text-sm">{t('total')}</span>
                <span className="text-3xl font-black text-white">
                  ฿{finalTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}
                </span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Navbar from './Navbar';
import { useTranslation } from 'react-i18next';

export default function MyOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingOrderId, setProcessingOrderId] = useState(null);
  const navigate = useNavigate();
  const { t } = useTranslation();
  
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 10;
  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080';

  const fetchMyOrders = useCallback(async (token, page) => {
    try {
      const response = await axios.get(`${baseUrl}/orders?page=${page}&limit=${itemsPerPage}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setOrders(response.data.data || []);
      setTotalPages(response.data.meta?.total_pages || 1);
      setLoading(false);
    } catch {
      toast.error('ไม่สามารถดึงข้อมูลประวัติการสั่งซื้อได้');
      setLoading(false);
    }
  }, [baseUrl]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      toast.error('กรุณาเข้าสู่ระบบก่อน');
      navigate('/');
      return;
    }
    fetchMyOrders(token, currentPage);
  }, [currentPage, navigate, fetchMyOrders]);

  const handlePayNow = async (orderId) => {
    const token = localStorage.getItem('token');
    setProcessingOrderId(orderId);
    const toastId = toast.loading('กำลังยืนยันการชำระเงินและออกคีย์เกม...');
    try {
      await axios.post(`${baseUrl}/orders/${orderId}/pay`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('ชำระเงินสำเร็จ! รับคีย์เกมดิจิทัลด้านล่างได้เลย 🔑', { id: toastId });
      fetchMyOrders(token, currentPage);
    } catch (error) {
      toast.error('ชำระเงินไม่สำเร็จ: ' + (error.response?.data?.error || error.message), { id: toastId });
    } finally {
      setProcessingOrderId(null);
    }
  };

  const handleCancelOrder = async (orderId) => {
    if (!window.confirm(`คุณต้องการยกเลิกคำสั่งซื้อ #${orderId} และคืนสต็อกสินค้าใช่หรือไม่?`)) return;
    const token = localStorage.getItem('token');
    setProcessingOrderId(orderId);
    const toastId = toast.loading('กำลังยกเลิกคำสั่งซื้อ...');
    try {
      await axios.post(`${baseUrl}/orders/${orderId}/cancel`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('ยกเลิกคำสั่งซื้อและคืนสต็อกเรียบร้อยแล้ว', { id: toastId });
      fetchMyOrders(token, currentPage);
    } catch (error) {
      toast.error('ยกเลิกไม่สำเร็จ: ' + (error.response?.data?.error || error.message), { id: toastId });
    } finally {
      setProcessingOrderId(null);
    }
  };

  const copyKey = (key) => {
    navigator.clipboard.writeText(key);
    toast.success(`${t('copied')} (${key})`);
  };

  const getStatusColor = (status) => {
    switch(status?.toLowerCase()) {
      case 'paid':
      case 'delivered':
      case 'shipped':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'pending': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'cancelled': return 'bg-rose-500/10 text-rose-500 border-rose-500/20';
      default: return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0c10] font-sans text-gray-200">
      <Navbar />

      <div className="max-w-[1000px] mx-auto px-6 py-12">
        <h2 className="text-3xl font-black text-white uppercase tracking-tight mb-8">{t('my_orders')}</h2>

        <div className="space-y-6">
          {loading ? (
            <div className="text-center py-20 text-gray-500 font-bold">Loading your orders...</div>
          ) : orders.length === 0 ? (
            <div className="text-center py-20 bg-[#161821] rounded-2xl border border-gray-800">
              <p className="text-gray-500 font-bold mb-4">You have no order history yet.</p>
              <button onClick={() => navigate('/products')} className="px-6 py-2 bg-rose-600 hover:bg-rose-500 rounded-full font-bold text-white transition-colors">Start Shopping</button>
            </div>
          ) : (
            orders.map(order => {
              const isPending = order.status?.toLowerCase() === 'pending';
              const isPaidOrDelivered = ['paid', 'shipped', 'delivered'].includes(order.status?.toLowerCase());

              return (
                <div key={order.id} className="bg-[#161821] rounded-2xl border border-gray-800 overflow-hidden shadow-lg transition-all">
                  
                  <div className="bg-[#12141c] p-4 sm:px-6 sm:py-4 border-b border-gray-800 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">Order</span>
                        <h3 className="font-black text-white text-lg">#{order.id}</h3>
                        <span className={`inline-block px-3 py-0.5 rounded-full text-[10px] font-black border uppercase ${getStatusColor(order.status)}`}>
                          {order.status}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500 font-bold block mt-1">
                        Date: {new Date(order.created_at).toLocaleString()} {order.delivery_email ? `• Email: ${order.delivery_email}` : ''}
                      </span>
                    </div>
                    <div className="flex flex-col sm:items-end gap-2">
                      <div>
                        <span className="text-xs text-gray-500 font-bold uppercase tracking-wider mr-2">Total:</span>
                        <span className="font-black text-cyan-400 text-xl">฿{(order.total_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>

                      {isPending && (
                        <div className="flex gap-2 mt-1">
                          <button
                            onClick={() => handlePayNow(order.id)}
                            disabled={processingOrderId === order.id}
                            className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black rounded-lg transition-colors disabled:opacity-50"
                          >
                            ⚡ {t('pay_now')}
                          </button>
                          <button
                            onClick={() => handleCancelOrder(order.id)}
                            disabled={processingOrderId === order.id}
                            className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/20 text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
                          >
                            {t('cancel_order')}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="p-4 sm:p-6 space-y-4">
                    {(order.items || order.Items)?.map((item, idx) => {
                      const imgUrl = item.product?.image_url
                        ? (item.product.image_url.startsWith('/') ? `${baseUrl}${item.product.image_url}` : item.product.image_url)
                        : 'https://via.placeholder.com/60';
                      const keys = item.game_keys ? item.game_keys.split(',').filter(Boolean) : [];

                      return (
                        <div key={idx} className="bg-[#0b0c10] p-4 rounded-xl border border-gray-800/70 space-y-3">
                          <div className="flex gap-4 items-center">
                            <img src={imgUrl} alt="Game cover" className="w-12 h-16 object-cover rounded shadow-md border border-gray-800" />
                            <div className="flex-1">
                              <h4 className="text-white font-bold text-sm sm:text-base line-clamp-1">{item.product?.name || `Product #${item.product_id}`}</h4>
                              <p className="text-gray-500 text-xs mt-1">Platform: <span className="text-gray-300 font-bold">{item.product?.platform || 'Steam'}</span></p>
                            </div>
                            <div className="text-right">
                              <p className="text-gray-400 text-xs font-bold mb-1">Qty: {item.quantity}</p>
                              <p className="text-white font-bold">฿{(item.price_at_time_of_purchase * item.quantity).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                            </div>
                          </div>

                          {/* Game Keys Box */}
                          {isPaidOrDelivered && keys.length > 0 && (
                            <div className="pt-3 border-t border-gray-800/80">
                              <p className="text-[11px] font-black uppercase tracking-wider text-emerald-400 mb-2 flex items-center gap-1.5">
                                <span>🔑</span> {t('activation_keys')}
                              </p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {keys.map((k, kIdx) => (
                                  <div key={kIdx} className="flex items-center justify-between bg-[#161821] border border-emerald-500/30 rounded-lg px-3 py-2">
                                    <code className="text-xs sm:text-sm font-mono font-bold text-emerald-300 tracking-wider select-all">{k}</code>
                                    <button
                                      type="button"
                                      onClick={() => copyKey(k)}
                                      className="text-[11px] font-bold bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-black px-2.5 py-1 rounded transition-colors ml-2"
                                    >
                                      {t('copy_key')}
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {isPending && (
                            <div className="pt-2 border-t border-gray-800/60 text-xs text-amber-400/90 flex items-center gap-2">
                              <span>⏳</span> {t('awaiting_payment_keys')}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                </div>
              );
            })
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex justify-between items-center mt-10">
            <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="px-5 py-2.5 bg-[#161821] border border-gray-800 text-sm font-bold rounded-xl text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-40 transition-all">
              Previous
            </button>
            <div className="text-sm font-black text-gray-400">
              Page <span className="text-white">{currentPage}</span> of {totalPages}
            </div>
            <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} className="px-5 py-2.5 bg-[#161821] border border-gray-800 text-sm font-bold rounded-xl text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-40 transition-all">
              Next
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

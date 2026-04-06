import { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Navbar from './Navbar';
import { useTranslation } from 'react-i18next';

export default function MyOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { t } = useTranslation();
  
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      toast.error('กรุณาเข้าสู่ระบบก่อน');
      navigate('/');
      return;
    }
    fetchMyOrders(token, currentPage);
  }, [currentPage, navigate]);

  const fetchMyOrders = async (token, page) => {
    try {
      // ใช้ endpoint สำหรับดึงออเดอร์ (ต้องใช้ limit/page)
      const response = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:8080'}/orders?page=${page}&limit=${itemsPerPage}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // เนื่องจาก /orders จะคืนค่าเป็นออเดอร์ของ user ปัจจุบันโดยอัตโนมัติ (ถ้าไม่ได้ใช้สิทธิ์ admin ดึงทั้งหมด)
      setOrders(response.data.data);
      setTotalPages(response.data.meta.total_pages);
      setLoading(false);
    } catch (error) {
      toast.error('ไม่สามารถดึงข้อมูลประวัติการสั่งซื้อได้');
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch(status?.toLowerCase()) {
      case 'paid': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'pending': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'cancelled': return 'bg-rose-500/10 text-rose-500 border-rose-500/20';
      default: return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0c10] font-sans text-gray-200">
      <Navbar />

      <div className="max-w-[1000px] mx-auto px-6 py-12">
        <h2 className="text-3xl font-black text-white uppercase tracking-tight mb-8">My Orders</h2>

        <div className="space-y-6">
          {loading ? (
            <div className="text-center py-20 text-gray-500 font-bold">Loading your orders...</div>
          ) : orders.length === 0 ? (
            <div className="text-center py-20 bg-[#161821] rounded-2xl border border-gray-800">
              <p className="text-gray-500 font-bold mb-4">You have no order history yet.</p>
              <button onClick={() => navigate('/products')} className="px-6 py-2 bg-rose-600 hover:bg-rose-500 rounded-full font-bold text-white transition-colors">Start Shopping</button>
            </div>
          ) : (
            orders.map(order => (
              <div key={order.id} className="bg-[#161821] rounded-2xl border border-gray-800 overflow-hidden shadow-lg transition-transform hover:-translate-y-1">
                
                <div className="bg-[#12141c] p-4 sm:px-6 sm:py-4 border-b border-gray-800 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                  <div>
                    <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">Order ID</span>
                    <h3 className="font-black text-white text-lg">#{order.id}</h3>
                    <span className="text-xs text-gray-500 font-bold block mt-1">Date: {new Date(order.created_at).toLocaleString()}</span>
                  </div>
                  <div className="text-left sm:text-right">
                    <span className="text-xs text-gray-500 font-bold uppercase tracking-wider block">Total Amount</span>
                    <span className="font-black text-cyan-400 text-xl block">฿{(order.total_price || 0).toLocaleString()}</span>
                    <span className={`inline-block px-3 py-1 rounded text-[10px] font-black border uppercase mt-1.5 ${getStatusColor(order.status)}`}>
                      {order.status}
                    </span>
                  </div>
                </div>

                <div className="p-4 sm:p-6 space-y-4">
                  {(order.items || order.Items)?.map((item, idx) => (
                    <div key={idx} className="flex gap-4 items-center bg-[#0b0c10] p-3 rounded-xl border border-gray-800/50">
                      <img src={item.product?.image_url || 'https://via.placeholder.com/60'} alt="Game cover" className="w-12 h-16 object-cover rounded shadow-md border border-gray-800" />
                      <div className="flex-1">
                        <h4 className="text-white font-bold text-sm sm:text-base line-clamp-1">{item.product?.name || `Product #${item.product_id}`}</h4>
                        <p className="text-gray-500 text-xs mt-1">Platform: {item.product?.platform || 'Steam'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-gray-400 text-xs font-bold mb-1">Qty: {item.quantity}</p>
                        <p className="text-white font-bold">฿{(item.price_at_time_of_purchase * item.quantity).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>

              </div>
            ))
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

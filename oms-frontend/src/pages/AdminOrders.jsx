import { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchOrders(currentPage);
  }, [currentPage]);

  const fetchOrders = async (page) => {
    const token = localStorage.getItem('token');
    try {
      const response = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:8080'}/orders?page=${page}&limit=${itemsPerPage}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setOrders(response.data.data);
      setTotalPages(response.data.meta.total_pages);
      setTotalItems(response.data.meta.total);
      setLoading(false);
    } catch (error) {
      toast.error('ไม่สามารถดึงข้อมูลคำสั่งซื้อได้');
      setLoading(false);
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      await axios.patch(`${import.meta.env.VITE_API_URL || 'http://localhost:8080'}/admin/orders/${id}/status`, { status: newStatus }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      toast.success('อัปเดตสถานะสำเร็จ');
      fetchOrders(currentPage);
    } catch (error) {
      toast.error('อัปเดตไม่สำเร็จ');
    }
  };

  const handleResendKey = (id) => toast.success(`ส่งคีย์ออเดอร์ #${id} ซ้ำเรียบร้อย`);

  const filteredOrders = orders.filter(o => 
    (o.id.toString().includes(searchTerm) || o.user_id.toString().includes(searchTerm)) &&
    (statusFilter === 'all' || o.status === statusFilter)
  );

  const totalRevenue = orders.reduce((sum, o) => sum + (o.total_price || 0), 0);
  const pendingCount = orders.filter(o => o.status === 'pending').length;

  return (
    <>
      <header className="mb-8">
        <h2 className="text-3xl font-black text-white uppercase tracking-tight mb-6">Order Management</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-[#161821] p-6 rounded-2xl border border-gray-800">
            <p className="text-gray-500 font-bold text-xs uppercase">Total Revenue (This Page)</p>
            <h3 className="text-2xl font-black text-cyan-400">฿{totalRevenue.toLocaleString()}</h3>
          </div>
          <div className="bg-[#161821] p-6 rounded-2xl border border-gray-800">
            <p className="text-gray-500 font-bold text-xs uppercase">Total Orders</p>
            <h3 className="text-2xl font-black text-white">{totalItems}</h3>
          </div>
          <div className="bg-[#161821] p-6 rounded-2xl border border-gray-800">
            <p className="text-gray-500 font-bold text-xs uppercase">Pending Orders</p>
            <h3 className="text-2xl font-black text-rose-500">{pendingCount}</h3>
          </div>
        </div>

        <div className="flex gap-4">
          <input type="text" placeholder="Search Order ID or User ID..." onChange={(e) => setSearchTerm(e.target.value)} className="flex-1 bg-[#161821] border border-gray-800 rounded-xl py-2 px-4 text-sm text-white" />
          <select onChange={(e) => setStatusFilter(e.target.value)} className="bg-[#161821] border border-gray-800 rounded-xl py-2 px-4 text-sm text-gray-300">
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </header>

      <div className="bg-[#161821] rounded-2xl border border-gray-800 overflow-hidden shadow-xl">
        <table className="w-full text-left">
          <thead className="bg-[#0b0c10] text-gray-500 text-xs uppercase tracking-widest">
            <tr>
              <th className="p-4">ID</th>
              <th className="p-4">User</th>
              <th className="p-4">Total</th>
              <th className="p-4 text-center">Status</th>
              <th className="p-4 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {loading ? (
                <tr><td colSpan="5" className="p-8 text-center text-gray-500">Loading...</td></tr>
            ) : filteredOrders.length === 0 ? (
                <tr><td colSpan="5" className="p-8 text-center text-gray-500">No orders found.</td></tr>
            ) : (
                filteredOrders.map(order => (
                <tr key={order.id} className="border-b border-gray-800 hover:bg-gray-800/30">
                    <td className="p-4 font-bold text-white">#{order.id}</td>
                    <td className="p-4 text-gray-300">User {order.user_id}</td>
                    <td className="p-4 font-bold text-cyan-400">฿{order.total_price.toLocaleString()}</td>
                    <td className="p-4 text-center">
                    <select value={order.status} onChange={(e) => handleStatusChange(order.id, e.target.value)} className={`border rounded px-2 py-1 text-xs font-bold uppercase ${
                        order.status === 'paid' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
                        order.status === 'pending' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 
                        order.status === 'cancelled' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' :
                        'bg-blue-500/10 text-blue-400 border-blue-500/20'
                    }`}>
                        <option value="pending" className="bg-[#0b0c10] text-gray-300">Pending</option>
                        <option value="paid" className="bg-[#0b0c10] text-gray-300">Paid</option>
                        <option value="shipped" className="bg-[#0b0c10] text-gray-300">Shipped</option>
                        <option value="delivered" className="bg-[#0b0c10] text-gray-300">Delivered</option>
                        <option value="cancelled" className="bg-[#0b0c10] text-gray-300">Cancelled</option>
                    </select>
                    </td>
                    <td className="p-4 flex justify-center gap-2">
                    <button onClick={() => { setSelectedOrder(order); setIsModalOpen(true); }} className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs font-bold transition-colors">View</button>
                    <button onClick={() => handleResendKey(order.id)} className="px-3 py-1 bg-rose-600 hover:bg-rose-500 rounded text-xs font-bold transition-colors">Resend Key</button>
                    </td>
                </tr>
                ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-between items-center mt-6 bg-[#161821] p-4 rounded-xl border border-gray-800">
          <span className="text-xs font-bold text-gray-500 uppercase">
            Total {totalItems} Orders
          </span>
          <div className="flex gap-2">
            <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="px-3 py-1.5 bg-[#0b0c10] border border-gray-800 text-sm font-bold rounded-lg text-gray-400 hover:text-white disabled:opacity-40 transition-all">
              Previous
            </button>
            <div className="flex items-center px-4 text-sm font-black text-white">
              Page {currentPage} of {totalPages}
            </div>
            <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} className="px-3 py-1.5 bg-[#0b0c10] border border-gray-800 text-sm font-bold rounded-lg text-gray-400 hover:text-white disabled:opacity-40 transition-all">
              Next
            </button>
          </div>
        </div>
      )}

      {isModalOpen && selectedOrder && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-[#161821] p-6 rounded-2xl w-full max-w-2xl border border-gray-800 flex flex-col max-h-[80vh]">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-black text-white">Order Details #{selectedOrder.id}</h3>
                <p className="text-gray-500 text-sm mt-1">User ID: {selectedOrder.user_id}</p>
                <p className="text-gray-400 text-sm mt-1">Delivery email: {selectedOrder.delivery_email || '—'}</p>
                <p className="text-gray-500 text-sm mt-1">Status: <span className="text-emerald-400 font-bold uppercase">{selectedOrder.status}</span></p>
              </div>
              <div className="text-right">
                <p className="text-gray-500 text-xs font-bold uppercase">Total Paid</p>
                <p className="text-cyan-400 font-black text-xl">฿{selectedOrder.total_price?.toLocaleString()}</p>
                {selectedOrder.coupon_used && (
                    <p className="text-rose-400 text-xs mt-1">Coupon: {selectedOrder.coupon_used}</p>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 mb-6 space-y-3 custom-scrollbar">
              {(selectedOrder.items || selectedOrder.Items)?.length > 0 ? (
                (selectedOrder.items || selectedOrder.Items).map((item, index) => (
                  <div key={index} className="flex flex-col sm:flex-row justify-between sm:items-center bg-[#0b0c10] p-4 rounded-xl border border-gray-800 gap-4">
                    <div>
                      <h4 className="text-white font-bold text-lg">
                        {item.product?.name || `Product ID: ${item.product_id}`}
                      </h4>
                      <p className="text-gray-500 text-xs mt-1">
                        Price: ฿{(item.price_at_time_of_purchase || 0).toLocaleString()} <span className="mx-2">|</span> Qty: {item.quantity || 1}
                      </p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="text-white font-black text-lg">
                        ฿{((item.price_at_time_of_purchase || 0) * (item.quantity || 1)).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 bg-[#0b0c10] rounded-xl border border-gray-800 border-dashed">
                  <p className="text-gray-500 font-bold">ไม่พบรายการสินค้าในออเดอร์นี้</p>
                </div>
              )}
            </div>

            <button onClick={() => setIsModalOpen(false)} className="w-full py-3 bg-gray-800 hover:bg-gray-700 transition-colors rounded-xl font-black text-white tracking-widest uppercase">
              CLOSE
            </button>
          </div>
        </div>
      )}
    </>
  );
}
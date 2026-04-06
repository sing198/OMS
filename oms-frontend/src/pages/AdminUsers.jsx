import { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // State สำหรับ Search & Filter และ Pagination (อิง Backend)
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const itemsPerPage = 10;

  // State สำหรับ Order History Modal
  const [selectedUserOrders, setSelectedUserOrders] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);

  const [currentAdminId, setCurrentAdminId] = useState(null);
  const [userRole, setUserRole] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      const payload = JSON.parse(atob(token.split('.')[1]));
      setCurrentAdminId(Number(payload.user_id || payload.id));
      setUserRole(payload.role);
    }
    fetchUsers(token, currentPage, searchTerm);
  }, [currentPage]); // เรียกใหม่เมื่อเปลี่ยนหน้า

  const fetchUsers = async (token, page, search) => {
    setLoading(true);
    try {
      const response = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:8080'}/admin/users?page=${page}&limit=${itemsPerPage}&search=${search}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const dataWithStatus = response.data.data.map(user => ({
        ...user,
        status: user.status || 'Active' 
      }));
      
      setUsers(dataWithStatus);
      setTotalPages(response.data.meta.total_pages);
      setTotalItems(response.data.meta.total);
      setLoading(false);
    } catch (error) {
      toast.error('ไม่สามารถดึงข้อมูลผู้ใช้ได้');
      setLoading(false);
    }
  };

  const handleToggleRole = async (id, currentRole) => {
    const nextRole = currentRole === 'admin' ? 'customer' : 'admin';
    if (!window.confirm(`คุณต้องการเปลี่ยนสิทธิ์ผู้ใช้นี้ให้เป็น "${nextRole}" ใช่หรือไม่?`)) return;

    const token = localStorage.getItem('token');
    const loadingToast = toast.loading('กำลังอัปเดตสิทธิ์...');

    try {
      await axios.put(`${import.meta.env.VITE_API_URL || 'http://localhost:8080'}/admin/users/${id}/role`, { role: nextRole }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('เปลี่ยนสิทธิ์ผู้ใช้เรียบร้อย', { id: loadingToast });
      setUsers(users.map(u => u.id === id ? { ...u, role: nextRole } : u));
    } catch (error) {
      toast.error('ทำรายการไม่สำเร็จ: ' + (error.response?.data?.error || error.message), { id: loadingToast });
    }
  };

  const handleToggleBan = async (id, currentStatus, name) => {
    const nextStatus = currentStatus === 'Banned' ? 'Active' : 'Banned';
    if (!window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการ ${nextStatus === 'Banned' ? 'ระงับการใช้งาน' : 'ปลดแบน'} คุณ "${name}"?`)) return;

    const token = localStorage.getItem('token');
    const loadingToast = toast.loading(nextStatus === 'Banned' ? 'กำลังดำเนินการแบน...' : 'กำลังปลดแบน...');

    try {
      await axios.put(`${import.meta.env.VITE_API_URL || 'http://localhost:8080'}/admin/users/${id}/status`, { status: nextStatus }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success(nextStatus === 'Banned' ? 'ระงับการใช้งานเรียบร้อยแล้ว' : 'ปลดแบนเรียบร้อยแล้ว', { id: loadingToast });
      setUsers(users.map(u => u.id === id ? { ...u, status: nextStatus } : u));
    } catch (error) {
      toast.error('ทำรายการไม่สำเร็จ: ' + (error.response?.data?.error || error.message), { id: loadingToast });
    }
  };

  const handleViewOrderHistory = async (userId) => {
    setModalLoading(true);
    setIsModalOpen(true);
    const token = localStorage.getItem('token');

    try {
      // ดึงออเดอร์ทั้งหมดของลูกค้ามา
      const response = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:8080'}/orders?limit=100`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const userOrders = response.data.data.filter(order => {
        const orderUserId = order.user_id || order.UserID || order.userId;
        return Number(orderUserId) === Number(userId);
      });
      
      setSelectedUserOrders(userOrders);
      setModalLoading(false);
    } catch (error) {
      toast.error('ไม่สามารถเรียกดูประวัติคำสั่งซื้อได้');
      setIsModalOpen(false);
      setModalLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchUsers(localStorage.getItem('token'), 1, searchTerm);
  };

  const filteredUsers = users.filter(user => {
    return roleFilter === 'all' ? true : user.role === roleFilter;
  });

  return (
    <>
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-8 border-b border-gray-800 pb-4 gap-4">
        <h2 className="text-3xl font-black text-white uppercase tracking-tight">User Management</h2>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <form onSubmit={handleSearchSubmit} className="relative">
            <input 
              type="text" 
              placeholder="Search by name or email..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-64 bg-[#161821] border border-gray-800 rounded-xl py-2 px-4 pl-10 text-sm text-white focus:outline-none focus:border-rose-500 transition-colors placeholder-gray-600"
            />
            <button type="submit" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600 hover:text-white">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            </button>
          </form>
          <select 
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="bg-[#161821] border border-gray-800 rounded-xl py-2 px-4 text-sm text-gray-300 focus:outline-none focus:border-rose-500 transition-colors cursor-pointer"
          >
            <option value="all">All Roles</option>
            <option value="admin">Admin</option>
            <option value="customer">Customer</option>
          </select>
        </div>
      </header>

      <div className="bg-[#161821] rounded-2xl border border-gray-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#0b0c10] text-gray-500 text-xs uppercase tracking-widest border-b border-gray-800">
                <th className="p-4 font-bold text-center w-16">ID</th>
                <th className="p-4 font-bold">Name</th>
                <th className="p-4 font-bold">Email</th>
                <th className="p-4 font-bold text-center">Role</th>
                <th className="p-4 font-bold text-center">Status</th>
                <th className="p-4 font-bold text-center">Actions</th>
                <th className="p-4 font-bold text-right">Joined Date</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {loading ? (
                <tr><td colSpan="7" className="p-8 text-center text-gray-500">Loading...</td></tr>
              ) : filteredUsers.length === 0 ? (
                <tr><td colSpan="7" className="p-8 text-center text-gray-500">No users found.</td></tr>
              ) : (
                filteredUsers.map(user => (
                  <tr key={user.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                    <td className="p-4 text-center text-gray-500 font-bold">{user.id}</td>
                    <td className="p-4 font-bold text-gray-200">{user.name}</td>
                    <td className="p-4 text-gray-400">{user.email}</td>
                    
                    <td className="p-4 text-center">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest 
                          ${user.role === 'superadmin' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' 
                            : user.role === 'admin' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' 
                            : 'bg-gray-800 text-gray-400'}`}>
                        {user.role}
                      </span>
                    </td>

                    <td className="p-4 text-center">
                      <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold ${user.status === 'Banned' ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                        {user.status === 'Banned' ? 'BANNED' : 'ACTIVE'}
                      </span>
                    </td>

                    <td className="p-4 text-center">
                      <div className="flex justify-center gap-2">
                        <button onClick={() => handleViewOrderHistory(user.id)} className="px-2 py-1.5 bg-[#0b0c10] border border-gray-800 hover:border-gray-600 text-gray-400 hover:text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1" title="View Orders">
                          👁️ Orders
                        </button>
                        
                        <button onClick={() => handleToggleRole(user.id, user.role)} disabled={Number(user.id) === currentAdminId || userRole !== 'superadmin'} className={`px-2 py-1.5 border rounded-lg text-xs font-bold transition-colors ${(Number(user.id) === currentAdminId || userRole !== 'superadmin') ? 'bg-gray-800/50 border-gray-800 text-gray-600 cursor-not-allowed' : 'bg-[#0b0c10] border-gray-800 hover:bg-amber-600/20 hover:text-amber-400 text-gray-400'}`}>
                          Role
                        </button>

                        <button onClick={() => handleToggleBan(user.id, user.status, user.name)} disabled={Number(user.id) === currentAdminId || (userRole !== 'superadmin' && user.role?.toLowerCase() === 'superadmin')} className={`px-2 py-1.5 border rounded-lg text-xs font-bold transition-colors ${(Number(user.id) === currentAdminId || (userRole !== 'superadmin' && user.role?.toLowerCase() === 'superadmin')) ? 'bg-gray-800/50 border-gray-800 text-gray-600 cursor-not-allowed' : user.status === 'Banned' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-black' : 'bg-rose-500/10 border-rose-500/20 text-rose-500 hover:bg-rose-600 hover:text-white'}`}>
                          {user.status === 'Banned' ? 'Unban' : 'Ban'}
                        </button>
                      </div>
                    </td>
                    
                    <td className="p-4 text-right text-gray-500 text-xs font-bold">
                    {user.created_at || user.CreatedAt ? new Date(user.created_at || user.CreatedAt).toLocaleDateString() : 'N/A'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-between items-center mt-6 bg-[#161821] p-4 rounded-xl border border-gray-800">
          <span className="text-xs font-bold text-gray-500 uppercase">
            Total {totalItems} Users
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

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#161821] border border-gray-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            <div className="p-6 border-b border-gray-800 flex justify-between items-center">
              <h3 className="text-xl font-black text-white uppercase tracking-tight">📄 Order History</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-white text-2xl font-bold transition-colors">&times;</button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-4 custom-scrollbar">
              {modalLoading ? (
                <p className="text-center text-gray-500 py-10">Loading orders...</p>
              ) : !selectedUserOrders || selectedUserOrders.length === 0 ? (
                <p className="text-center text-gray-500 py-10 font-bold">ผู้ใช้นี้ยังไม่มีประวัติการสั่งซื้อเกม</p>
              ) : (
                selectedUserOrders.map(order => (
                  <div key={order.id} className="bg-[#0b0c10] border border-gray-800 rounded-xl p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                    <div>
                      <span className="text-xs text-gray-500 font-bold uppercase tracking-wider block">Order ID</span>
                      <span className="font-bold text-white text-base">#{order.id}</span>
                      <span className="text-[10px] text-gray-500 font-bold block mt-1">Date: {new Date(order.created_at).toLocaleString()}</span>
                    </div>
                    <div className="text-left sm:text-right">
                      <span className="text-xs text-gray-500 font-bold uppercase tracking-wider block">Total Amount</span>
                      <span className="font-black text-cyan-400 text-lg block">฿{(order.total_price || 0).toLocaleString()}</span>
                      <span className="inline-block px-2 py-0.5 rounded text-[9px] font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mt-1 uppercase">
                        {order.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="p-4 border-t border-gray-800 bg-[#0b0c10] text-right">
              <button onClick={() => setIsModalOpen(false)} className="px-6 py-2 bg-gray-800 hover:bg-gray-700 text-white font-bold rounded-xl text-sm transition-colors">CLOSE</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
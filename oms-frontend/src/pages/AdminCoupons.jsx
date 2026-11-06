import { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

export default function AdminCoupons() {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    id: null,
    code: '',
    discount: ''
  });

  useEffect(() => {
    fetchCoupons();
  }, []);

  const fetchCoupons = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:8080'}/admin/coupons`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCoupons(response.data);
      setLoading(false);
    } catch {
      toast.error('ไม่สามารถดึงข้อมูลคูปองได้');
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleEditClick = (coupon) => {
    setIsEditing(true);
    setFormData({
      id: coupon.id,
      code: coupon.code,
      discount: coupon.discount
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setFormData({ id: null, code: '', discount: '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    const payload = {
      code: formData.code.toUpperCase(),
      discount: parseFloat(formData.discount)
    };

    const loadingToast = toast.loading(isEditing ? 'กำลังอัปเดตคูปอง...' : 'กำลังสร้างคูปอง...');

    try {
      if (isEditing) {
        await axios.put(`${import.meta.env.VITE_API_URL || 'http://localhost:8080'}/admin/coupons/${formData.id}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('อัปเดตคูปองสำเร็จ', { id: loadingToast });
      } else {
        await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:8080'}/admin/coupons`, payload, { 
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('สร้างคูปองสำเร็จ', { id: loadingToast });
      }
      
      fetchCoupons();
      handleCancelEdit();
    } catch (error) {
      toast.error('เกิดข้อผิดพลาด: ' + (error.response?.data?.error || error.message), { id: loadingToast });
    }
  };

  const handleDelete = async (id, code) => {
    if (!window.confirm(`คุณต้องการลบคูปอง "${code}" ใช่หรือไม่?`)) return;
    
    const token = localStorage.getItem('token');
    const loadingToast = toast.loading('กำลังลบคูปอง...');

    try {
      await axios.delete(`${import.meta.env.VITE_API_URL || 'http://localhost:8080'}/admin/coupons/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('ลบคูปองสำเร็จ', { id: loadingToast });
      fetchCoupons();
    } catch (error) {
      toast.error('ไม่สำเร็จ: ' + (error.response?.data?.error || error.message), { id: loadingToast });
    }
  };

  return (
    <>
      <header className="flex justify-between items-end mb-8 border-b border-gray-800 pb-4">
        <h2 className="text-3xl font-black text-white uppercase tracking-tight">Coupon Management</h2>
      </header>

      <div className="bg-[#161821] p-6 md:p-8 rounded-2xl border border-gray-800 mb-10 shadow-xl">
        <h3 className="text-lg font-bold text-white mb-6 uppercase tracking-wider flex items-center gap-2">
          {isEditing ? <span className="text-amber-500">✏️ Edit Coupon</span> : <span className="text-emerald-500">➕ Add New Coupon</span>}
        </h3>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          <div>
            <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wide">Coupon Code</label>
            <input type="text" name="code" value={formData.code} onChange={handleChange} required placeholder="e.g. SUMMER50" className="w-full px-4 py-3 bg-[#0b0c10] border border-gray-700 rounded-xl text-white focus:border-rose-500 outline-none uppercase" />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wide">Discount (%)</label>
            <input type="number" name="discount" value={formData.discount} onChange={handleChange} required min="0" max="100" step="0.1" className="w-full px-4 py-3 bg-[#0b0c10] border border-gray-700 rounded-xl text-white focus:border-rose-500 outline-none" />
          </div>

          <div className="md:col-span-2 flex gap-4 mt-2">
            <button type="submit" className={`flex-1 py-3.5 rounded-xl font-black text-white transition-all shadow-lg active:scale-95 ${isEditing ? 'bg-amber-600 hover:bg-amber-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}>
              {isEditing ? 'UPDATE COUPON' : 'CREATE COUPON'}
            </button>
            {isEditing && (
              <button type="button" onClick={handleCancelEdit} className="px-8 py-3.5 rounded-xl font-black text-gray-400 bg-gray-800 hover:bg-gray-700 transition-all">
                CANCEL
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="bg-[#161821] rounded-2xl border border-gray-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#0b0c10] text-gray-500 text-xs uppercase tracking-widest border-b border-gray-800">
                <th className="p-4 font-bold w-16 text-center">ID</th>
                <th className="p-4 font-bold">Code</th>
                <th className="p-4 font-bold text-center">Discount (%)</th>
                <th className="p-4 font-bold text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {loading ? (
                <tr><td colSpan="4" className="p-8 text-center text-gray-500">Loading...</td></tr>
              ) : coupons.length === 0 ? (
                <tr><td colSpan="4" className="p-8 text-center text-gray-500">No coupons found.</td></tr>
              ) : (
                coupons.map(coupon => (
                  <tr key={coupon.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                    <td className="p-4 text-center text-gray-500 font-bold">{coupon.id}</td>
                    <td className="p-4 font-bold text-white tracking-widest">{coupon.code}</td>
                    <td className="p-4 text-center">
                        <span className="font-bold text-rose-400">{coupon.discount}%</span>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex justify-center gap-2">
                        <button onClick={() => handleEditClick(coupon)} className="p-2 bg-gray-800 hover:bg-amber-600 hover:text-white text-gray-400 rounded-lg transition-colors">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" /></svg>
                        </button>
                        <button onClick={() => handleDelete(coupon.id, coupon.code)} className="p-2 bg-gray-800 hover:bg-rose-600 hover:text-white text-gray-400 rounded-lg transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

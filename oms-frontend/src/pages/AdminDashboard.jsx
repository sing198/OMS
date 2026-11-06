import { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

export default function AdminDashboard() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // State สำหรับฟอร์มเพิ่ม/แก้ไข
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    id: null,
    name: '',
    description: '',
    price: '',
    discount_percent: '',
    stock_quantity: '',
    image_url: '',
    platform: 'Steam'
  });
  const [uploadingImage, setUploadingImage] = useState(false);

  // ดึงข้อมูลสินค้าเมื่อเปิดหน้า
  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const token = localStorage.getItem('token'); // 🟢 ต้องดึง token มาด้วย
      
      // 🟢 เปลี่ยน URL เป็น /admin/products/all และแนบ headers
      const response = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:8080'}/admin/products/all`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setProducts(response.data);
      setLoading(false);
    } catch {
      toast.error('ไม่สามารถดึงข้อมูลสินค้าได้');
      setLoading(false);
    }
  };

  // จัดการการพิมพ์ในฟอร์ม
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // กดปุ่มแก้ไข (ดึงข้อมูลลงฟอร์ม)
  const handleEditClick = (product) => {
    setIsEditing(true);
    setFormData({
      id: product.id,
      name: product.name,
      description: product.description || '',
      price: product.price,
      discount_percent: product.discount_percent || 0,
      stock_quantity: product.stock_quantity,
      image_url: product.image_url || '',
      platform: product.platform || 'Steam'
    });
    window.scrollTo({ top: 0, behavior: 'smooth' }); // เลื่อนขึ้นไปบนสุด
  };

  // รีเซ็ตฟอร์ม
  const handleCancelEdit = () => {
    setIsEditing(false);
    setFormData({
      id: null, name: '', description: '', price: '', discount_percent: '', stock_quantity: '', image_url: '', platform: 'Steam'
    });
  };

  // อัปโหลดรูปภาพ
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formDataUpload = new FormData();
    formDataUpload.append('image', file);

    const token = localStorage.getItem('token');
    const toastId = toast.loading('กำลังอัปโหลดรูปภาพ...');
    setUploadingImage(true);

    try {
      const response = await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:8080'}/admin/upload`, formDataUpload, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${token}`
        }
      });
      setFormData(prev => ({ ...prev, image_url: response.data.url }));
      toast.success('อัปโหลดรูปภาพสำเร็จ', { id: toastId });
    } catch {
      toast.error('อัปโหลดรูปภาพไม่สำเร็จ', { id: toastId });
    } finally {
      setUploadingImage(false);
    }
  };

  // บันทึกข้อมูล (เพิ่มใหม่ หรือ อัปเดต)
  const handleSubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    
    // แปลงข้อมูลเป็นตัวเลขก่อนส่ง
    const payload = {
      ...formData,
      price: parseFloat(formData.price),
      discount_percent: parseInt(formData.discount_percent) || 0,
      stock_quantity: parseInt(formData.stock_quantity) || 0
    };

    const loadingToast = toast.loading(isEditing ? 'กำลังอัปเดตข้อมูล...' : 'กำลังเพิ่มสินค้า...');

    try {
      if (isEditing) {
        // อัปเดตสินค้า (PUT) - ส่งเป็น Object ธรรมดา
        await axios.put(`${import.meta.env.VITE_API_URL || 'http://localhost:8080'}/admin/products/${formData.id}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('อัปเดตสินค้าสำเร็จ', { id: loadingToast });
      } else {
        // เพิ่มสินค้า (POST)
        await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:8080'}/admin/products`, [payload], { 
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('เพิ่มสินค้าสำเร็จ', { id: loadingToast });
      }
      
      fetchProducts(); // โหลดตารางใหม่
      handleCancelEdit(); // ล้างฟอร์ม
    } catch (error) {
      toast.error('เกิดข้อผิดพลาด: ' + (error.response?.data?.error || error.message), { id: loadingToast });
    }
  };

  //ปิดการขายสินค้า
  const handleDeactivate = async (id, name) => {
    if (!window.confirm(`คุณต้องการปิดการขายเกม "${name}" ใช่หรือไม่?`)) return;
    
    const token = localStorage.getItem('token');
    const loadingToast = toast.loading('กำลังปิดการขาย...');

    try {
      await axios.patch(`${import.meta.env.VITE_API_URL || 'http://localhost:8080'}/admin/products/${id}/deactivate`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('ปิดการขายสำเร็จ', { id: loadingToast });
      fetchProducts(); // โหลดข้อมูลใหม่
    } catch (error) {
      toast.error('ไม่สำเร็จ: ' + (error.response?.data?.error || error.message), { id: loadingToast });
    }
  };

  // เปิดการขายสินค้า
  const handleActivate = async (id, name) => {
    if (!window.confirm(`คุณต้องการเปิดการขายเกม "${name}" อีกครั้งใช่หรือไม่?`)) return;
    
    const token = localStorage.getItem('token');
    const loadingToast = toast.loading('กำลังเปิดการขาย...');

    try {
      await axios.patch(`${import.meta.env.VITE_API_URL || 'http://localhost:8080'}/admin/products/${id}/activate`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('เปิดการขายสำเร็จ', { id: loadingToast });
      fetchProducts(); // โหลดข้อมูลใหม่
    } catch (error) {
      toast.error('ไม่สำเร็จ: ' + (error.response?.data?.error || error.message), { id: loadingToast });
    }
  };

  return (
    <>
      {/* 💡 เหลือเฉพาะเนื้อหา Product Management และตัวตาราง ฟังก์ชันเปลี่ยนหน้าจะอยู่ที่ AdminLayout แล้ว */}
      <header className="flex justify-between items-end mb-8 border-b border-gray-800 pb-4">
        <h2 className="text-3xl font-black text-white uppercase tracking-tight">Product Management</h2>
      </header>

      {/* 🟢 ฟอร์มจัดการสินค้า */}
      <div className="bg-[#161821] p-6 md:p-8 rounded-2xl border border-gray-800 mb-10 shadow-xl">
        <h3 className="text-lg font-bold text-white mb-6 uppercase tracking-wider flex items-center gap-2">
          {isEditing ? <span className="text-amber-500">✏️ Edit Product</span> : <span className="text-emerald-500">➕ Add New Product</span>}
        </h3>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wide">Game Name</label>
            <input type="text" name="name" value={formData.name} onChange={handleChange} required className="w-full px-4 py-3 bg-[#0b0c10] border border-gray-700 rounded-xl text-white focus:border-rose-500 outline-none" />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wide">Platform</label>
            <select name="platform" value={formData.platform} onChange={handleChange} className="w-full px-4 py-3 bg-[#0b0c10] border border-gray-700 rounded-xl text-white focus:border-rose-500 outline-none">
              <option value="Steam">Steam</option>
              <option value="Epic">Epic Games</option>
              <option value="Origin">EA App (Origin)</option>
              <option value="Ubisoft">Ubisoft Connect</option>
            </select>
          </div>

          <div className="md:col-span-3">
            <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wide">Description</label>
            <textarea name="description" value={formData.description} onChange={handleChange} rows="2" className="w-full px-4 py-3 bg-[#0b0c10] border border-gray-700 rounded-xl text-white focus:border-rose-500 outline-none"></textarea>
          </div>

          <div className="md:col-span-3">
            <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wide">Image URL or Upload</label>
            <div className="flex gap-4 items-center">
              <input type="text" name="image_url" value={formData.image_url} onChange={handleChange} placeholder="https://... or upload a file" className="flex-1 px-4 py-3 bg-[#0b0c10] border border-gray-700 rounded-xl text-white focus:border-rose-500 outline-none" />
              <label className="px-4 py-3 bg-gray-800 hover:bg-gray-700 text-white text-sm font-bold rounded-xl cursor-pointer transition-colors border border-gray-700 flex items-center justify-center">
                {uploadingImage ? 'Uploading...' : 'Browse File'}
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploadingImage} />
              </label>
            </div>
            {formData.image_url && (
              <div className="mt-3">
                <img src={formData.image_url.startsWith('/') ? `${import.meta.env.VITE_API_URL || 'http://localhost:8080'}${formData.image_url}` : formData.image_url} alt="Preview" className="h-20 w-auto rounded border border-gray-700 object-cover" />
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wide">Price (฿)</label>
            <input type="number" name="price" value={formData.price} onChange={handleChange} required min="0" step="0.01" className="w-full px-4 py-3 bg-[#0b0c10] border border-gray-700 rounded-xl text-white focus:border-rose-500 outline-none" />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wide">Discount (%)</label>
            <input type="number" name="discount_percent" value={formData.discount_percent} onChange={handleChange} min="0" max="100" className="w-full px-4 py-3 bg-[#0b0c10] border border-gray-700 rounded-xl text-white focus:border-rose-500 outline-none" />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wide">Stock Quantity</label>
            <input type="number" name="stock_quantity" value={formData.stock_quantity} onChange={handleChange} required min="0" className="w-full px-4 py-3 bg-[#0b0c10] border border-gray-700 rounded-xl text-white focus:border-rose-500 outline-none" />
          </div>

          <div className="md:col-span-3 flex gap-4 mt-2">
            <button type="submit" className={`flex-1 py-3.5 rounded-xl font-black text-white transition-all shadow-lg active:scale-95 ${isEditing ? 'bg-amber-600 hover:bg-amber-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}>
              {isEditing ? 'UPDATE PRODUCT' : 'ADD PRODUCT'}
            </button>
            {isEditing && (
              <button type="button" onClick={handleCancelEdit} className="px-8 py-3.5 rounded-xl font-black text-gray-400 bg-gray-800 hover:bg-gray-700 transition-all">
                CANCEL
              </button>
            )}
          </div>
        </form>
      </div>

      {/* 🟢 ตารางรายการสินค้า */}
      <div className="bg-[#161821] rounded-2xl border border-gray-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#0b0c10] text-gray-500 text-xs uppercase tracking-widest border-b border-gray-800">
                <th className="p-4 font-bold w-16 text-center">ID</th>
                <th className="p-4 font-bold">Product</th>
                <th className="p-4 font-bold text-right">Price</th>
                <th className="p-4 font-bold text-center">Stock</th>
                <th className="p-4 font-bold text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {loading ? (
                <tr><td colSpan="5" className="p-8 text-center text-gray-500">Loading...</td></tr>
              ) : products.length === 0 ? (
                <tr><td colSpan="5" className="p-8 text-center text-gray-500">No products found.</td></tr>
              ) : (
                products.map(product => (
                  <tr key={product.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                    <td className="p-4 text-center text-gray-500 font-bold">{product.id}</td>
                    <td className="p-4 flex items-center gap-4">
                      <img src={product.image_url ? (product.image_url.startsWith('/') ? `${import.meta.env.VITE_API_URL || 'http://localhost:8080'}${product.image_url}` : product.image_url) : 'https://via.placeholder.com/50'} alt={product.name} className="w-10 h-14 object-cover rounded border border-gray-700" />
                      <div>
                        <div className="font-bold text-white mb-1 line-clamp-1">{product.name}</div>
                        <div className="text-[10px] text-gray-500 uppercase font-bold">{product.platform || 'Steam'}</div>
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      {product.discount_percent > 0 && (
                        <div className="text-[10px] text-rose-400 font-bold mb-0.5">-{product.discount_percent}%</div>
                      )}
                      <span className="font-bold text-cyan-400">฿{product.price.toLocaleString()}</span>
                    </td>
                    <td className="p-4 text-center">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${product.stock_quantity > 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                        {product.stock_quantity}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex justify-center gap-2">
                        <button onClick={() => handleEditClick(product)} className="p-2 bg-gray-800 hover:bg-amber-600 hover:text-white text-gray-400 rounded-lg transition-colors">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" /></svg>
                        </button>
                        {product.is_active ? (
                          <button 
                            onClick={() => handleDeactivate(product.id, product.name)}
                            className="text-red-500 hover:text-red-700 font-bold"
                          >
                            ยกเลิกการขาย
                          </button>
                        ) : (
                          <button 
                            onClick={() => handleActivate(product.id, product.name)}
                            className="text-green-500 hover:text-green-700 font-bold"
                          >
                            เปิดขายใหม่
                          </button>
                        )}
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
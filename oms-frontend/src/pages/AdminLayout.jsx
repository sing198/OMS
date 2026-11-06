import { useState, useEffect } from 'react';
import { useNavigate, Outlet, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [userRole, setUserRole] = useState(null);

  // 🔒 เช็คความปลอดภัย (Role-based Access Control) ที่จุดศูนย์กลางจุดเดียว
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      toast.error('กรุณาเข้าสู่ระบบก่อน');
      navigate('/');
      return;
    }
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      setUserRole(payload.role?.toLowerCase());
      if (payload.role?.toLowerCase() !== 'admin' && payload.role?.toLowerCase() !== 'superadmin') {
        toast.error('⛔ คุณไม่มีสิทธิ์เข้าถึงหน้าผู้ดูแลระบบ!');
        navigate('/products');
        return;
      }
    } catch {
      navigate('/');
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    toast.success('ออกจากระบบแอดมิน');
    navigate('/');
  };

  // ฟังก์ชันช่วยเช็คว่าเมนูไหนกำลังทำงานอยู่ (Active) เพื่อไฮไลท์สีแดง
  const isActive = (path) => location.pathname === path;

  return (
    <div className="min-h-screen bg-[#0b0c10] font-sans text-gray-200 flex">
      
      {/* 🟢 SIDEBAR กลาง (เขียนแค่ที่นี่ที่เดียว) */}
      <aside className="w-64 bg-[#12141c] border-r border-gray-800 flex flex-col sticky top-0 h-screen hidden md:flex flex-shrink-0">
        <div className="p-6 border-b border-gray-800">
          <h1 className="text-2xl font-black tracking-tighter text-white" onClick={() => navigate('/products')} style={{ cursor: 'pointer' }}>
            DGKeys<span className="text-rose-600">.</span> <span className="text-xs text-rose-500 uppercase tracking-widest ml-1">Admin</span>
          </h1>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          {/* เมนู Products */}
          <button 
            onClick={() => navigate('/admin')} 
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-colors ${
              isActive('/admin') 
                ? 'bg-rose-600/10 text-rose-500 border border-rose-500/20' 
                : 'text-gray-400 hover:text-white hover:bg-gray-800 border border-transparent'
            }`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg>
            Products
          </button>
          
          {/* เมนู Orders */}
          <button 
            onClick={() => navigate('/admin/orders')} 
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-colors ${
              isActive('/admin/orders') 
                ? 'bg-rose-600/10 text-rose-500 border border-rose-500/20' 
                : 'text-gray-400 hover:text-white hover:bg-gray-800 border border-transparent'
            }`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>
            Orders
          </button>

          {/* เมนู Users */}
          <button 
            onClick={() => navigate('/admin/users')} 
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-colors ${
              isActive('/admin/users') 
                ? 'bg-rose-600/10 text-rose-500 border border-rose-500/20' 
                : 'text-gray-400 hover:text-white hover:bg-gray-800 border border-transparent'
            }`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>
            Users
          </button>

          {/* เมนู Coupons */}
          <button 
            onClick={() => navigate('/admin/coupons')} 
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-colors ${
              isActive('/admin/coupons') 
                ? 'bg-rose-600/10 text-rose-500 border border-rose-500/20' 
                : 'text-gray-400 hover:text-white hover:bg-gray-800 border border-transparent'
            }`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V5.905c0-.755-.726-1.294-1.453-1.096a60.114 60.114 0 01-15.797 2.101c-.727.198-1.453-.342-1.453 1.096v10.744c0 .755.726 1.294 1.453 1.096z" /></svg>
            Coupons
          </button>

          {/* เมนู System Logs */}
          {userRole === 'superadmin' && (
          <button 
            onClick={() => navigate('/admin/logs')} 
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-colors ${
              isActive('/admin/logs') 
                ? 'bg-rose-600/10 text-rose-500 border border-rose-500/20' 
                : 'text-gray-400 hover:text-white hover:bg-gray-800 border border-transparent'
            }`}
          >
            {/* ไอคอนรูปโล่ / ความปลอดภัย */}
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>
            System Logs
          </button>
          )}
        </nav>
        
        <div className="p-4 border-t border-gray-800">
          <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 px-4 py-3 text-gray-400 hover:text-rose-500 hover:bg-gray-800 rounded-xl font-bold transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" /></svg>
            Logout
          </button>
        </div>
      </aside>

      {/* 🟢 พื้นที่แสดงเนื้อหาของแต่ละหน้าที่จะสลับเปลี่ยนไปมา */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Mobile Top Navigation for Admin */}
        <div className="md:hidden bg-[#12141c] border-b border-gray-800 px-4 py-3 flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <h1 className="text-xl font-black tracking-tighter text-white cursor-pointer" onClick={() => navigate('/products')}>
              DGKeys<span className="text-rose-600">.</span> <span className="text-[10px] text-rose-500 uppercase tracking-widest ml-1">Admin</span>
            </h1>
            <button onClick={handleLogout} className="text-xs font-bold text-rose-400 border border-rose-500/30 px-3 py-1 rounded-lg">
              Logout
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar text-xs font-bold">
            <button onClick={() => navigate('/admin')} className={`px-3 py-1.5 rounded-lg whitespace-nowrap ${isActive('/admin') ? 'bg-rose-600 text-white' : 'bg-[#0b0c10] text-gray-400'}`}>Products</button>
            <button onClick={() => navigate('/admin/orders')} className={`px-3 py-1.5 rounded-lg whitespace-nowrap ${isActive('/admin/orders') ? 'bg-rose-600 text-white' : 'bg-[#0b0c10] text-gray-400'}`}>Orders</button>
            <button onClick={() => navigate('/admin/users')} className={`px-3 py-1.5 rounded-lg whitespace-nowrap ${isActive('/admin/users') ? 'bg-rose-600 text-white' : 'bg-[#0b0c10] text-gray-400'}`}>Users</button>
            <button onClick={() => navigate('/admin/coupons')} className={`px-3 py-1.5 rounded-lg whitespace-nowrap ${isActive('/admin/coupons') ? 'bg-rose-600 text-white' : 'bg-[#0b0c10] text-gray-400'}`}>Coupons</button>
            {userRole === 'superadmin' && (
              <button onClick={() => navigate('/admin/logs')} className={`px-3 py-1.5 rounded-lg whitespace-nowrap ${isActive('/admin/logs') ? 'bg-rose-600 text-white' : 'bg-[#0b0c10] text-gray-400'}`}>Logs</button>
            )}
          </div>
        </div>

        <main className="flex-1 p-6 md:p-10 overflow-y-auto">
          <Outlet /> 
        </main>
      </div>

    </div>
  );
}
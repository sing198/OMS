import { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    
    const loadingToast = toast.loading('กำลังเข้าสู่ระบบ...'); 

    try {
      const response = await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:8080'}/login`, {
        email: email,
        password: password
      });

      const token = response.data.token;
      localStorage.setItem('token', token);
      localStorage.setItem('username', response.data.name);
      
      toast.success('เข้าสู่ระบบสำเร็จ!', { id: loadingToast }); 

      // 👉 1. แกะ Token เพื่อดู role ของคนที่เพิ่งล็อกอิน
      const payload = JSON.parse(atob(token.split('.')[1]));
      
      // 👉 2. แยกทางเดิน (Routing) ตาม Role
      if (payload.role === 'admin' || payload.role === 'superadmin') {
        navigate('/admin'); // ถ้าเป็นแอดมิน ไปหน้า Dashboard
      } else {
        navigate('/products'); // ถ้าเป็นลูกค้าปกติ ไปหน้าซื้อเกม
      }
      
    } catch (error) {
      toast.error('เข้าสู่ระบบไม่สำเร็จ: ' + (error.response?.data?.error || error.message), { id: loadingToast });
    }
  };

  return (
    // 🟢 พื้นหลังหลักสีดำเข้ม
    <div className="min-h-screen flex items-center justify-center bg-[#0b0c10] font-sans text-gray-200 px-4 relative overflow-hidden">
      
      {/* เอฟเฟกต์แสง Background อ่อนๆ มุมจอ (ตกแต่งให้ดูเป็นแนวเกมเมอร์) */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-rose-600/10 blur-[120px] rounded-full pointer-events-none"></div>

      {/* 🟢 การ์ดฟอร์ม Login */}
      <div className="bg-[#161821] p-8 md:p-10 rounded-3xl shadow-2xl border border-gray-800 w-full max-w-md relative z-10">
        
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black tracking-tighter text-white mb-1">
            DGKeys<span className="text-rose-600">.</span>
          </h1>
          <p className="text-gray-500 text-sm font-bold tracking-widest uppercase">
            Store Login
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          {/* ช่องกรอกอีเมล */}
          <div>
            <label className="block text-sm font-bold text-gray-400 mb-2 uppercase tracking-wide">
              Email
            </label>
            <input 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
              placeholder="gamer@example.com"
              className="w-full px-4 py-3 bg-[#0b0c10] border border-gray-700 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-colors"
            />
          </div>

          {/* ช่องกรอกรหัสผ่าน */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-bold text-gray-400 uppercase tracking-wide">
                Password
              </label>
              <button
                type="button"
                onClick={() => setShowPassword(prev => !prev)}
                className="text-xs text-gray-400 font-bold hover:text-white transition-colors cursor-pointer"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            <input 
              type={showPassword ? 'text' : 'password'} 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
              placeholder="••••••••"
              className="w-full px-4 py-3 bg-[#0b0c10] border border-gray-700 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-colors"
            />
          </div>

          {/* ปุ่ม Login */}
          <button 
            type="submit" 
            className="w-full mt-4 bg-rose-600 hover:bg-rose-500 text-white py-4 px-4 rounded-xl font-black text-lg transition-transform shadow-[0_0_20px_rgba(225,29,72,0.2)] hover:shadow-[0_0_25px_rgba(225,29,72,0.4)] active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
          >
            SIGN IN
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </button>
        </form>

        {/* ปุ่มเข้าชมหน้าร้านโดยไม่ต้องล็อกอิน */}
        <div className="mt-4">
          <button
            type="button"
            onClick={() => navigate('/products')}
            className="w-full py-3 bg-[#0b0c10] hover:bg-gray-800/80 text-gray-300 hover:text-white border border-gray-800 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
          >
            🎮 Browse Store as Guest
          </button>
        </div>

        {/* สมัครสมาชิก */}
        <div className="mt-6 text-center text-sm text-gray-500 font-medium">
          Don't have an account?{' '}
          <span 
            onClick={() => navigate('/register')} 
            className="text-white font-bold hover:text-rose-400 transition-colors cursor-pointer"
          >
            Create one
          </span>
        </div>
      </div>
    </div>
  );
}
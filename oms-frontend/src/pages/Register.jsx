import { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function Register() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    
    // 1. เช็คว่ารหัสผ่าน 2 ช่องตรงกันไหม
    if (password !== confirmPassword) {
      toast.error('รหัสผ่านไม่ตรงกัน กรุณาตรวจสอบอีกครั้ง');
      return;
    }

    const loadingToast = toast.loading('กำลังสร้างบัญชี...'); 

    try {
      // 2. ยิง API ไปที่ระบบหลังบ้าน (แก้ URL ให้ตรงกับ Backend ของคุณ)
      await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:8080'}/register`, {
        name: username,
        email: email,
        password: password
      });

      toast.success('สมัครสมาชิกสำเร็จ! กรุณาเข้าสู่ระบบ', { id: loadingToast }); 
      
      // 3. ส่งกลับไปหน้า Login เมื่อสมัครเสร็จ
      navigate('/'); // หรือ navigate('/login') ขึ้นอยู่กับว่าหน้า Login ของคุณคือ URL ไหน
      
    } catch (error) {
      toast.error('สมัครสมาชิกไม่สำเร็จ: ' + (error.response?.data?.error || error.message), { id: loadingToast });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0b0c10] font-sans text-gray-200 px-4 relative overflow-hidden py-10">
      
      {/* เอฟเฟกต์แสง Background (ให้สอดคล้องกับหน้า Login) */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-emerald-600/10 blur-[120px] rounded-full pointer-events-none"></div>

      {/* การ์ดฟอร์ม Register */}
      <div className="bg-[#161821] p-8 md:p-10 rounded-3xl shadow-2xl border border-gray-800 w-full max-w-md relative z-10">
        
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black tracking-tighter text-white mb-1">
            DGKeys<span className="text-rose-600">.</span>
          </h1>
          <p className="text-gray-500 text-sm font-bold tracking-widest uppercase">
            Create Account
          </p>
        </div>

        <form onSubmit={handleRegister} className="space-y-5">
          {/* ชื่อผู้ใช้ (Username) */}
          <div>
            <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wide">
              Username
            </label>
            <input 
              type="text" 
              value={username} 
              onChange={(e) => setUsername(e.target.value)} 
              required 
              placeholder="e.g. ProGamer99"
              className="w-full px-4 py-3 bg-[#0b0c10] border border-gray-700 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
            />
          </div>

          {/* ช่องกรอกอีเมล */}
          <div>
            <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wide">
              Email
            </label>
            <input 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
              placeholder="gamer@example.com"
              className="w-full px-4 py-3 bg-[#0b0c10] border border-gray-700 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
            />
          </div>

          {/* ช่องกรอกรหัสผ่าน */}
          <div>
            <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wide">
              Password
            </label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
              placeholder="••••••••"
              className="w-full px-4 py-3 bg-[#0b0c10] border border-gray-700 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
            />
          </div>

          {/* ยืนยันรหัสผ่าน */}
          <div>
            <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wide">
              Confirm Password
            </label>
            <input 
              type="password" 
              value={confirmPassword} 
              onChange={(e) => setConfirmPassword(e.target.value)} 
              required 
              placeholder="••••••••"
              className="w-full px-4 py-3 bg-[#0b0c10] border border-gray-700 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
            />
          </div>

          {/* ปุ่ม Register */}
          <button 
            type="submit" 
            className="w-full mt-6 bg-emerald-600 hover:bg-emerald-500 text-white py-4 px-4 rounded-xl font-black text-lg transition-transform shadow-[0_0_20px_rgba(5,150,105,0.2)] hover:shadow-[0_0_25px_rgba(5,150,105,0.4)] active:scale-95 flex items-center justify-center gap-2"
          >
            SIGN UP
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </button>
        </form>

        {/* ลิงก์กลับไปหน้า Login */}
        <div className="mt-8 text-center text-sm text-gray-500 font-medium">
          Already have an account?{' '}
          <span 
            onClick={() => navigate('/')} // เปลี่ยนเส้นทางไปหน้า Login
            className="text-white font-bold hover:text-emerald-400 transition-colors cursor-pointer"
          >
            Sign in
          </span>
        </div>

      </div>
    </div>
  );
}
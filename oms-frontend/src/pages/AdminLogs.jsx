import { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

export default function AdminLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // State สำหรับ Search และ Pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:8080'}/admin/admin-logs`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLogs(response.data);
      setLoading(false);
    } catch (error) {
      toast.error('ไม่สามารถดึงประวัติการทำงานได้');
      setLoading(false);
    }
  };

  // กรองข้อมูลด้วยช่องค้นหา (หาจากชื่อแอดมิน หรือ Action)
  const filteredLogs = logs.filter(log => 
    (log.admin_name && log.admin_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (log.action && log.action.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // คำนวณ Pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredLogs.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);

  // ฟังก์ชันช่วยกำหนดสีป้าย Tag ตามประเภทของ Action
  const getActionBadge = (action) => {
    if (action.includes('BAN')) return 'bg-rose-500/10 text-rose-500 border-rose-500/20';
    if (action.includes('ROLE')) return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
    return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
  };

  return (
    <>
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-8 border-b border-gray-800 pb-4 gap-4">
        <div>
          <h2 className="text-3xl font-black text-white uppercase tracking-tight">System Logs</h2>
          <p className="text-gray-500 text-sm mt-1 font-bold">บันทึกประวัติการทำงานของแอดมินระบบ (Super Admin View)</p>
        </div>
        
        {/* ช่องค้นหา */}
        <div className="relative w-full sm:w-64">
          <input 
            type="text" 
            placeholder="Search by Admin or Action..." 
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            className="w-full bg-[#161821] border border-gray-800 rounded-xl py-2 px-4 pl-10 text-sm text-white focus:outline-none focus:border-rose-500 transition-colors placeholder-gray-600"
          />
          <svg className="w-4 h-4 text-gray-600 absolute left-3.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
        </div>
      </header>

      {/* ตารางแสดง Log */}
      <div className="bg-[#161821] rounded-2xl border border-gray-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#0b0c10] text-gray-500 text-xs uppercase tracking-widest border-b border-gray-800">
                <th className="p-4 font-bold text-center w-16">ID</th>
                <th className="p-4 font-bold">Date & Time</th>
                <th className="p-4 font-bold">Admin</th>
                <th className="p-4 font-bold text-center">Action</th>
                <th className="p-4 font-bold">Target ID</th>
                <th className="p-4 font-bold">Details</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {loading ? (
                <tr><td colSpan="6" className="p-8 text-center text-gray-500">Loading logs...</td></tr>
              ) : currentItems.length === 0 ? (
                <tr><td colSpan="6" className="p-8 text-center text-gray-500">No records found.</td></tr>
              ) : (
                currentItems.map(log => (
                  <tr key={log.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                    <td className="p-4 text-center text-gray-500 font-bold">#{log.id}</td>
                    <td className="p-4 text-gray-400 font-bold text-xs">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="p-4 font-bold text-white">
                      {log.admin_name} <span className="text-gray-600 text-[10px] ml-1">(ID: {log.admin_id})</span>
                    </td>
                    <td className="p-4 text-center">
                      <span className={`px-2.5 py-0.5 rounded border text-[10px] font-black uppercase tracking-widest ${getActionBadge(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="p-4 text-gray-300 font-bold text-center">
                      {log.target_id || '-'}
                    </td>
                    <td className="p-4 text-gray-400 text-xs font-medium">
                      {log.details}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center mt-6 bg-[#161821] p-4 rounded-xl border border-gray-800">
          <span className="text-xs font-bold text-gray-500 uppercase">
            Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredLogs.length)} of {filteredLogs.length} Entries
          </span>
          <div className="flex gap-2">
            <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="px-3 py-1.5 bg-[#0b0c10] border border-gray-800 text-sm font-bold rounded-lg text-gray-400 hover:text-white disabled:opacity-40 transition-all">Prev</button>
            <div className="flex items-center px-4 text-sm font-black text-white">{currentPage} / {totalPages}</div>
            <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} className="px-3 py-1.5 bg-[#0b0c10] border border-gray-800 text-sm font-bold rounded-lg text-gray-400 hover:text-white disabled:opacity-40 transition-all">Next</button>
          </div>
        </div>
      )}
    </>
  );
}
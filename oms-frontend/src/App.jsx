import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Login from './pages/Login';
import Products from './pages/Products'; // นำเข้าหน้า Products.jsx
import ProductDetail from "./pages/ProductDetail";
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import Register from "./pages/Register";
import MyOrders from './pages/MyOrders';

import AdminLayout from './pages/AdminLayout';
import AdminDashboard from './pages/AdminDashboard'; // หน้าสินค้า
import AdminOrders from './pages/AdminOrders';
import AdminUsers from './pages/AdminUsers';
import AdminLogs from './pages/AdminLogs';
import AdminCoupons from './pages/AdminCoupons';

function App() {
  return (
    <BrowserRouter>
    <Toaster position="top-right" reverseOrder={false} />
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/products" element={<Products />} />
        <Route path="/product/:id" element={<ProductDetail />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/register" element={<Register />} />
        <Route path="/my-orders" element={<MyOrders />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route path="" element={<AdminDashboard />} /> 
          <Route path="orders" element={<AdminOrders />} /> 
          <Route path="users" element={<AdminUsers />} />
          <Route path="logs" element={<AdminLogs />} />
          <Route path="coupons" element={<AdminCoupons />} />
        </Route>  
        
      </Routes>
    </BrowserRouter>
  );
}

export default App;
import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './components/AppLayout.jsx';
import Dashboard from './features/dashboard/index.jsx';
import Login from './features/auth/index.jsx';
import Products from './features/products/index.jsx';
import Pos from './features/pos/index.jsx';
import Stock from './features/stock/index.jsx';
import Purchases from './features/purchases/index.jsx';
import Customers from './features/customers/index.jsx';
import Cash from './features/cash/index.jsx';
import Expenses from './features/expenses/index.jsx';
import Accounting from './features/accounting/index.jsx';

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<AppLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="products" element={<Products />} />
        <Route path="pos" element={<Pos />} />
        <Route path="stock" element={<Stock />} />
        <Route path="purchases" element={<Purchases />} />
        <Route path="customers" element={<Customers />} />
        <Route path="cash" element={<Cash />} />
        <Route path="expenses" element={<Expenses />} />
        <Route path="accounting" element={<Accounting />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
import { BrowserRouter } from 'react-router-dom';
import AppRouter from './router.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <AppRouter />
    </BrowserRouter>
  );
}
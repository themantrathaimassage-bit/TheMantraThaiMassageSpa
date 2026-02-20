import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { SearchProvider } from './context/SearchContext'
import { CartProvider } from './context/CartContext'
import { AuthProvider } from './context/AuthContext'
import './styles/global.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <CartProvider>
        <SearchProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </SearchProvider>
      </CartProvider>
    </AuthProvider>
  </StrictMode>,
)

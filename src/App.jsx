import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import VenuePage from './pages/VenuePage'
import BookingPage from './pages/BookingPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<VenuePage />} />
      </Route>
      <Route path="/booking" element={<BookingPage />} />
    </Routes>
  )
}

export default App

import { Routes, Route, Link } from 'react-router-dom'
import Home from './pages/Home'
import Login from './pages/Login'
import Notices from './pages/Notices'

export default function App() {
  return (
    <div className="container py-3">
      <nav className="mb-3 d-flex gap-3">
        <Link to="/">대시보드</Link>
        <Link to="/login">로그인</Link>
        <Link to="/notices">공지</Link>
      </nav>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/notices" element={<Notices />} />
      </Routes>
    </div>
  )
}
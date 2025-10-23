import { useState } from 'react'
import axios from 'axios'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [result, setResult] = useState(null)

  const onSubmit = async (e) => {
    e.preventDefault()
    const res = await axios.post('/api/auth/login', { email, password })
    setResult(res.data)
  }

  return (
    <>
      <h2>로그인</h2>
      <form onSubmit={onSubmit} className="d-flex gap-2">
        <input className="form-control" placeholder="email" value={email} onChange={e=>setEmail(e.target.value)} />
        <input className="form-control" type="password" placeholder="password" value={password} onChange={e=>setPassword(e.target.value)} />
        <button className="btn btn-primary">Login</button>
      </form>
      {result && <pre className="mt-3">{JSON.stringify(result, null, 2)}</pre>}
    </>
  )
}

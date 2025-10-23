import { useEffect, useState } from 'react'
import axios from 'axios'

export default function Home() {
  const [health, setHealth] = useState('확인 중...')
  useEffect(() => {
    axios.get('/api/health').then(r => setHealth(r.data.data)).catch(() => setHealth('DOWN'))
  }, [])
  return (
    <>
      <h1>그룹웨어 대시보드</h1>
      <p>백엔드 상태: {health}</p>
    </>
  )
}

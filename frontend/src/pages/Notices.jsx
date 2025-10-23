import { useEffect, useState } from 'react'
import axios from 'axios'

export default function Notices() {
  const [list, setList] = useState([])
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')

  const load = () => axios.get('/api/notices').then(r => setList(r.data.data))
  useEffect(() => { load() }, [])

  const create = async (e) => {
    e.preventDefault()
    await axios.post('/api/notices', { title, content, category:'GENERAL', writerId:1 })
    setTitle(''); setContent(''); load()
  }

  return (
    <>
      <h2>공지</h2>
      <form onSubmit={create} className="mb-3 d-flex gap-2">
        <input className="form-control" placeholder="제목" value={title} onChange={e=>setTitle(e.target.value)} />
        <input className="form-control" placeholder="내용" value={content} onChange={e=>setContent(e.target.value)} />
        <button className="btn btn-success">등록</button>
      </form>

      <ul className="list-group">
        {list.map(n => (
          <li key={n.id} className="list-group-item">
            <strong>{n.title}</strong>
            <div className="text-muted small">{n.category}</div>
            <div>{n.content}</div>
          </li>
        ))}
      </ul>
    </>
  )
}

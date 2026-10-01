import { useEffect, useState } from 'react'
import { supabase } from './supabase'

type Doc = { id: string; title: string; owner_id: string; owner_email: string; updated_at: string }

export default function DocList({ userId }: { userId: string }) {
  const [docs, setDocs] = useState<Doc[]>([])
  const [error, setError] = useState('')

  async function load() {
    const { data, error } = await supabase
      .from('documents')
      .select('id, title, owner_id, owner_email, updated_at')
      .order('updated_at', { ascending: false })
    if (error) setError(error.message)
    else setDocs(data)
  }

  useEffect(() => {
    load()
  }, [])

  async function create() {
    const { data, error } = await supabase.from('documents').insert({}).select('id').single()
    if (error) setError(error.message)
    else location.hash = `#/doc/${data.id}`
  }

  async function remove(doc: Doc) {
    if (!confirm(`Delete "${doc.title}"?`)) return
    const { error } = await supabase.from('documents').delete().eq('id', doc.id)
    if (error) setError(error.message)
    else load()
  }

  return (
    <div className="doc-list">
      <button onClick={create}>+ New document</button>
      {error && <p className="error">{error}</p>}
      <ul>
        {docs.map((doc) => (
          <li key={doc.id}>
            <a href={`#/doc/${doc.id}`}>{doc.title}</a>
            <small>
              {doc.owner_email} · edited {new Date(doc.updated_at).toLocaleString()}
            </small>
            {doc.owner_id === userId && <button onClick={() => remove(doc)}>Delete</button>}
          </li>
        ))}
      </ul>
    </div>
  )
}

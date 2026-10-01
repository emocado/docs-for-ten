import { useEffect, useState } from 'react'
import { onValue, orderByChild, push, query, ref, set, update } from 'firebase/database'
import { db } from './firebase'

type Doc = { id: string; title: string; ownerId: string; ownerEmail: string; updatedAt: number }

export default function DocList({ userId, email }: { userId: string; email: string }) {
  const [docs, setDocs] = useState<Doc[]>([])
  const [error, setError] = useState('')

  useEffect(
    () =>
      onValue(
        query(ref(db, 'documents'), orderByChild('updatedAt')),
        (snap) => {
          const list: Doc[] = []
          snap.forEach((child) => {
            list.unshift({ id: child.key!, ...child.val() })
          })
          setDocs(list)
        },
        (err) => setError(err.message),
      ),
    [],
  )

  async function create() {
    const docRef = push(ref(db, 'documents'))
    await set(docRef, { title: 'Untitled document', ownerId: userId, ownerEmail: email, updatedAt: Date.now() })
    location.hash = `#/doc/${docRef.key}`
  }

  function remove(doc: Doc) {
    if (!confirm(`Delete "${doc.title}"?`)) return
    update(ref(db), { [`documents/${doc.id}`]: null, [`docContent/${doc.id}`]: null, [`updates/${doc.id}`]: null, [`awareness/${doc.id}`]: null }).catch((err) => setError(err.message))
  }

  return (
    <div className="doc-list">
      <button onClick={create}>+ New document</button>
      {error && <p className="error">{error}</p>}
      <ul>
        {docs.map((doc) => (
          <li key={doc.id}>
            <a href={`#/doc/${doc.id}`}>{String(doc.title)}</a>
            <small>
              {String(doc.ownerEmail)} · edited {new Date(doc.updatedAt).toLocaleString()}
            </small>
            {doc.ownerId === userId && <button onClick={() => remove(doc)}>Delete</button>}
          </li>
        ))}
      </ul>
    </div>
  )
}

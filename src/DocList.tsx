import { id } from '@instantdb/react'
import { db } from './db'

export default function DocList({ userId, email }: { userId: string; email: string }) {
  const { isLoading, error, data } = db.useQuery({ documents: { $: { order: { updatedAt: 'desc' } } } })

  async function create() {
    const docId = id()
    await db.transact(
      db.tx.documents[docId].create({ title: 'Untitled document', ownerId: userId, ownerEmail: email, updatedAt: Date.now() }),
    )
    location.hash = `#/doc/${docId}`
  }

  function remove(doc: { id: string; title: string }) {
    if (confirm(`Delete "${doc.title}"?`)) db.transact(db.tx.documents[doc.id].delete())
  }

  return (
    <div className="doc-list">
      <button onClick={create}>+ New document</button>
      {error && <p className="error">{error.message}</p>}
      {isLoading && <p>Loading…</p>}
      <ul>
        {data?.documents.map((doc) => (
          <li key={doc.id}>
            <a href={`#/doc/${doc.id}`}>{doc.title}</a>
            <small>
              {doc.ownerEmail} · edited {new Date(doc.updatedAt).toLocaleString()}
            </small>
            {doc.ownerId === userId && <button onClick={() => remove(doc)}>Delete</button>}
          </li>
        ))}
      </ul>
    </div>
  )
}

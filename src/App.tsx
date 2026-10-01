import { useEffect, useState } from 'react'
import { db } from './db'
import Auth from './Auth'
import DocList from './DocList'
import Editor from './Editor'

const docIdFromHash = () => location.hash.match(/^#\/doc\/(.+)$/)?.[1] ?? null

export default function App() {
  const { isLoading, user } = db.useAuth()
  const [docId, setDocId] = useState(docIdFromHash)

  useEffect(() => {
    const onHash = () => setDocId(docIdFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  if (isLoading) return null
  if (!user) return <Auth />
  const email = user.email ?? 'anonymous'

  return (
    <main>
      <nav>
        <a href="#" className="brand">Docs for Ten</a>
        <span>{email}</span>
        <button onClick={() => db.auth.signOut()}>Sign out</button>
      </nav>
      {docId ? <Editor key={docId} docId={docId} email={email} /> : <DocList userId={user.id} email={email} />}
    </main>
  )
}

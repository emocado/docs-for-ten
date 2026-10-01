import { Component, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import type { User } from 'firebase/auth'
import { auth } from './firebase'
import Auth from './Auth'
import DocList from './DocList'
import Editor from './Editor'

const docIdFromHash = () => location.hash.match(/^#\/doc\/(.+)$/)?.[1] ?? null

// Shows an error instead of a blank app if one bad record breaks rendering.
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  render() {
    return this.state.error ? <p className="error">Something went wrong: {String(this.state.error)}</p> : this.props.children
  }
}

export default function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined)
  const [docId, setDocId] = useState(docIdFromHash)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, setUser)
    const onHash = () => setDocId(docIdFromHash())
    window.addEventListener('hashchange', onHash)
    return () => {
      unsubscribe()
      window.removeEventListener('hashchange', onHash)
    }
  }, [])

  if (user === undefined) return null
  if (!user) return <Auth />
  const email = user.email ?? 'anonymous'

  return (
    <main>
      <nav>
        <a href="#" className="brand">Docs for Ten</a>
        <span>{email}</span>
        <button onClick={() => signOut(auth)}>Sign out</button>
      </nav>
      <ErrorBoundary key={docId}>
        {docId ? <Editor key={docId} docId={docId} email={email} /> : <DocList userId={user.uid} email={email} />}
      </ErrorBoundary>
    </main>
  )
}

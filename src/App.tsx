import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import Auth from './Auth'
import DocList from './DocList'
import Editor from './Editor'

const docIdFromHash = () => location.hash.match(/^#\/doc\/(.+)$/)?.[1] ?? null

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [docId, setDocId] = useState(docIdFromHash)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    const onHash = () => setDocId(docIdFromHash())
    window.addEventListener('hashchange', onHash)
    return () => {
      data.subscription.unsubscribe()
      window.removeEventListener('hashchange', onHash)
    }
  }, [])

  if (!session) return <Auth />
  const email = session.user.email ?? 'anonymous'

  return (
    <main>
      <nav>
        <a href="#" className="brand">Docs for Ten</a>
        <span>{email}</span>
        <button onClick={() => supabase.auth.signOut()}>Sign out</button>
      </nav>
      {docId ? <Editor key={docId} docId={docId} email={email} /> : <DocList userId={session.user.id} />}
    </main>
  )
}

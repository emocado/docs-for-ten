import { useEffect, useState } from 'react'
import * as Y from 'yjs'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCaret from '@tiptap/extension-collaboration-caret'
import { get, onValue, ref, update } from 'firebase/database'
import { db } from './firebase'
import { FirebaseProvider, userFor } from './FirebaseProvider'

type Session = { doc: Y.Doc; provider: FirebaseProvider; savedTitle: string }
type Peer = { name: string; color: string }

const TITLE_MAX = 200 // Same limit as database.rules.json.

export default function Editor({ docId, email }: { docId: string; email: string }) {
  const [session, setSession] = useState<Session | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let current: Session | undefined
    let cancelled = false
    const close = () => {
      cancelled = true
      current?.provider.destroy()
      current?.doc.destroy()
      current = undefined
    }
    get(ref(db, `documents/${docId}/title`))
      .then((snap) => {
        if (cancelled) return
        if (!snap.exists()) return setError('Document not found')
        const doc = new Y.Doc()
        current = { doc, provider: new FirebaseProvider(docId, doc), savedTitle: snap.val() }
        setSession(current)
      })
      .catch((err) => !cancelled && setError(err.message))
    // Close the editor if the owner deletes the document while it's open.
    const unsubscribe = onValue(ref(db, `documents/${docId}/ownerId`), (snap) => {
      if (snap.exists() || !current) return
      close()
      setError('This document was deleted')
    })
    return () => {
      unsubscribe()
      close()
    }
  }, [docId])

  if (error) return <p className="error">{error}</p>
  if (!session) return <p>Loading…</p>
  return <LiveEditor docId={docId} email={email} {...session} />
}

function LiveEditor({ docId, email, doc, provider, savedTitle }: Session & { docId: string; email: string }) {
  const meta = doc.getMap<string>('meta')
  const [title, setTitle] = useState(meta.get('title') ?? savedTitle)
  const [peers, setPeers] = useState<Peer[]>([])
  const [saved, setSaved] = useState(true)
  const [saveError, setSaveError] = useState('')

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ undoRedo: false }),
      Collaboration.configure({ document: doc }),
      CollaborationCaret.configure({ provider, user: userFor(email) }),
    ],
  })

  // Keep the title and the list of people here in sync with everyone else.
  useEffect(() => {
    const onTitle = () => setTitle(meta.get('title') ?? savedTitle)
    const onPeers = () =>
      setPeers([...provider.awareness.getStates().values()].map((s) => s.user).filter(Boolean))
    meta.observe(onTitle)
    provider.awareness.on('change', onPeers)
    onPeers()
    return () => {
      meta.unobserve(onTitle)
      provider.awareness.off('change', onPeers)
    }
  }, [meta, provider, savedTitle])

  // Save a snapshot a second after this person's last change.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const save = () => {
      const { writes, onSaved } = provider.snapshotWrites()
      update(ref(db), {
        ...writes,
        [`documents/${docId}/title`]: String(meta.get('title') || savedTitle).slice(0, TITLE_MAX),
        [`documents/${docId}/updatedAt`]: Date.now(),
      })
        .then(() => {
          onSaved()
          setSaved(true)
          setSaveError('')
        })
        .catch((err) => setSaveError(err.message))
    }
    const onUpdate = (_update: Uint8Array, origin: unknown) => {
      if (origin === provider) return
      setSaved(false)
      clearTimeout(timer)
      timer = setTimeout(save, 1000)
    }
    doc.on('update', onUpdate)
    return () => {
      doc.off('update', onUpdate)
      clearTimeout(timer)
    }
  }, [doc, docId, meta, provider, savedTitle])

  return (
    <div className="editor-page">
      <header className="toolbar">
        <a href="#">← All documents</a>
        <input className="title" maxLength={TITLE_MAX} value={title} onChange={(e) => meta.set('title', e.target.value)} />
        <span className="status">{saveError ? `Save failed: ${saveError}` : saved ? 'Saved' : 'Saving…'}</span>
        <div className="peers">
          {peers.map((p, i) => (
            <span key={i} className="peer" style={{ background: p.color }} title={p.name}>
              {p.name?.[0]?.toUpperCase()}
            </span>
          ))}
        </div>
      </header>
      {editor && (
        <div className="format-bar">
          <button onClick={() => editor.chain().focus().toggleBold().run()}><b>B</b></button>
          <button onClick={() => editor.chain().focus().toggleItalic().run()}><i>I</i></button>
          <button onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>H1</button>
          <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</button>
          <button onClick={() => editor.chain().focus().toggleBulletList().run()}>• List</button>
          <button onClick={() => editor.chain().focus().toggleOrderedList().run()}>1. List</button>
        </div>
      )}
      <EditorContent editor={editor} className="page" />
    </div>
  )
}

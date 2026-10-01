import { useEffect, useState } from 'react'
import * as Y from 'yjs'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCaret from '@tiptap/extension-collaboration-caret'
import { db } from './db'
import { InstantProvider, fromB64, toB64 } from './InstantProvider'

type Session = { doc: Y.Doc; provider: InstantProvider }
type Peer = { name: string; color: string }

const COLORS = ['#e6194b', '#3cb44b', '#4363d8', '#f58231', '#911eb4', '#469990', '#9a6324', '#800000', '#808000', '#000075']
const colorFor = (s: string) => COLORS[[...s].reduce((h, c) => h + c.charCodeAt(0), 0) % COLORS.length]

export default function Editor({ docId, email }: { docId: string; email: string }) {
  const [session, setSession] = useState<Session | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let current: Session | undefined
    let cancelled = false
    db.queryOnce({ documents: { $: { where: { id: docId } } } })
      .then(({ data }) => {
        if (cancelled) return
        const row = data.documents[0]
        if (!row) return setError('Document not found')
        const doc = new Y.Doc()
        if (row.content) Y.applyUpdate(doc, fromB64(row.content))
        const meta = doc.getMap<string>('meta')
        if (!meta.has('title')) meta.set('title', row.title)
        current = { doc, provider: new InstantProvider(docId, doc) }
        setSession(current)
      })
      .catch((err) => !cancelled && setError(err.message))
    return () => {
      cancelled = true
      current?.provider.destroy()
      current?.doc.destroy()
    }
  }, [docId])

  if (error) return <p className="error">{error}</p>
  if (!session) return <p>Loading…</p>
  return <LiveEditor docId={docId} email={email} {...session} />
}

function LiveEditor({ docId, email, doc, provider }: Session & { docId: string; email: string }) {
  const meta = doc.getMap<string>('meta')
  const [title, setTitle] = useState(meta.get('title') ?? '')
  const [peers, setPeers] = useState<Peer[]>([])
  const [saved, setSaved] = useState(true)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ undoRedo: false }),
      Collaboration.configure({ document: doc }),
      CollaborationCaret.configure({ provider, user: { name: email.split('@')[0], color: colorFor(email) } }),
    ],
  })

  // Keep the title and the list of people here in sync with everyone else.
  useEffect(() => {
    const onTitle = () => setTitle(meta.get('title') ?? '')
    const onPeers = () =>
      setPeers([...provider.awareness.getStates().values()].map((s) => s.user).filter(Boolean))
    meta.observe(onTitle)
    provider.awareness.on('change', onPeers)
    onPeers()
    return () => {
      meta.unobserve(onTitle)
      provider.awareness.off('change', onPeers)
    }
  }, [meta, provider])

  // Persist the whole document a second after the last change, from any editor.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const save = async () => {
      await db.transact(
        db.tx.documents[docId].update(
          {
            title: meta.get('title') || 'Untitled document',
            content: toB64(Y.encodeStateAsUpdate(doc)),
            updatedAt: Date.now(),
          },
          { upsert: false },
        ),
      )
      setSaved(true)
    }
    const onUpdate = () => {
      setSaved(false)
      clearTimeout(timer)
      timer = setTimeout(save, 1000)
    }
    doc.on('update', onUpdate)
    return () => {
      doc.off('update', onUpdate)
      clearTimeout(timer)
    }
  }, [doc, docId, meta])

  return (
    <div className="editor-page">
      <header className="toolbar">
        <a href="#">← All documents</a>
        <input className="title" value={title} onChange={(e) => meta.set('title', e.target.value)} />
        <span className="status">{saved ? 'Saved' : 'Saving…'}</span>
        <div className="peers">
          {peers.map((p, i) => (
            <span key={i} className="peer" style={{ background: p.color }} title={p.name}>
              {p.name[0]?.toUpperCase()}
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

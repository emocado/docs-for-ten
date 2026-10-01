import * as Y from 'yjs'
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate, removeAwarenessStates } from 'y-protocols/awareness'
import { db } from './db'

export const toB64 = (u: Uint8Array) => {
  let s = ''
  for (const byte of u) s += String.fromCharCode(byte)
  return btoa(s)
}
export const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

// Syncs a Y.Doc between everyone who has the same document open, using an
// InstantDB room. Persistence is handled separately.
export class InstantProvider {
  awareness: Awareness
  private doc: Y.Doc
  private room: ReturnType<typeof db.core.joinRoom<'doc'>>
  private unsubscribes: (() => void)[]

  constructor(docId: string, doc: Y.Doc) {
    this.doc = doc
    this.awareness = new Awareness(doc)
    this.room = db.core.joinRoom('doc', docId)

    this.unsubscribes = [
      this.room.subscribeTopic('update', ({ update }) => Y.applyUpdate(doc, fromB64(update), this)),
      this.room.subscribeTopic('sync', ({ sv }) => {
        // A newcomer sent their state vector: reply with what they're missing.
        this.room.publishTopic('update', { update: toB64(Y.encodeStateAsUpdate(doc, fromB64(sv))) })
        this.sendAwareness([doc.clientID])
      }),
      this.room.subscribeTopic('awareness', ({ update }) =>
        applyAwarenessUpdate(this.awareness, fromB64(update), this),
      ),
    ]

    // Queued by Instant until the room is connected.
    this.room.publishTopic('sync', { sv: toB64(Y.encodeStateVector(doc)) })
    this.sendAwareness([doc.clientID])

    doc.on('update', this.onDocUpdate)
    this.awareness.on('update', this.onAwarenessUpdate)
  }

  private sendAwareness(clients: number[]) {
    this.room.publishTopic('awareness', { update: toB64(encodeAwarenessUpdate(this.awareness, clients)) })
  }

  private onDocUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin !== this) this.room.publishTopic('update', { update: toB64(update) })
  }

  private onAwarenessUpdate = (
    { added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
    origin: unknown,
  ) => {
    if (origin !== this) this.sendAwareness([...added, ...updated, ...removed])
  }

  destroy() {
    removeAwarenessStates(this.awareness, [this.doc.clientID], 'local')
    this.doc.off('update', this.onDocUpdate)
    this.awareness.off('update', this.onAwarenessUpdate)
    this.unsubscribes.forEach((unsubscribe) => unsubscribe())
    this.room.leaveRoom()
  }
}

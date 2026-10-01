import * as Y from 'yjs'
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate, removeAwarenessStates } from 'y-protocols/awareness'
import { onChildAdded, onChildChanged, onChildRemoved, onDisconnect, onValue, push, ref, remove, set } from 'firebase/database'
import { db } from './firebase'

export const toB64 = (u: Uint8Array) => {
  let s = ''
  for (const byte of u) s += String.fromCharCode(byte)
  return btoa(s)
}
export const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

// Skips (and logs) a malformed entry instead of letting it break syncing.
const tryApply = (path: string, apply: () => void) => {
  try {
    apply()
  } catch (err) {
    console.error(`Skipping bad data at ${path}`, err)
  }
}

// Syncs a Y.Doc between everyone who has the same document open.
// Every edit is pushed to updates/<docId>, and everyone (including late joiners)
// merges the saved snapshot plus that list. Cursors live in awareness/<docId>/<clientID>.
export class FirebaseProvider {
  awareness: Awareness
  private doc: Y.Doc
  private docId: string
  private appliedKeys = new Set<string>()
  private unsubscribes: (() => void)[]

  constructor(docId: string, doc: Y.Doc) {
    this.doc = doc
    this.docId = docId
    this.awareness = new Awareness(doc)

    const updatesRef = ref(db, `updates/${docId}`)
    const awarenessRef = ref(db, `awareness/${docId}`)
    const applyAwareness = (snap: { key: string | null; val: () => string }) =>
      tryApply(`awareness/${docId}/${snap.key}`, () => applyAwarenessUpdate(this.awareness, fromB64(snap.val()), this))

    this.unsubscribes = [
      // The saved snapshot, re-merged whenever someone compacts the update list.
      onValue(ref(db, `documents/${docId}/content`), (snap) => {
        if (snap.exists()) tryApply(`documents/${docId}/content`, () => Y.applyUpdate(doc, fromB64(snap.val()), this))
      }),
      onChildAdded(updatesRef, (snap) => {
        tryApply(`updates/${docId}/${snap.key}`, () => Y.applyUpdate(doc, fromB64(snap.val()), this))
        // Bad entries are marked applied too, so the next snapshot clears them out.
        this.appliedKeys.add(snap.key!)
      }),
      onChildAdded(awarenessRef, applyAwareness),
      onChildChanged(awarenessRef, applyAwareness),
      onChildRemoved(awarenessRef, (snap) => {
        // Our own node is removed by onDisconnect after a network drop; keep our local state.
        if (Number(snap.key) !== doc.clientID) removeAwarenessStates(this.awareness, [Number(snap.key)], this)
      }),
      // onDisconnect runs once per connection, so set it up again on every (re)connect
      // and re-announce our state (bumping its clock) in case the server already removed it.
      onValue(ref(db, '.info/connected'), (snap) => {
        if (!snap.val()) return
        onDisconnect(this.myAwarenessRef()).remove()
        const state = this.awareness.getLocalState()
        if (state) this.awareness.setLocalState(state)
      }),
    ]

    doc.on('update', this.onDocUpdate)
    this.awareness.on('update', this.onAwarenessUpdate)
  }

  // Database writes that fold the updates seen so far into a saved snapshot.
  // Call onSaved once they succeed, so a failed save keeps the keys to compact later.
  snapshotWrites() {
    const keys = [...this.appliedKeys]
    const writes: Record<string, string | null> = {
      [`documents/${this.docId}/content`]: toB64(Y.encodeStateAsUpdate(this.doc)),
    }
    for (const key of keys) writes[`updates/${this.docId}/${key}`] = null
    return { writes, onSaved: () => keys.forEach((key) => this.appliedKeys.delete(key)) }
  }

  private myAwarenessRef() {
    return ref(db, `awareness/${this.docId}/${this.doc.clientID}`)
  }

  private onDocUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin !== this) push(ref(db, `updates/${this.docId}`), toB64(update))
  }

  private onAwarenessUpdate = (_changes: unknown, origin: unknown) => {
    if (origin === this || !this.awareness.getLocalState()) return
    set(this.myAwarenessRef(), toB64(encodeAwarenessUpdate(this.awareness, [this.doc.clientID])))
  }

  destroy() {
    this.doc.off('update', this.onDocUpdate)
    this.awareness.off('update', this.onAwarenessUpdate)
    this.unsubscribes.forEach((unsubscribe) => unsubscribe())
    onDisconnect(this.myAwarenessRef()).cancel()
    remove(this.myAwarenessRef())
    this.awareness.destroy()
  }
}

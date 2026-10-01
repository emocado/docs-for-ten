import * as Y from 'yjs'
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate, removeAwarenessStates } from 'y-protocols/awareness'
import { onChildAdded, onChildChanged, onChildRemoved, onDisconnect, onValue, push, ref, remove, set } from 'firebase/database'
import * as decoding from 'lib0/decoding'
import { auth, db } from './firebase'

export const toB64 = (u: Uint8Array) => {
  let s = ''
  for (const byte of u) s += String.fromCharCode(byte)
  return btoa(s)
}
export const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

const COLORS = ['#e6194b', '#3cb44b', '#4363d8', '#f58231', '#911eb4', '#469990', '#9a6324', '#800000', '#808000', '#000075']
export const userFor = (email: string) => ({
  name: email.split('@')[0],
  color: COLORS[[...email].reduce((h, c) => h + c.charCodeAt(0), 0) % COLORS.length],
})

type Presence = { uid: string; email: string; update: string }

// The rules check each cursor entry's email, so only trust an update that is about
// that entry's own client and shows the name and colour that email gives.
const isGenuine = (clientID: number, email: string, update: Uint8Array) => {
  const decoder = decoding.createDecoder(update)
  if (decoding.readVarUint(decoder) !== 1 || decoding.readVarUint(decoder) !== clientID) return false
  decoding.readVarUint(decoder) // clock
  const state = JSON.parse(decoding.readVarString(decoder))
  const user = userFor(email)
  return state === null || (state.user?.name === user.name && state.user?.color === user.color)
}

// Syncs a Y.Doc between everyone who has the same document open.
// Every edit is pushed to updates/<docId>, and everyone (including late joiners)
// merges the saved snapshot plus that list. Cursors live in awareness/<docId>/<clientID>,
// tagged with the uid and email of whoever owns them.
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
    const applyAwareness = (snap: { key: string | null; val: () => Presence }) => {
      const { email, update } = snap.val()
      const bytes = fromB64(update)
      if (isGenuine(Number(snap.key), email, bytes)) applyAwarenessUpdate(this.awareness, bytes, this)
    }

    this.unsubscribes = [
      // The saved snapshot, re-merged whenever someone compacts the update list.
      onValue(ref(db, `documents/${docId}/content`), (snap) => {
        if (snap.exists()) Y.applyUpdate(doc, fromB64(snap.val()), this)
      }),
      onChildAdded(updatesRef, (snap) => {
        Y.applyUpdate(doc, fromB64(snap.val()), this)
        this.appliedKeys.add(snap.key!)
      }),
      onChildAdded(awarenessRef, applyAwareness),
      onChildChanged(awarenessRef, applyAwareness),
      onChildRemoved(awarenessRef, (snap) => removeAwarenessStates(this.awareness, [Number(snap.key)], this)),
    ]
    onDisconnect(this.myAwarenessRef()).remove()

    doc.on('update', this.onDocUpdate)
    this.awareness.on('update', this.onAwarenessUpdate)
  }

  // Database writes that fold the updates seen so far into a saved snapshot.
  snapshotWrites(): Record<string, string | null> {
    const writes: Record<string, string | null> = {
      [`documents/${this.docId}/content`]: toB64(Y.encodeStateAsUpdate(this.doc)),
    }
    for (const key of this.appliedKeys) writes[`updates/${this.docId}/${key}`] = null
    this.appliedKeys.clear()
    return writes
  }

  private myAwarenessRef() {
    return ref(db, `awareness/${this.docId}/${this.doc.clientID}`)
  }

  private onDocUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin !== this) push(ref(db, `updates/${this.docId}`), toB64(update))
  }

  private onAwarenessUpdate = (_changes: unknown, origin: unknown) => {
    if (origin === this || !this.awareness.getLocalState()) return
    const { uid, email } = auth.currentUser!
    const presence: Presence = { uid, email: email!, update: toB64(encodeAwarenessUpdate(this.awareness, [this.doc.clientID])) }
    set(this.myAwarenessRef(), presence)
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

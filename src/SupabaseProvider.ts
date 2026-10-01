import * as Y from 'yjs'
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate, removeAwarenessStates } from 'y-protocols/awareness'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from './supabase'

const toB64 = (u: Uint8Array) => {
  let s = ''
  for (const byte of u) s += String.fromCharCode(byte)
  return btoa(s)
}
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

// Syncs a Y.Doc between everyone who has the same document open, using a
// private Supabase Realtime broadcast channel. Persistence is handled separately.
export class SupabaseProvider {
  awareness: Awareness
  private doc: Y.Doc
  private channel: RealtimeChannel

  constructor(docId: string, doc: Y.Doc) {
    this.doc = doc
    this.awareness = new Awareness(doc)
    this.channel = supabase.channel(`doc:${docId}`, { config: { private: true } })

    this.channel
      .on('broadcast', { event: 'update' }, ({ payload }) => Y.applyUpdate(doc, fromB64(payload.update), this))
      .on('broadcast', { event: 'sync' }, ({ payload }) => {
        // A newcomer sent their state vector: reply with what they're missing.
        this.send('update', { update: toB64(Y.encodeStateAsUpdate(doc, fromB64(payload.sv))) })
        this.sendAwareness([doc.clientID])
      })
      .on('broadcast', { event: 'awareness' }, ({ payload }) =>
        applyAwarenessUpdate(this.awareness, fromB64(payload.update), this),
      )
      .subscribe((status) => {
        if (status !== 'SUBSCRIBED') return
        this.send('sync', { sv: toB64(Y.encodeStateVector(doc)) })
        this.sendAwareness([doc.clientID])
      })

    doc.on('update', this.onDocUpdate)
    this.awareness.on('update', this.onAwarenessUpdate)
  }

  private send(event: string, payload: object) {
    this.channel.send({ type: 'broadcast', event, payload })
  }

  private sendAwareness(clients: number[]) {
    this.send('awareness', { update: toB64(encodeAwarenessUpdate(this.awareness, clients)) })
  }

  private onDocUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin !== this) this.send('update', { update: toB64(update) })
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
    supabase.removeChannel(this.channel)
  }
}

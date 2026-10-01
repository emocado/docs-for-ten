import { i } from '@instantdb/react'

// One record type: a shared document.
// content holds the Yjs document state, base64-encoded.
const _schema = i.schema({
  entities: {
    $users: i.entity({
      email: i.string().unique().indexed().optional(),
    }),
    documents: i.entity({
      title: i.string(),
      content: i.string().optional(),
      ownerId: i.string().indexed(),
      ownerEmail: i.string(),
      updatedAt: i.number().indexed(),
    }),
  },
  // Live editing: Yjs updates and cursor positions, base64-encoded.
  rooms: {
    doc: {
      presence: i.entity({}),
      topics: {
        update: i.entity({ update: i.string() }),
        sync: i.entity({ sv: i.string() }),
        awareness: i.entity({ update: i.string() }),
      },
    },
  },
})

type _AppSchema = typeof _schema
interface AppSchema extends _AppSchema {}
const schema: AppSchema = _schema

export type { AppSchema }
export default schema

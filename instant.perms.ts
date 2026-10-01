import type { InstantRules } from '@instantdb/react'

// The rule: every signed-in member can view and edit any document,
// but only the person who created it can delete it.
const rules = {
  documents: {
    allow: {
      view: 'isMember',
      create: 'isMember && auth.id == data.ownerId',
      update: 'isMember && newData.ownerId == data.ownerId',
      delete: 'isMember && auth.id == data.ownerId',
    },
    bind: { isMember: 'auth.id != null' },
  },
  attrs: { allow: { create: 'false' } },
} satisfies InstantRules

export default rules

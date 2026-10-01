# Docs for Ten

A tiny Google Docs for a group of ten: write the same document together, at the same time, and see everyone's cursor live.

## The plan

**Who:** a study group or project team of up to ten people (classmates writing a group report, a club drafting its plans).

**What they do together:** open a shared document and edit it at the same time. Changes merge without conflicts, and you can see who else is in the document and where their cursor is.

| Brief | This app |
| --- | --- |
| One main type of record | a **document** (title + content) |
| One shared action | **co-editing** a document live |
| One rule about who can view/change | every member can view and edit any document; **only the creator can delete it**. Sign-ups stop at **10 members**. |

## How it works

- **Login + database:** Supabase Auth (email + password) and Postgres.
- **Rules:** enforced in the database with Row Level Security. See [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql).
- **Live editing:** the [TipTap](https://tiptap.dev) editor stores text in a [Yjs](https://yjs.dev) CRDT, so edits from different people always merge. Edits and cursor positions travel over a private Supabase Realtime broadcast channel per document ([`src/SupabaseProvider.ts`](src/SupabaseProvider.ts)).
- **Saving:** each open editor saves the merged Yjs state to the `documents` table one second after the last change.

## Run it locally

1. Create a Supabase project and run `supabase/migrations/0001_init.sql` in its SQL editor.
2. Optional, for quick testing: in Authentication → Sign In / Providers → Email, turn off **Confirm email**.
3. Copy `.env.example` to `.env` and fill in your project URL and anon key.
4. `npm install`, then `npm run dev`, and open the app in two browser windows signed in as different users.

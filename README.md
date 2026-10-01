# Docs for Ten

A tiny Google Docs for a group of ten: write the same document together, at the same time, and see everyone's cursor live.

## The plan

**Who:** a study group or project team of up to ten people (classmates writing a group report, a club drafting its plans).

**What they do together:** open a shared document and edit it at the same time. Changes merge without conflicts, and you can see who else is in the document and where their cursor is.

| Brief | This app |
| --- | --- |
| One main type of record | a **document** (title + content) |
| One shared action | **co-editing** a document live |
| One rule about who can view/change | every signed-in member can view and edit any document; **only the creator can delete it** |

## How it works

- **Login + database:** [InstantDB](https://instantdb.com) (free plan). Members sign in with a code sent to their email.
- **Rules:** enforced by InstantDB permissions. See [`instant.perms.ts`](instant.perms.ts) and the data model in [`instant.schema.ts`](instant.schema.ts).
- **Live editing:** the [TipTap](https://tiptap.dev) editor stores text in a [Yjs](https://yjs.dev) CRDT, so edits from different people always merge. Edits and cursor positions travel over an InstantDB room, one per document ([`src/InstantProvider.ts`](src/InstantProvider.ts)).
- **Saving:** each open editor saves the merged Yjs state to the `documents` table one second after the last change.

## Run it locally

1. `npm install`
2. `npx instant-cli@latest login`, then create an app with `npx instant-cli@latest init-without-files --title docs-for-ten` and put its `appId` in `.env` as `VITE_INSTANT_APP_ID` (see `.env.example`).
3. `npx instant-cli@latest push schema` and `npx instant-cli@latest push perms`
4. `npm run dev`, and open the app in two browser windows signed in as different people.

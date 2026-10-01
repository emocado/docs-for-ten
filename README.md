# Docs for Ten

A tiny Google Docs for a group of ten: write the same document together, at the same time, and see everyone's cursor live.
n**Live:** https://emocado.github.io/docs-for-ten/

## The plan

**Who:** a study group or project team of up to ten people (classmates writing a group report, a club drafting its plans).

**What they do together:** open a shared document and edit it at the same time. Changes merge without conflicts, and you can see who else is in the document and where their cursor is.

| Brief | This app |
| --- | --- |
| One main type of record | a **document** (title + content) |
| One shared action | **co-editing** a document live |
| One rule about who can view/change | every signed-in member can view and edit any document; **only the creator can delete it** |

## How it works

- **Login + database:** [Firebase](https://firebase.google.com) on the free Spark plan: email + password Auth and the Realtime Database.
- **Rules:** enforced by Realtime Database security rules. See [`database.rules.json`](database.rules.json).
- **Live editing:** the [TipTap](https://tiptap.dev) editor stores text in a [Yjs](https://yjs.dev) CRDT, so edits from different people always merge. Each edit is pushed to `updates/<docId>`, and everyone, including people who open the document later, merges that list. Cursor positions live in `awareness/<docId>` and disappear when someone disconnects ([`src/FirebaseProvider.ts`](src/FirebaseProvider.ts)).
- **Saving:** a second after you stop typing, your editor saves a snapshot of the whole document to `documents/<docId>/content` and clears the edits it now contains.

## Run it locally

1. `npm install`
2. Create a Firebase project with a web app and a Realtime Database, and turn on **Email/Password** sign-in (Authentication → Sign-in method).
3. Copy `.env.example` to `.env` and fill in the web app's config.
4. `npx firebase deploy --only database --project <your-project-id>` to publish the rules.
5. `npm run dev`, and open the app in two browser windows signed in as different people.

import { useState } from 'react'
import type { FormEvent } from 'react'
import { db } from './db'

export default function Auth() {
  const [email, setEmail] = useState('')
  const [sentTo, setSentTo] = useState('')
  const [code, setCode] = useState('')
  const [message, setMessage] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    setMessage('')
    try {
      if (!sentTo) {
        await db.auth.sendMagicCode({ email })
        setSentTo(email)
      } else {
        await db.auth.signInWithMagicCode({ email: sentTo, code })
      }
    } catch (err) {
      setMessage((err as { body?: { message?: string } }).body?.message ?? 'Something went wrong')
    }
  }

  return (
    <form className="auth" onSubmit={submit}>
      <h1>Docs for Ten</h1>
      {!sentTo ? (
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      ) : (
        <>
          <p>We emailed a code to {sentTo}.</p>
          <input placeholder="123456" value={code} onChange={(e) => setCode(e.target.value)} required />
        </>
      )}
      <button type="submit">{sentTo ? 'Sign in' : 'Send code'}</button>
      {message && <p className="error">{message}</p>}
    </form>
  )
}

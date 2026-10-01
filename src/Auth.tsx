import { useState } from 'react'
import type { FormEvent } from 'react'
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from './firebase'

export default function Auth() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')

  async function submit(e: FormEvent, mode: 'in' | 'up') {
    e.preventDefault()
    setMessage('')
    try {
      if (mode === 'in') await signInWithEmailAndPassword(auth, email, password)
      else await createUserWithEmailAndPassword(auth, email, password)
    } catch (err) {
      setMessage((err as Error).message)
    }
  }

  return (
    <form className="auth" onSubmit={(e) => submit(e, 'in')}>
      <h1>Docs for Ten</h1>
      <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
      <button type="submit">Sign in</button>
      <button type="button" onClick={(e) => submit(e, 'up')}>Create account</button>
      {message && <p className="error">{message}</p>}
    </form>
  )
}

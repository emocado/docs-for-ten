import { useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from './supabase'

export default function Auth() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')

  async function submit(e: FormEvent, mode: 'in' | 'up') {
    e.preventDefault()
    setMessage('')
    const { data, error } =
      mode === 'in'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password })
    if (error) setMessage(error.message)
    else if (!data.session) setMessage('Check your email to confirm your account.')
  }

  return (
    <form className="auth" onSubmit={(e) => submit(e, 'in')}>
      <h1>Docs for Ten</h1>
      <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
      <button type="submit">Sign in</button>
      <button type="button" onClick={(e) => submit(e, 'up')}>Create account</button>
      {message && <p>{message}</p>}
    </form>
  )
}

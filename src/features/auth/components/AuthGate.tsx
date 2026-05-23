import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from 'react'
import { getSupabaseClient } from '../../../shared/lib/supabaseClient'
import { OWNER_EMAIL, isOwnerEmail } from '../utils/ownerAccess'

type AuthGateProps = {
  children: (props: { userEmail: string; onSignOut: () => void }) => ReactNode
}

type AuthState =
  | { status: 'config-missing' }
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'forbidden'; email: string }
  | { status: 'signed-in'; email: string }

export function AuthGate({ children }: AuthGateProps) {
  const supabase = useMemo(() => getSupabaseClient(), [])
  const [authState, setAuthState] = useState<AuthState>(
    supabase ? { status: 'loading' } : { status: 'config-missing' },
  )

  useEffect(() => {
    if (!supabase) {
      return
    }

    let isMounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) {
        return
      }
      setAuthState(resolveAuthState(data.session?.user.email ?? null))
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthState(resolveAuthState(session?.user.email ?? null))
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [supabase])

  async function handleSignOut() {
    if (!supabase) {
      return
    }

    await supabase.auth.signOut()
    setAuthState({ status: 'signed-out' })
  }

  if (authState.status === 'signed-in') {
    return children({ userEmail: authState.email, onSignOut: handleSignOut })
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <p className="eyebrow">Trading Dashboard</p>
        {authState.status === 'loading' ? (
          <h1>Checking session</h1>
        ) : (
          <AuthContent authState={authState} supabase={supabase} />
        )}
      </section>
    </main>
  )
}

function resolveAuthState(email: string | null): AuthState {
  if (!email) {
    return { status: 'signed-out' }
  }

  if (!isOwnerEmail(email)) {
    return { status: 'forbidden', email }
  }

  return { status: 'signed-in', email }
}

function AuthContent({
  authState,
  supabase,
}: {
  authState: Exclude<AuthState, { status: 'loading' } | { status: 'signed-in' }>
  supabase: ReturnType<typeof getSupabaseClient>
}) {
  const [email, setEmail] = useState(OWNER_EMAIL)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')
    setError('')

    if (!supabase) {
      setError('Supabase environment variables are missing.')
      return
    }

    if (!isOwnerEmail(email)) {
      setError(`Only ${OWNER_EMAIL} can access this dashboard.`)
      return
    }

    setIsSubmitting(true)
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin,
        shouldCreateUser: true,
      },
    })
    setIsSubmitting(false)

    if (signInError) {
      setError(signInError.message)
      return
    }

    setMessage('Magic link sent.')
  }

  if (authState.status === 'config-missing') {
    return (
      <>
        <h1>Supabase configuration required</h1>
        <p className="auth-copy">Set the Vite Supabase environment variables.</p>
      </>
    )
  }

  if (authState.status === 'forbidden') {
    return (
      <>
        <h1>Access restricted</h1>
        <p className="auth-copy">{authState.email} is not allowed.</p>
      </>
    )
  }

  return (
    <>
      <h1>Sign in</h1>
      <form className="auth-form" onSubmit={handleSubmit}>
        <label htmlFor="owner-email">Email</label>
        <input
          id="owner-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          required
        />
        <button type="submit" className="primary-action" disabled={isSubmitting}>
          {isSubmitting ? 'Sending' : 'Send magic link'}
        </button>
      </form>
      {message ? <p className="auth-message">{message}</p> : null}
      {error ? <p className="auth-error">{error}</p> : null}
    </>
  )
}

import { type ReactNode, useEffect, useMemo, useState } from 'react'
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
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleGoogleSignIn() {
    setError('')

    if (!supabase) {
      setError('Supabase environment variables are missing.')
      return
    }

    setIsSubmitting(true)
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    })
    setIsSubmitting(false)

    if (signInError) {
      setError(signInError.message)
    }
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
      <p className="auth-copy">Continue with the Google account for {OWNER_EMAIL}.</p>
      <button type="button" className="google-action" onClick={handleGoogleSignIn} disabled={isSubmitting}>
        <span className="google-mark" aria-hidden="true">G</span>
        {isSubmitting ? 'Opening Google' : 'Continue with Google'}
      </button>
      {error ? <p className="auth-error">{error}</p> : null}
    </>
  )
}

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

export function getSupabaseClient() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
  const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()

  if (!supabaseUrl || !supabasePublishableKey) {
    return null
  }

  client ??= createClient(supabaseUrl, supabasePublishableKey)

  return client
}

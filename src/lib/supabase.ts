import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { DEMO, makeDemoClient } from './demo'

// Demo may run without Supabase env (the DB is faked); a placeholder keeps
// createClient from throwing. The deployed demo sets the demo project's real
// URL/anon so the advisor passthrough reaches its rate-limited edge function.
const real = createClient(
  import.meta.env.VITE_SUPABASE_URL ?? (DEMO ? 'https://demo.invalid' : undefined),
  import.meta.env.VITE_SUPABASE_ANON_KEY ?? (DEMO ? 'demo-anon' : undefined),
)

// In demo mode the DB layer is faked in-memory (see lib/demo.ts); the real
// client is kept only so the advisor's edge-function call passes through.
export const supabase = (DEMO ? makeDemoClient(real) : real) as SupabaseClient

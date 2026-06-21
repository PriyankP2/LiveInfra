import { createClient } from '@supabase/supabase-js'

// Server-side client — uses service_role key, bypasses RLS
// Never expose this to the browser
export const supabase = createClient(
  process.env['SUPABASE_URL'] ?? '',
  process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '',
  {
    auth: { persistSession: false },
  }
)

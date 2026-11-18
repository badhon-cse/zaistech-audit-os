import { createClient } from "@supabase/supabase-js";

// Server-side only client (uses the service role key -- never expose this to the browser).
export function supabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set. Copy .env.example to .env.local and fill them in."
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

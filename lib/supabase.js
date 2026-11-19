import { createClient } from "@supabase/supabase-js";

// Next.js patches the global fetch() to cache responses, and a route's own
// `export const dynamic = "force-dynamic"` is meant to turn that off for
// every fetch the route makes -- but in practice (at least on Next 14.2.5
// as deployed here) a route-level setting isn't enough: a persisted build
// cache (Render keeps .next/cache between ordinary deploys, only a "Clear
// build cache & deploy" wipes it) can keep serving an old cached Supabase
// response after a fresh deploy even though the route is marked dynamic --
// confirmed directly: /api/outreach-tracker kept returning a lead's
// pre-deploy status while /api/leads/[id] for the same lead returned the
// current one, right after an ordinary (non-cache-cleared) deploy. Rather
// than depend on route config and remembering to clear the build cache on
// every future deploy, force every Supabase request itself to skip the
// cache -- that holds regardless of route config or build-cache state.
function noStoreFetch(url, init) {
  return fetch(url, { ...init, cache: "no-store" });
}

// Server-side only client (uses the service role key -- never expose this to the browser).
export function supabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set. Copy .env.example to .env.local and fill them in."
    );
  }
  return createClient(url, key, { auth: { persistSession: false }, global: { fetch: noStoreFetch } });
}

// The product's display name — the ONLY place it's spelled. Rebrands are a one-line edit.
// Used by: App.tsx, Advisor.tsx, vite.config.ts (injects %APP_NAME% into index.html),
// scripts/smoke.ts. The edge function (supabase/functions/claude-proxy) duplicates it —
// keep that copy in sync (Deno bundle, kept import-free on purpose).
export const APP_NAME = 'Juno'

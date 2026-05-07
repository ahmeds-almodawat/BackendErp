# Real Supabase Backend Gate Guide

Required frontend environment variables:

VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

Forbidden in frontend:

VITE_SUPABASE_SERVICE_ROLE_KEY=never
VITE_SUPABASE_SERVICE_KEY=never
SUPABASE_SERVICE_ROLE_KEY=backend-only

The service role key belongs only in secure backend or Edge Function environments.

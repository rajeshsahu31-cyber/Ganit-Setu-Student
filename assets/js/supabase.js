/* =====================================
   GANIT SETU - Supabase Connection
   ===================================== */

const SUPABASE_URL = "https://cbgojvnbkosdehvwerth.supabase.co";

const SUPABASE_ANON_KEY = "sb_publishable_a5XOePzNSNn72WQm_xrIAQ_cj5Z01W_";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

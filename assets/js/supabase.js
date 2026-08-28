/* =====================================
   GANIT SETU - Supabase Connection
   Project: Ganit Setu
   ===================================== */

window.GANIT_SETU_SUPABASE = {
  url: "https://xgmeivfvuujculkplxjf.supabase.co",
  anonKey: "sb_publishable_cORbSXbHOaHzsIHuh2CACQ_vwFXy-zE",
  table: "students"
};

window.getGanitSetuSupabase = function(){
  const cfg = window.GANIT_SETU_SUPABASE || {};
  const url = String(cfg.url || '').trim().replace(/\/+$/, '');
  const anonKey = String(cfg.anonKey || '').trim();

  if(!url || !anonKey){
    return { ok:false, error:'Supabase URL या publishable key उपलब्ध नहीं है।' };
  }

  if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)){
    return { ok:false, error:'Supabase Project URL सही format में नहीं है।' };
  }

  return { ok:true, url, anonKey, table:String(cfg.table || 'students') };
};

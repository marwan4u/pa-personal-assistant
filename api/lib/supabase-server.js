// Minimal server-only Supabase REST client. Never expose SUPABASE_SECRET_KEY to clients/logs.
function cfg() {
  const url=(process.env.SUPABASE_URL||"").replace(/\/$/,"");
  const key=process.env.SUPABASE_SECRET_KEY;
  if(!url||!key) throw new Error("Supabase server connection not configured");
  return {url,key};
}
async function request(path, options={}) {
  const {url,key}=cfg();
  const r=await fetch(url+"/rest/v1/"+path,{
    ...options,
    headers:{apikey:key,Authorization:"Bearer "+key,"Content-Type":"application/json",...(options.headers||{})},
    signal:AbortSignal.timeout(10000)
  });
  if(!r.ok) throw new Error("Supabase request failed: "+r.status);
  const text=await r.text(); return text?JSON.parse(text):null;
}
async function resolveWhatsAppUser(subject){
  const id=encodeURIComponent(String(subject));
  const rows=await request("pa_identities?provider=eq.whatsapp&provider_subject=eq."+id+"&select=user_id,verified_at,pa_users!inner(id,display_name,status)&limit=2");
  if(!Array.isArray(rows)||rows.length!==1||!rows[0].verified_at||rows[0].pa_users?.status!=="active") return null;
  return {id:rows[0].pa_users.id,name:rows[0].pa_users.display_name};
}
async function claimInbound(providerEventId,userId){
  try{
    await request("pa_inbound_events",{method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify({provider:"whatsapp",provider_event_id:providerEventId,user_id:userId,status:"received"})});
    return true;
  }catch(e){ if(String(e.message).includes("409")) return false; throw e; }
}
async function createOAuthState(stateHash,userId){
 await request("pa_oauth_states",{method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify({state_hash:stateHash,user_id:userId,provider:"google",expires_at:new Date(Date.now()+10*60*1000).toISOString()})});
}
async function consumeOAuthState(stateHash){
 const rows=await request("pa_oauth_states?state_hash=eq."+encodeURIComponent(stateHash)+"&provider=eq.google&consumed_at=is.null&expires_at=gt."+encodeURIComponent(new Date().toISOString())+"&select=id,user_id&limit=1");
 if(!Array.isArray(rows)||rows.length!==1) return null;
 await request("pa_oauth_states?id=eq."+rows[0].id,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({consumed_at:new Date().toISOString()})});
 return rows[0];
}
async function upsertConnectedAccount(row){
 return request("pa_connected_accounts?user_id=eq."+row.user_id+"&provider=eq.google_drive",{method:"DELETE",headers:{Prefer:"return=minimal"}}).then(()=>request("pa_connected_accounts",{method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify(row)}));
}
module.exports={resolveWhatsAppUser,claimInbound,createOAuthState,consumeOAuthState,upsertConnectedAccount};

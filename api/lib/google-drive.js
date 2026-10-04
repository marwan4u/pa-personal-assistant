const crypto=require("node:crypto");
const {getConnectedAccount}=require("./supabase-server");
function decrypt(ref){
 if(!ref?.startsWith("enc:v1:")) throw new Error("Google credential unavailable");
 const [iv,tag,data]=ref.slice(7).split(".");
 const key=Buffer.from(process.env.PA_TOKEN_ENCRYPTION_KEY||"","hex");
 const d=crypto.createDecipheriv("aes-256-gcm",key,Buffer.from(iv,"base64")); d.setAuthTag(Buffer.from(tag,"base64"));
 return Buffer.concat([d.update(Buffer.from(data,"base64")),d.final()]).toString("utf8");
}
async function accessToken(userId){
 const a=await getConnectedAccount(userId,"google_drive"); if(!a) throw new Error("Drive not connected");
 const r=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:process.env.GOOGLE_CLIENT_ID,client_secret:process.env.GOOGLE_CLIENT_SECRET,refresh_token:decrypt(a.token_secret_reference),grant_type:"refresh_token"})});
 if(!r.ok) throw new Error("Google refresh failed "+r.status); return (await r.json()).access_token;
}
async function listChildren(token,parentId){
 const q="'"+parentId.replace(/'/g,"\\'")+"' in parents and trashed=false";
 const p=new URLSearchParams({q,fields:"files(id,name,mimeType,modifiedTime)",pageSize:"100",orderBy:"modifiedTime desc"});
 const r=await fetch("https://www.googleapis.com/drive/v3/files?"+p,{headers:{Authorization:"Bearer "+token}});
 if(!r.ok) throw new Error("Drive list failed "+r.status); return (await r.json()).files||[];
}
async function findFolder(token,name){
 const q="mimeType='application/vnd.google-apps.folder' and name='"+name.replace(/'/g,"\\'")+"' and trashed=false";
 const p=new URLSearchParams({q,fields:"files(id,name)",pageSize:"10"});
 const r=await fetch("https://www.googleapis.com/drive/v3/files?"+p,{headers:{Authorization:"Bearer "+token}});
 if(!r.ok) throw new Error("Drive folder search failed "+r.status); return (await r.json()).files?.[0]||null;
}
async function searchGPTStorage(userId,terms){
 const token=await accessToken(userId), folder=await findFolder(token,"gpt storage"); if(!folder) return {folderFound:false,files:[]};
 const files=await listChildren(token,folder.id); const needles=(terms||[]).map(x=>x.toLowerCase()).filter(Boolean);
 const ranked=files.map(f=>({f,score:needles.reduce((s,n)=>s+(f.name.toLowerCase().includes(n)?1:0),0)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,10).map(x=>x.f);
 return {folderFound:true,folderId:folder.id,files:ranked};
}
module.exports={searchGPTStorage};

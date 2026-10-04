const crypto=require("node:crypto");
const {consumeOAuthState,upsertConnectedAccount}=require("../../lib/supabase-server");
function encrypt(value){
 const key=Buffer.from(process.env.PA_TOKEN_ENCRYPTION_KEY||"","hex");
 if(key.length!==32) throw new Error("Token encryption key not configured");
 const iv=crypto.randomBytes(12), cipher=crypto.createCipheriv("aes-256-gcm",key,iv);
 const data=Buffer.concat([cipher.update(value,"utf8"),cipher.final()]);
 return [iv.toString("base64"),cipher.getAuthTag().toString("base64"),data.toString("base64")].join(".");
}
module.exports=async function(req,res){
 if(req.method!=="GET") return res.status(405).send("Method not allowed");
 if(req.query.error) return res.status(400).send("Google authorization was not completed.");
 const code=String(req.query.code||""), state=String(req.query.state||"");
 if(!code||!state) return res.status(400).send("Missing authorization response.");
 const hash=crypto.createHash("sha256").update(state).digest("hex");
 const pending=await consumeOAuthState(hash); if(!pending) return res.status(400).send("Authorization link expired or already used.");
 const tokenRes=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({code,client_id:process.env.GOOGLE_CLIENT_ID,client_secret:process.env.GOOGLE_CLIENT_SECRET,redirect_uri:"https://pa-personal-assistant.vercel.app/api/auth/google/callback",grant_type:"authorization_code"})});
 if(!tokenRes.ok) return res.status(502).send("Google token exchange failed.");
 const tok=await tokenRes.json(); if(!tok.refresh_token) return res.status(502).send("Google did not return long-term authorization. Please retry.");
 const infoRes=await fetch("https://openidconnect.googleapis.com/v1/userinfo",{headers:{Authorization:"Bearer "+tok.access_token}});
 const info=infoRes.ok?await infoRes.json():{};
 await upsertConnectedAccount({user_id:pending.user_id,provider:"google_drive",provider_subject:info.email||info.sub||"google",status:"active",token_secret_reference:"enc:v1:"+encrypt(tok.refresh_token)});
 res.status(200).send("Google Drive authorization successful. You can close this page and return to ChatGPT.");
};
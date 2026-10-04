const crypto=require("node:crypto");
const {createOAuthState}=require("../../lib/supabase-server");
const MARWAN_USER_ID="288afbc0-e73a-44e1-9fb8-dd2edfb0675d";
module.exports=async function(req,res){
 if(req.method!=="GET") return res.status(405).send("Method not allowed");
 if(!process.env.GOOGLE_CLIENT_ID) return res.status(503).send("Google OAuth not configured");
 const state=crypto.randomBytes(32).toString("hex");
 const hash=crypto.createHash("sha256").update(state).digest("hex");
 await createOAuthState(hash,MARWAN_USER_ID);
 const p=new URLSearchParams({client_id:process.env.GOOGLE_CLIENT_ID,redirect_uri:"https://pa-personal-assistant.vercel.app/api/auth/google/callback",response_type:"code",access_type:"offline",prompt:"consent",state,scope:"openid email https://www.googleapis.com/auth/drive"});
 res.redirect(302,"https://accounts.google.com/o/oauth2/v2/auth?"+p.toString());
};
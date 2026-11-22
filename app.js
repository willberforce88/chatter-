// Chatter — Supabase browser client. Publishable keys are designed for client use;
// protect all data with Row Level Security. Never put a service_role/secret key here.
const SUPABASE_URL = "https://apavasfglpszgvpqkpup.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_QTM5OpUOfh4UHVXnK7BwUA_-kPooH3-";
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});

const $ = id => document.getElementById(id);
let currentUser = null, currentProfile = null, activeConversation = null;
let conversations = [], channel = null, typingChannel = null, typingTimer = null;
let chatMode = "direct", authMode = "signup";
const colors = ["linear-gradient(145deg,#9ac7fa,#6b83d8)","linear-gradient(145deg,#f3b58c,#d979a4)","linear-gradient(145deg,#82d6bd,#45a88e)","linear-gradient(145deg,#b8a0f5,#7865cf)"];

function toast(message){const el=$("toast");el.textContent=message;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2800)}
function initials(name){return (name||"?").trim().slice(0,1).toUpperCase()}
function timeLabel(value){return new Date(value).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}

function internalAuthEmail(username){
  // Supabase Auth requires an email or phone identifier. This deterministic,
  // non-deliverable address lets the UI use username + password without collecting email.
  return username.toLowerCase()+"@chatter.invalid";
}
function setAuthMode(mode){
  authMode=mode;
  $("signup-tab").classList.toggle("active",mode==="signup");
  $("login-tab").classList.toggle("active",mode==="login");
  $("first-name-label").hidden=mode!=="signup";
  $("last-name-label").hidden=mode!=="signup";
  $("username-hint").hidden=mode!=="signup";
  $("auth-password").autocomplete=mode==="signup"?"new-password":"current-password";
  $("auth-password").placeholder=mode==="signup"?"At least 8 characters":"Your password";
  $("auth-submit").textContent=mode==="signup"?"Create my account":"Log in";
  $("auth-message").textContent="";
}
$("signup-tab").onclick=()=>setAuthMode("signup");
$("login-tab").onclick=()=>setAuthMode("login");

$("auth-form").addEventListener("submit",async e=>{
  e.preventDefault();
  const username=$("auth-username").value.trim().replace(/^@/,"").toLowerCase();
  const password=$("auth-password").value;
  const message=$("auth-message"),submit=$("auth-submit");
  if(!/^[a-z0-9_]{3,20}$/.test(username)){
    message.textContent="Username must be 3–20 characters using letters, numbers or underscores.";return;
  }
  if(password.length<8){message.textContent="Your password must be at least 8 characters.";return}
  submit.disabled=true;message.textContent="Please wait…";
  try{
    if(authMode==="signup"){
      const first_name=$("auth-first-name").value.trim();
      const last_name=$("auth-last-name").value.trim();
      if(!first_name||!last_name)throw new Error("Please enter your first and last name.");
      const {data:available,error:availabilityError}=await db.rpc("is_username_available",{p_username:username});
      if(availabilityError)throw new Error("Username check isn't set up yet. Run the Chatter SQL setup in Supabase first. ("+availabilityError.message+")");
      if(!available)throw new Error("That username is already taken. Please choose another.");
      const {data:authData,error:authError}=await db.auth.signUp({
        email:internalAuthEmail(username),
        password,
        options:{data:{first_name,last_name,username}}
      });
      if(authError)throw authError;
      if(!authData.session){
        throw new Error("Supabase is still requiring email confirmation. In Supabase, turn OFF Authentication → Providers → Email → Confirm email, then try again.");
      }
      const {data:profile,error:profileError}=await db.rpc("create_chatter_profile",{
        p_first_name:first_name,
        p_last_name:last_name,
        p_username:username
      });
      if(profileError){
        await db.auth.signOut();
        if(profileError.code==="23505")throw new Error("That username has just been claimed. Choose another one.");
        throw new Error("Account created but profile setup failed: "+profileError.message);
      }
      currentUser=authData.user;currentProfile=profile;
      await enterApp(authData.user,profile);
    }else{
      const {data,error}=await db.auth.signInWithPassword({
        email:internalAuthEmail(username),password
      });
      if(error)throw new Error("Username or password is incorrect.");
      await enterApp(data.user);
    }
  }catch(err){message.textContent=err.message||"Something went wrong."}
  finally{submit.disabled=false}
});

async function enterApp(user, knownProfile=null){
  currentUser=user;
  $("auth-screen").hidden=true; $("app-shell").hidden=false;
  if(knownProfile) currentProfile=knownProfile;
  else {
    const {data,error}=await db.from("profiles").select("*").eq("id",user.id).maybeSingle();
    if(error){toast("Couldn't load your profile: "+error.message);return}
    currentProfile=data;
  }
  if(!currentProfile){
    await db.auth.signOut();
    $("app-shell").hidden=true;$("auth-screen").hidden=false;
    $("auth-message").textContent="We couldn't find your Chatter profile. Please create your account again.";
    return;
  }
  $("my-name").textContent=[currentProfile.first_name,currentProfile.last_name].filter(Boolean).join(" ")||currentProfile.username;
  $("my-email").textContent="@"+currentProfile.username;
  $("my-avatar-fallback").textContent=initials(currentProfile.first_name||currentProfile.username);
  await loadConversations();
}
async function loadConversations(){
  const {data:members,error}=await db.from("conversation_members").select("conversation_id,role,conversations(id,title,is_group,created_at)").eq("user_id",currentUser.id);
  if(error){toast("Couldn't load chats: "+error.message);return}
  conversations=(members||[]).map(m=>({...m.conversations,role:m.role})).filter(Boolean);
  await refreshPreviews(); renderConversationList();
}
async function refreshPreviews(){
  for(const c of conversations){
    const {data}=await db.from("messages").select("content,created_at,sender_id,voice_url").eq("conversation_id",c.id).order("created_at",{ascending:false}).limit(1).maybeSingle();
    c.preview=data?(data.voice_url?"🎙 Voice message":data.content||"Message"):"No messages yet";
    c.last_time=data?.created_at||c.created_at;
  }
}
function chatName(c){return c.is_group?(c.title||"Group chat"):(c.other_name||"Direct message")}
function renderConversationList(){
  const q=$("search").value.toLowerCase(); $("chat-list").innerHTML="";
  conversations.filter(c=>chatName(c).toLowerCase().includes(q)).sort((a,b)=>new Date(b.last_time||b.created_at)-new Date(a.last_time||a.created_at)).forEach((c,i)=>{
    const b=document.createElement("button");b.className="chat-item"+(activeConversation?.id===c.id?" active":"");
    const label=chatName(c), avatar=c.other_avatar;
    b.innerHTML=`<div class="avatar" style="background:${colors[i%colors.length]}">${initials(label)}</div><div class="chat-meta"><strong></strong><span></span></div><span class="chat-time">${c.last_time?timeLabel(c.last_time):""}</span>`;
    b.querySelector("strong").textContent=label;b.querySelector(".chat-meta span").textContent=c.preview||"No messages yet";
    if(avatar){const img=document.createElement("img");img.className="avatar";img.src=avatar;img.alt="";b.replaceChild(img,b.firstChild)}
    b.onclick=()=>openConversation(c);$("chat-list").appendChild(b);
  });
  if(!$("chat-list").children.length){const p=document.createElement("p");p.className="empty-state";p.textContent="No chats yet. Press + to find someone."; $("chat-list").appendChild(p)}
}
async function hydrateConversation(c){
  if(c.is_group)return c;
  const {data:members}=await db.from("conversation_members").select("user_id").eq("conversation_id",c.id);
  const other=(members||[]).find(m=>m.user_id!==currentUser.id);
  if(other){const {data:p}=await db.from("profiles").select("username,avatar_url").eq("id",other.user_id).maybeSingle();c.other_name=p?.username||"Chatter user";c.other_avatar=p?.avatar_url}
  return c;
}
async function openConversation(c){
  activeConversation=await hydrateConversation(c);
  $("chat-title").textContent=chatName(activeConversation);$("chat-status").textContent=activeConversation.is_group?"Group conversation":"Private conversation";
  $("header-avatar").textContent=initials(chatName(activeConversation));$("header-avatar").hidden=false;
  $("header-avatar-img").hidden=true;
  if(activeConversation.other_avatar){$("header-avatar").hidden=true;$("header-avatar-img").src=activeConversation.other_avatar;$("header-avatar-img").hidden=false}
  $("message-input").disabled=false;document.querySelector("#composer button[type=submit]").disabled=false;
  $("composer-hint").textContent="Messages are delivered in real time";
  $("app-shell").classList.add("chat-open");renderConversationList();
  await loadMessages(); subscribeToConversation();
  await db.from("message_reads").upsert([], {onConflict:"message_id,user_id"}).then(()=>{}).catch(()=>{});
}
async function loadMessages(){
  const {data,error}=await db.from("messages").select("id,content,voice_url,sender_id,created_at").eq("conversation_id",activeConversation.id).order("created_at",{ascending:true}).limit(200);
  if(error){toast("Couldn't load messages: "+error.message);return}
  const {data:members}=await db.from("conversation_members").select("user_id").eq("conversation_id",activeConversation.id);
  const ids=(members||[]).map(m=>m.user_id);
  const {data:profiles}=await db.from("profiles").select("id,username,avatar_url").in("id",ids);
  const profileMap=Object.fromEntries((profiles||[]).map(p=>[p.id,p]));
  const {data:reads}=await db.from("message_reads").select("message_id,user_id").in("message_id",(data||[]).map(m=>m.id).filter(Boolean));
  renderMessages(data||[],profileMap,reads||[]);
}
function renderMessages(rows,profileMap={},reads=[]){
  const area=$("messages");area.innerHTML='<div class="day-divider"><span>MESSAGES</span></div>';
  if(!rows.length){const empty=document.createElement("div");empty.className="empty-state";empty.innerHTML="<div class='empty-illustration'>✦</div><h2>Say hello!</h2><p>This is the beginning of your conversation.</p>";area.appendChild(empty);return}
  rows.forEach(m=>{
    const mine=m.sender_id===currentUser.id,p=profileMap[m.sender_id]||{username:mine?(currentProfile?.username||"You"):"User"};
    const row=document.createElement("div");row.className="message-row"+(mine?" mine":"");
    const avatar=p.avatar_url?`<img class="mini-avatar" src="${p.avatar_url}" alt="">`:`<div class="mini-avatar">${initials(p.username)}</div>`;
    const readCount=reads.filter(r=>r.message_id===m.id&&r.user_id!==m.sender_id).length;
    row.innerHTML=`${mine?"":avatar}<div class="bubble-wrap"><div class="bubble"></div><div class="message-time">${timeLabel(m.created_at)}${mine?` · <span class="read">${readCount?"✓✓ Read":"✓ Sent"}</span>`:""}</div></div>`;
    if(m.voice_url){const audio=document.createElement("audio");audio.controls=true;audio.src=m.voice_url;row.querySelector(".bubble").append("Voice message ",audio)}
    else row.querySelector(".bubble").textContent=m.content||"";
    area.appendChild(row);
  });
  area.scrollTop=area.scrollHeight;
  const unread=rows.filter(m=>m.sender_id!==currentUser.id);
  if(unread.length)db.from("message_reads").upsert(unread.map(m=>({message_id:m.id,user_id:currentUser.id})),{onConflict:"message_id,user_id"}).then(()=>{});
}
function unsubscribe(){if(channel)db.removeChannel(channel);if(typingChannel)db.removeChannel(typingChannel);channel=null;typingChannel=null}
function subscribeToConversation(){
  unsubscribe();const cid=activeConversation.id;
  channel=db.channel("messages-"+cid).on("postgres_changes",{event:"INSERT",schema:"public",table:"messages",filter:`conversation_id=eq.${cid}`},()=>loadMessages()).subscribe();
  typingChannel=db.channel("typing-"+cid).on("postgres_changes",{event:"*",schema:"public",table:"typing_indicators",filter:`conversation_id=eq.${cid}`},payload=>showTyping(payload)).subscribe();
}
function showTyping(payload){
  const record=payload.new;if(!record||record.user_id===currentUser.id)return;
  $("typing-line").hidden=false;$("typing-line").textContent="Someone is typing…";
  clearTimeout(typingTimer);typingTimer=setTimeout(()=>$("typing-line").hidden=true,2200);
}
let typingWriteTimer;
$("message-input").addEventListener("input",()=>{
  if(!activeConversation)return;
  clearTimeout(typingWriteTimer);
  typingWriteTimer=setTimeout(()=>db.from("typing_indicators").upsert({conversation_id:activeConversation.id,user_id:currentUser.id,updated_at:new Date().toISOString()},{onConflict:"conversation_id,user_id"}),250);
});
$("composer").addEventListener("submit",async e=>{
  e.preventDefault();if(!activeConversation)return;
  const input=$("message-input"),content=input.value.trim();if(!content)return;
  input.value="";const {error}=await db.from("messages").insert({conversation_id:activeConversation.id,sender_id:currentUser.id,content});
  if(error){input.value=content;toast("Message not sent: "+error.message)}
  else {const c=conversations.find(x=>x.id===activeConversation.id);if(c){c.preview=content;c.last_time=new Date().toISOString();renderConversationList()}}
});
$("search").addEventListener("input",renderConversationList);
$("sign-out").onclick=async()=>{unsubscribe();await db.auth.signOut();location.reload()};
$("back-button").onclick=()=>$("app-shell").classList.remove("chat-open");
$("chat-info").onclick=()=>{$("profile-dialog-copy").textContent=activeConversation?(activeConversation.is_group?`Group: ${activeConversation.title||"Group chat"}`:`Chat with ${chatName(activeConversation)}`):"Choose a conversation first";$("leave-chat").hidden=!activeConversation?.is_group;$("profile-dialog").showModal()};
$("leave-chat").onclick=async()=>{if(!activeConversation)return;const {error}=await db.from("conversation_members").delete().eq("conversation_id",activeConversation.id).eq("user_id",currentUser.id);if(error)toast(error.message);else{ $("profile-dialog").close();activeConversation=null;await loadConversations();$("messages").innerHTML="";toast("You left the group.")}};
$("new-chat").onclick=$("new-chat-mobile").onclick=()=>{$("new-chat-message").textContent="";$("new-chat-dialog").showModal()};
$("direct-tab").onclick=()=>setChatMode("direct");$("group-tab").onclick=()=>setChatMode("group");
function setChatMode(mode){chatMode=mode;$("direct-tab").classList.toggle("active",mode==="direct");$("group-tab").classList.toggle("active",mode==="group");$("person-label").hidden=mode!=="direct";$("group-title-label").hidden=mode!=="group";$("group-members-label").hidden=mode!=="group";$("create-chat-submit").textContent=mode==="direct"?"Find user and start chat":"Create group"}
$("new-chat-form").addEventListener("submit",async e=>{
  e.preventDefault();$("create-chat-submit").disabled=true;$("new-chat-message").textContent="Working…";
  try{
    let userIds=[];
    if(chatMode==="direct"){
      const username=$("person-username").value.trim().replace(/^@/,"").toLowerCase();
      const {data:person,error}=await db.from("profiles").select("id,username").eq("username",username).maybeSingle();
      if(error||!person)throw new Error("Couldn't find that username. Check the spelling.");
      if(person.id===currentUser.id)throw new Error("You can't start a chat with yourself.");
      userIds=[currentUser.id,person.id];
      const {data:mine}=await db.from("conversation_members").select("conversation_id").eq("user_id",currentUser.id);
      for(const m of mine||[]){
        const {data:other}=await db.from("conversation_members").select("user_id").eq("conversation_id",m.conversation_id);
        if(other?.length===2&&other.some(x=>x.user_id===person.id)){const found=conversations.find(c=>c.id===m.conversation_id);if(found){$("new-chat-dialog").close();await openConversation(found);return}}
      }
    }else{
      const title=$("group-title").value.trim();if(!title)throw new Error("Add a group name.");
      const names=$("group-members").value.split(",").map(x=>x.trim().replace(/^@/,"").toLowerCase()).filter(Boolean);
      const {data:people,error}=await db.from("profiles").select("id,username").in("username",names);
      if(error)throw error;
      const missing=names.filter(n=>!people.some(p=>p.username===n));if(missing.length)throw new Error("Couldn't find: "+missing.join(", "));
      userIds=[...new Set([currentUser.id,...people.map(p=>p.id)])];
      const {data:conv,error:convError}=await db.from("conversations").insert({title,is_group:true,created_by:currentUser.id}).select().single();
      if(convError)throw convError;
      const {error:memberError}=await db.from("conversation_members").insert(userIds.map((id,i)=>({conversation_id:conv.id,user_id:id,role:i===0?"admin":"member"})));
      if(memberError)throw memberError;
      $("new-chat-dialog").close();await loadConversations();const created=conversations.find(c=>c.id===conv.id);if(created)await openConversation(created);toast("Group created!");return;
    }
    const {data:conv,error:convError}=await db.from("conversations").insert({is_group:false,created_by:currentUser.id}).select().single();
    if(convError)throw convError;
    const {error:memberError}=await db.from("conversation_members").insert(userIds.map((id,i)=>({conversation_id:conv.id,user_id:id,role:i===0?"admin":"member"})));
    if(memberError)throw memberError;
    $("new-chat-dialog").close();await loadConversations();const created=conversations.find(c=>c.id===conv.id);if(created)await openConversation(created);toast("Conversation created!");
  }catch(err){$("new-chat-message").textContent=err.message||"Something went wrong."}
  $("create-chat-submit").disabled=false;
});
$("voice-button").onclick=()=>toast("Voice recording and photo uploads are next — we'll configure secure Storage first.");

async function boot(){
  const {data:{session}}=await db.auth.getSession();
  if(session?.user)await enterApp(session.user);
  db.auth.onAuthStateChange(async(event,session)=>{if(event==="SIGNED_IN"&&session?.user&&$("app-shell").hidden)await enterApp(session.user)});
}
boot();

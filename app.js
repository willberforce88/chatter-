const chats = [
  {id:"lorelei",name:"Lorelei",initial:"L",color:"linear-gradient(145deg,#9ac7fa,#6b83d8)",preview:"Haha, that sounds brilliant!",time:"10:42",status:"Usually replies quickly"},
  {id:"lexi",name:"Lexi",initial:"L",color:"linear-gradient(145deg,#f3b58c,#d979a4)",preview:"See you later 😊",time:"Yesterday",status:"Chatter friend"},
  {id:"weekend",name:"Weekend plans",initial:"W",color:"linear-gradient(145deg,#82d6bd,#45a88e)",preview:"Group chat · 3 members",time:"Mon",status:"Group conversation"}
];
let activeChat = "lorelei";
const saved = {};
const $ = id => document.getElementById(id);
function messagesFor(id){ if(!saved[id]) saved[id]=[]; return saved[id]; }
function renderChats(filter=""){
  $("chat-list").innerHTML="";
  chats.filter(c=>c.name.toLowerCase().includes(filter.toLowerCase())).forEach(c=>{
    const b=document.createElement("button"); b.className="chat-item"+(c.id===activeChat?" active":"");
    b.innerHTML=`<div class="avatar" style="background:${c.color}">${c.initial}</div><div class="chat-meta"><strong>${c.name}</strong><span>${c.preview}</span></div><span class="chat-time">${c.time}</span>`;
    b.addEventListener("click",()=>selectChat(c.id)); $("chat-list").appendChild(b);
  });
}
function selectChat(id){
  activeChat=id; const c=chats.find(x=>x.id===id);
  $("chat-title").textContent=c.name; $("chat-status").textContent=c.status;
  $("header-avatar").textContent=c.initial; $("header-avatar").style.background=c.color;
  $("details-avatar").textContent=c.initial; $("details-avatar").style.background=c.color;
  $("details-name").textContent=c.name; $("details-subtitle").textContent=c.id==="weekend"?"Group conversation":"Chatter friend";
  document.querySelector(".app-shell").classList.add("chat-open");
  renderChats($("search").value); renderMessages();
}
function renderMessages(){
  const area=$("messages"); area.innerHTML='<div class="day-divider"><span>TODAY</span></div>';
  messagesFor(activeChat).forEach(m=>{
    const row=document.createElement("div"); row.className="message-row"+(m.mine?" mine":"");
    row.innerHTML=`${m.mine?"":'<div class="mini-avatar">W</div>'}<div class="bubble-wrap"><div class="bubble"></div><div class="message-time">${m.time}${m.mine?' · <span class="read">✓✓ Sent</span>':""}</div></div>`;
    row.querySelector(".bubble").textContent=m.text; area.appendChild(row);
  });
  area.scrollTop=area.scrollHeight;
}
$("composer").addEventListener("submit",e=>{
  e.preventDefault(); const input=$("message-input"); const text=input.value.trim(); if(!text)return;
  const now=new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"});
  messagesFor(activeChat).push({text,mine:true,time:now}); input.value=""; renderMessages();
});
$("search").addEventListener("input",e=>renderChats(e.target.value));
$("new-chat").addEventListener("click",()=>alert("User search and new conversations will be connected when we add Supabase."));
$("voice-button").addEventListener("click",()=>alert("Voice messages will be added in a later step."));
$("back-button").addEventListener("click",()=>document.querySelector(".app-shell").classList.remove("chat-open"));
renderChats(); selectChat("lorelei");

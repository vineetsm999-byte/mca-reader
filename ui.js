
const $ = s => document.querySelector(s);
const esc = s => String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const fmt = n => n==null ? "-" : (n<0?"-":"") + "$" + Math.abs(n).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
const MM = ["","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const dmy = iso => iso ? iso.slice(5,7)+"/"+iso.slice(8,10)+"/"+iso.slice(0,4) : "-";
const short = iso => MM[+iso.slice(5,7)]+" "+(+iso.slice(8,10));
const api = (path, body, raw) => MCA.localApi(path, body, raw);
function toast(t){const e=$("#toast");e.textContent=t;e.classList.add("on");clearTimeout(toast.h);toast.h=setTimeout(()=>e.classList.remove("on"),1400);}
function copyText(text,btn){
  const done=()=>{toast("Copy ho gaya: "+text);if(btn){btn.classList.add("done");btn.textContent="Copied";setTimeout(()=>{btn.classList.remove("done");btn.textContent="Copy"},1200)}};
  const fb=()=>{try{const ta=document.createElement("textarea");ta.value=text;ta.style.position="fixed";ta.style.opacity="0";document.body.appendChild(ta);ta.select();document.execCommand("copy");document.body.removeChild(ta);done()}catch(e){toast("Number: "+text)}};
  try{ if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(text).then(done,fb)}else fb(); }catch(e){fb()}
}
document.addEventListener("click",e=>{const b=e.target.closest("[data-copy]");if(b){e.preventDefault();e.stopPropagation();copyText(b.dataset.copy,b)}});

/* ================= state & navigation ================= */
const S = {view:"new", session:"s"+Date.now(), files:[], reports:[], R:null, tab:"months", threshold:1000};
const NAV=[["new","Naya case"],["cases","Pichle cases"],["lenders","Lender list"],["banks","Banks"],["backup","Backup"]];
function renderNav(){
  $("#nav").innerHTML = NAV.map(n=>`<button class="${S.view===n[0]||(S.view==="report"&&n[0]==="new")?"on":""}" data-v="${n[0]}">${n[1]}</button>`).join("");
}
$("#nav").addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;
  if(b.dataset.v==="new"&&S.R){S.view="report"} else S.view=b.dataset.v; show();});
function show(){
  renderNav();
  ({new:viewNew,report:viewReport,cases:viewCases,lenders:viewLenders,banks:viewBanks,backup:viewBackup})[S.view]();
}

/* ================= Naya case ================= */
function viewNew(){
  $("#main").innerHTML=`
  <div class="drop" id="drop" tabindex="0" role="button" aria-label="PDF chuno"><b>PDF yahan drag karo</b><div class="lead" style="margin:6px 0 0">ya click karke chuno. Ek client ki saari months ki statements ek saath daal sakte ho.</div></div>
  <input type="file" id="fi" accept="application/pdf,.pdf" multiple hidden>
  <div class="card" id="fq" style="margin-top:14px" ${S.files.length?"":"hidden"}><h2><span>Files</span><small id="fcount"></small></h2><div id="flist"></div></div>
  <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><button class="btn primary" id="go" disabled>Analyze karo</button><button class="btn" id="clr">Saaf karo</button><span id="gomsg" class="lead" style="margin:0"></span></div>`;
  const drop=$("#drop"), fi=$("#fi");
  drop.onclick=()=>fi.click(); drop.onkeydown=e=>{if(e.key==="Enter"||e.key===" ")fi.click()};
  drop.ondragover=e=>{e.preventDefault();drop.classList.add("over")}; drop.ondragleave=()=>drop.classList.remove("over");
  drop.ondrop=e=>{e.preventDefault();drop.classList.remove("over");addFiles(e.dataTransfer.files)};
  fi.onchange=()=>{addFiles(fi.files);fi.value=""};
  $("#go").onclick=analyze; $("#clr").onclick=()=>{S.files=[];S.session="s"+Date.now();viewNew()};
  renderFiles();
}
function addFiles(list){
  for(const f of list){ if(!/\.pdf$/i.test(f.name)) continue; if(S.files.some(x=>x.name===f.name)) continue; S.files.push({name:f.name,file:f,state:"wait"}); }
  viewNew(); processQueue();
}
let busy=false;
async function processQueue(){
  if(busy) return; busy=true;
  for(const it of S.files){
    if(it.state!=="wait") continue;
    it.state="busy"; renderFiles();
    try{
      const r = await api(`/api/upload?session=${S.session}&name=${encodeURIComponent(it.name)}`, it.file, true);
      if(r.ok){ it.state="ok"; it.info=r; } else { it.state="err"; it.err = r.error==="bank_unknown" ? "Bank pehchana nahi gaya. 'Banks' tab mein naya bank jodne ka tareeka hai (sample statement Claude ko bhejo)." : r.error; it.hint=r.hint; }
    }catch(e){ it.state="err"; it.err=String(e); }
    renderFiles();
  }
  busy=false;
}
function renderFiles(){
  const fl=$("#flist"); if(!fl) return;
  $("#fq").hidden=!S.files.length;
  fl.innerHTML=S.files.map(f=>{
    let st="", sub="";
    if(f.state==="wait") st=`<span class="pill info">line mein</span>`;
    if(f.state==="busy") st=`<span class="pill warn">padh raha hai...</span>`;
    if(f.state==="ok"){ const i=f.info; const okc=(i.credits_ok!==false&&i.debits_ok!==false);
      st=`<span class="pill ${okc?"ok":"bad"}">${okc?"padh liya":"total match nahi"}</span>`;
      sub=`${esc(i.bank)} · ${esc(i.client)} · ${i.period} · ${i.txns} transactions`+(i.credits_ok===true&&i.debits_ok===true?" · bank ke total se match ✔":""); }
    if(f.state==="err"){ st=`<span class="pill bad">error</span>`; sub=`<span class="err">${esc(f.err)}</span>`+(f.hint?`<br>Pehle page ka text: <code>${esc(f.hint.slice(0,160))}</code>`:""); }
    return `<div class="fileitem"><div>${esc(f.name)}<small>${sub}</small></div>${st}</div>`;}).join("");
  const ok=S.files.filter(f=>f.state==="ok").length, pend=S.files.filter(f=>f.state==="wait"||f.state==="busy").length;
  $("#fcount").textContent=`${ok} / ${S.files.length} ho gayi`;
  $("#go").disabled = !(ok>0 && pend===0);
}
async function analyze(){
  $("#go").disabled=true; $("#gomsg").textContent="Hisaab laga raha hai...";
  const r = await api("/api/analyze",{session:S.session});
  if(!r.ok){ $("#gomsg").textContent=r.error; return; }
  S.reports=r.reports; S.R=r.reports[0]; S.tab="months"; S.view="report"; show();
}

/* ================= Report ================= */
const TABS=[["months","Months"],["mca","MCA positions"],["wires","Wires"],["review","Check karo"]];
function viewReport(){
  const R=S.R; if(!R){S.view="new";return show();}
  S.threshold = R.settings.low_balance||1000;
  const chips = S.reports.length>1 ? `<div class="chips">${S.reports.map((r,i)=>`<button class="${r===S.R?"on":""}" data-i="${i}">${esc(r.meta.client)} · ${esc(r.meta.account)}</button>`).join("")}</div>` : "";
  $("#main").innerHTML=`${chips}
  <div class="card"><div class="row"><div class="lab"><b>${esc(R.meta.client)}</b><small>${esc(R.meta.bank)} · account ${esc(R.meta.account)} · ${esc(R.meta.range)}</small></div><button class="btn sm" id="rean">Dobara chalao</button></div></div>
  <div class="tabs" id="rtabs">${TABS.map(t=>`<button class="${S.tab===t[0]?"on":""}" data-t="${t[0]}">${t[1]}${t[0]==="review"?`<span class="badge">${R.flags.length}</span>`:""}</button>`).join("")}</div>
  <div id="rbody"></div>`;
  $("#rtabs").onclick=e=>{const b=e.target.closest("button");if(!b)return;S.tab=b.dataset.t;viewReport()};
  if(S.reports.length>1) document.querySelector(".chips").onclick=e=>{const b=e.target.closest("button");if(!b)return;S.R=S.reports[+b.dataset.i];S.tab="months";viewReport()};
  $("#rean").onclick=reanalyze;
  ({months:tabMonths,mca:tabMca,wires:tabWires,review:tabReview})[S.tab]();
}
async function reanalyze(){
  toast("Dobara hisaab laga raha hai...");
  const r=await api("/api/case/reanalyze",{id:S.R.case_id});
  if(r.ok){ const i=S.reports.indexOf(S.R); S.reports[i]=r.report; S.R=r.report; viewReport(); toast("Ho gaya"); } else toast(r.error);
}
function copyRow(label,sub,value,cv,cls){
  return `<div class="row"><div class="lab">${label}${sub?`<small>${sub}</small>`:""}</div><div class="valwrap"><span class="val num ${cls||""}">${value}</span>${cv!=null?`<button class="btn sm cp" data-copy="${esc(cv)}" aria-label="Copy ${esc(label)}">Copy</button>`:""}</div></div>`;
}
function tabMonths(){
  const R=S.R;
  let h=`<p class="lead">Tool ke fields isi order mein hain. Number ke saath Copy dabao ya dekh ke type kar do.</p>
  <div class="thr"><label for="thr">Low Blc Days: balance is se kam</label><input id="thr" class="num" type="number" value="${S.threshold}" min="0" step="100"><span>(tool ka rule confirm karna)</span></div>`;
  R.months.forEach(m=>{
    const neg=m.series.filter(x=>x[1]<0).length, low=m.series.filter(x=>x[1]<S.threshold).length;
    const adbOK=m.bank_avg!=null&&Math.abs(m.adb-m.bank_avg)<1;
    const sc=+m.breakdown.reduce((a,x)=>a+x[1],0).toFixed(2);
    const rc=m.recon, rcTxt = rc.credits_ok===null ? `<span class="pill info">bank total nahi (adhura mahina)</span>` : (rc.credits_ok&&rc.debits_ok ? `<span class="pill ok">credits aur debits bank ke total se match ✔</span>` : `<span class="pill bad">bank ke total se match nahi ✘</span>`);
    h+=`<div class="card"><h2><span>${esc(m.month)}</span><small>${dmy(m.start)} – ${dmy(m.end)}</small></h2>
    ${copyRow("Funding Amt","MCA advance credits (naam se pehchane)"+(m.funding?"":" - koi nahi mila"),m.funding?fmt(m.funding):"-",m.funding?m.funding.toFixed(2):null)}
    ${copyRow("Transfers & other deductions",esc(m.transfers_sub),m.transfers?fmt(m.transfers):"-",m.transfers?m.transfers.toFixed(2):null)}
    ${copyRow("Unverified Deposit","Tool ka rule pata nahi. Mobile/ATM/remote deposits is mahine: "+fmt(m.atm),"?",null)}
    ${copyRow("NSF / Neg days",`Negative balance wale din: ${neg} · NSF/overdraft fee: ${m.fee_nsf} · Overdraft transfer: ${m.fee_od} · Sabse kam balance: ${fmt(m.min_bal)}`,neg+" / "+m.fee_nsf,String(neg))}
    ${copyRow("Low Blc Days","Balance &lt; "+fmt(S.threshold)+" (calendar days)",String(low),String(low))}
    ${copyRow("Avg Daily Blc",(m.adb_approx?"Approx (weekend/running balance se). ":"")+(m.bank_avg!=null?(adbOK?`Bank ke chhape average ${fmt(m.bank_avg)} se match <span class="pill ok">ok</span>`:`Bank ne likha: ${fmt(m.bank_avg)} <span class="pill warn">alag</span>`):"Bank ne average nahi chhapa"),fmt(m.adb),m.adb.toFixed(2),m.adb<0?"neg":"")}
    <details><summary class="note" style="cursor:pointer">Credits ka breakdown (total ${fmt(m.total_credits)}) ${rcTxt}</summary>
    <div class="scroll"><table><tbody>${m.breakdown.map(x=>`<tr><td>${esc(x[0])}</td><td class="r num">${fmt(x[1])}</td></tr>`).join("")}</tbody></table></div></details>
    <div class="note">MCA debits is mahine (bounced chhod ke): <b class="num">${fmt(m.mca_debits)}</b></div></div>`;
  });
  h+=`<div class="card"><div class="note" style="border-top:0">Avg Daily Blc: har calendar din ka closing balance bana ke average. Jis din transaction nahi (weekend), pichla balance aage chalta hai. Bank apna average chhaape to wo saath mein dikhaya hai.</div></div>`;
  $("#rbody").innerHTML=h;
  $("#thr").onchange=e=>{S.threshold=Math.max(0,+e.target.value||0);tabMonths()};
}
function timeline(p){
  const R=S.R, s=new Date(R.meta.start+"T00:00:00"), e=new Date(R.meta.end+"T00:00:00"), span=Math.max(1,(e-s)/864e5);
  const W=340,pad=8,x=iso=>pad+((new Date(iso+"T00:00:00")-s)/864e5)/span*(W-2*pad);
  let g="";
  R.months.forEach(m=>{g+=`<line x1="${x(m.start)}" x2="${x(m.start)}" y1="6" y2="40" stroke="var(--line)"/><text x="${x(m.start)+3}" y="52" font-size="10" fill="var(--muted)">${MM[+m.start.slice(5,7)]}</text>`});
  (p.missed||[]).forEach(m=>{g+=`<rect x="${x(m.from)}" y="10" width="${x(m.to)-x(m.from)}" height="22" fill="var(--warn-bg)" stroke="var(--warn)" stroke-dasharray="3 2"/>`});
  const small=(p.small||p.emi||0)*0.5;
  p.pays.forEach(q=>{const cx=x(q.d);
    g+= q.r ? `<g stroke="var(--bad)" stroke-width="2"><line x1="${cx-4}" y1="17" x2="${cx+4}" y2="25"/><line x1="${cx+4}" y1="17" x2="${cx-4}" y2="25"/></g>`
            : `<circle cx="${cx}" cy="21" r="${q.a<small?2.5:3.5}" fill="${q.a<small?"var(--warn)":"var(--dot)"}"/>`;});
  (p.adv||[]).forEach(a=>{const cx=x(a.date);g+=`<path d="M${cx} 38 l-5 -9 h10z" fill="var(--ok)"/>`});
  return `<svg viewBox="0 0 ${W} 58" role="img" aria-label="Payment timeline ${esc(p.lender)}">${g}</svg>`;
}
function tabMca(){
  const R=S.R, act=R.positions.filter(p=>p.status==="Active"), tot=act.reduce((a,p)=>a+(p.monthly||0),0);
  let h=`<div class="sum"><div><b class="num">${act.length}</b><span>Active positions</span></div><div><b class="num">${fmt(tot)}</b><span>Total monthly payment (weekly x4.2, daily x22)</span></div></div>`;
  h+=`<div class="card"><h2><span>Tool ke format mein rows</span><small>seedha dekh ke type karo</small></h2><div class="scroll"><table><thead><tr><th>Month</th><th>Start Date</th><th>Lender</th><th class="r">Amount Funded</th><th>Status</th><th>Frequency</th><th class="r">Repayment</th><th>Last Pmt</th><th class="r">Monthly Pmts</th></tr></thead><tbody>${R.tool_rows.map(r=>`<tr><td>${esc(r.month)}</td><td class="num">${r.start?dmy(r.start):"-"}</td><td>${esc(r.lender)}${r.type?`<br><span class="pill warn">${esc(r.type)}</span>`:""}</td><td class="r num">${r.funded!=null?fmt(r.funded):"-"}</td><td>${esc(r.status)}</td><td>${esc(r.freq)}</td><td class="r num">${fmt(r.repay)}</td><td class="num">${r.last?dmy(r.last):"-"}</td><td class="r num">${fmt(r.monthly)}</td></tr>`).join("")||`<tr><td colspan="9">Koi MCA nahi mila</td></tr>`}</tbody></table></div><div class="note">Funding jin lenders ki statement mein nahi dikhi, unki Start Date aur Amount Funded "-" hai (tool ke sample sheet jaisa).</div></div>`;
  h+=`<p class="lead">Har lender par tap karo: timeline aur proof khulega. Kaala dot = payment, peela = chhota, ✕ = bounce, hara tikon = advance.</p>`;
  R.positions.forEach(p=>{
    const stCls=p.status==="Active"?"ok":"warn";
    const src=p.src==="notes"?`<span class="pill info">tere notes ki list</span>`:`<span class="pill warn">naam keyword se mila, confirm karo</span>`;
    const fa=p.adv&&p.adv.length?p.adv[0]:null;
    h+=`<details class="pos"><summary><div class="ph"><b>${esc(p.lender)}</b><span class="val num">${p.emi!=null?fmt(p.emi):"-"} <small style="font-weight:400;color:var(--muted)">${esc(p.freq)}</small></span></div>
    <div class="pm"><span class="pill ${stCls}">${esc(p.status)}</span> ${p.type_draft?`<span class="pill warn">${esc(p.type_draft)}</span> `:""}${fa?`Pehla advance ${fmt(fa.amount)} on ${short(fa.date)} · ${p.adv.length} advance`:`Funding statement mein nahi dikhi, start date "-"`}</div></summary>
    <dl class="kv">
      <dt>Start Date</dt><dd class="num">${fa?dmy(fa.date):"-"}${fa?` <button class="btn sm cp" data-copy="${dmy(fa.date)}">Copy</button>`:""}</dd>
      <dt>Amount Funded</dt><dd class="num">${p.adv&&p.adv.length?fmt(p.adv_total)+(p.adv.length>1?" (total)":""):"-"}${p.adv&&p.adv.length?` <button class="btn sm cp" data-copy="${p.adv_total.toFixed(2)}">Copy</button>`:""}</dd>
      <dt>Frequency</dt><dd>${esc(p.freq)}</dd>
      <dt>Repayment</dt><dd class="num">${p.emi!=null?fmt(p.emi):"-"}${p.emi!=null?` <button class="btn sm cp" data-copy="${p.emi.toFixed(2)}">Copy</button>`:""}</dd>
      <dt>Monthly Pmts</dt><dd class="num">${fmt(p.monthly)}</dd>
      <dt>Date of Last Payment</dt><dd class="num">${p.last?dmy(p.last)+" ("+fmt(p.last_amt)+")":"-"}</dd>
      <dt>Pehla payment dikha</dt><dd class="num">${p.first?dmy(p.first):"-"}</dd>
      <dt>Payments gine</dt><dd class="num">${p.count} · kul ${fmt(p.total)}${p.pno?` · Payment #${p.pno[0]} se #${p.pno[1]}`:""}</dd>
    </dl>
    ${p.note?`<div class="note">${esc(p.note)}</div>`:""}
    <div class="tl">${timeline(p)}<div class="lg">${src}</div></div>
    ${p.missed&&p.missed.length?`<div class="note">Payment skip dikhi: ${p.missed.map(m=>dmy(m.from)+" se "+dmy(m.to)+" ("+m.days+" din)").join(", ")}</div>`:""}
    ${p.streams&&p.streams.length>1?`<div class="sub">EMI streams</div><div class="scroll"><table><tbody>${p.streams.map(s=>`<tr><td class="num">${fmt(s.amount)}</td><td>${esc(s.freq)}</td><td class="r num">${s.count} payments</td></tr>`).join("")}</tbody></table></div>`:""}
    ${p.adv_rows&&p.adv_rows.length?`<div class="sub">Advances</div><div class="scroll"><table><tbody>${p.adv_rows.map(a=>`<tr><td class="num">${dmy(a.date)}</td><td class="r num">${fmt(a.amount)}</td><td><span class="pill ${a.conf==="draft"?"ok":"warn"}">${esc(a.type)}</span>${a.emi_before!=null||a.emi_after!=null?`<br><small class="num">EMI ${a.emi_before!=null?fmt(a.emi_before):"-"} → ${a.emi_after!=null?fmt(a.emi_after):"-"}</small>`:""}</td></tr>`).join("")}</tbody></table></div>`:""}
    ${p.wire_candidates&&p.wire_candidates.length?`<div class="sub">Possible advance wires (start se 7 din pehle, sender naam nahi)</div><div class="scroll"><table><tbody>${p.wire_candidates.map(w=>`<tr><td class="num">${dmy(w.date)}</td><td class="r num">${fmt(w.amount)}</td></tr>`).join("")}</tbody></table></div>`:""}
    <div class="sub">Payments (proof)</div><div class="scroll"><table><tbody>${p.pays.map(q=>`<tr><td class="num">${dmy(q.d)}</td><td class="r num">${fmt(q.a)}</td><td>${q.r?`<span class="pill bad">bounced</span>`:(p.small&&q.a<p.small*0.5?`<span class="pill warn">chhota</span>`:"")}${q.n?` #${q.n}`:""}</td></tr>`).join("")||`<tr><td>Koi debit nahi dikha</td></tr>`}</tbody></table></div>
    <div style="height:6px"></div></details>`;
  });
  if(R.loans.length) h+=`<div class="card"><h2><span>Loan jaise lag rahe hain</span><small>MCA nahi gine</small></h2><div class="scroll"><table><thead><tr><th>Naam</th><th>Amount</th><th>Kitni baar</th><th></th></tr></thead><tbody>${R.loans.map(l=>`<tr><td>${esc(l.name)}${l.kind==="REVIEW"?` <span class="pill warn">friend decide</span>`:""}</td><td class="num">${l.amounts.length>2?fmt(l.amounts[0])+" - "+fmt(l.amounts[l.amounts.length-1]):l.amounts.map(fmt).join(", ")}</td><td>${l.count}x ${esc(l.freq)}</td><td>${l.kind==="REVIEW"?`<button class="btn sm" data-mk="${esc(l.name)}" data-kind="MCA">MCA hai</button> <button class="btn sm" data-mk="${esc(l.name)}" data-kind="NOT_MCA">MCA nahi</button>`:""}</td></tr>`).join("")}</tbody></table></div></div>`;
  if(R.unknown.length) h+=`<div class="card"><h2><span>Naye lender? (repeat hone wale debits)</span><small>tool ko sikhao</small></h2><div class="scroll"><table><thead><tr><th>Descriptor</th><th class="r">Amount</th><th>Kitni baar</th><th></th></tr></thead><tbody>${R.unknown.map((u,i)=>`<tr><td>${esc(u.sample)}${u.keyword?` <span class="pill warn">naam mein fund/capital...</span>`:""}</td><td class="r num">${fmt(u.amount)}</td><td>${u.count}x ${esc(u.freq)}</td><td><button class="btn sm" data-uk="${i}" data-kind="MCA">MCA hai</button> <button class="btn sm" data-uk="${i}" data-kind="NOT_MCA">MCA nahi</button></td></tr>`).join("")}</tbody></table></div><div class="note">'MCA hai' dabaoge to ye naam lender list mein jud jaayega aur hisaab dobara lagega.</div></div>`;
  $("#rbody").innerHTML=h;
  $("#rbody").onclick=async e=>{
    const b=e.target.closest("button"); if(!b) return;
    if(b.dataset.mk){ await api("/api/lenders/setkind",{name:b.dataset.mk,kind:b.dataset.kind}); await reanalyze(); }
    if(b.dataset.uk!==undefined){ const u=R.unknown[+b.dataset.uk];
      const pat=u.key.split(" ").map(w=>w.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")).join(".{0,25}");
      await api("/api/lenders/add",{name:u.key.replace(/\b\w/g,c=>c.toUpperCase()),pattern:pat,kind:b.dataset.kind}); await reanalyze(); }
  };
}
function tabWires(){
  const R=S.R, sumIn=R.wires_in.reduce((a,w)=>a+w.amount,0), sumOut=R.wires_out.reduce((a,w)=>a+w.amount,0);
  let h=`<p class="lead">Incoming wires mein bahut baar sender ka naam nahi aata. Jahan naam hai (MCA funder ka) wo hara dikhta hai.</p>
  <div class="sum"><div><b class="num">${R.wires_in.length}</b><span>Incoming wires · ${fmt(sumIn)}</span></div><div><b class="num">${R.wires_out.length}</b><span>Outgoing wires · ${fmt(sumOut)}</span></div></div>`;
  const cand=new Set(); R.positions.forEach(p=>(p.wire_candidates||[]).forEach(w=>cand.add(w.date+"|"+w.amount)));
  const clean=d=>d.replace(/ Ref#\S+/,"").replace(/ Trn#.*$/,"").replace(/ Srf#.*$/,"");
  const group=(arr,title,flag)=>{
    let o=`<div class="card"><h2><span>${title}</span></h2>`;
    if(!arr.length) o+=`<div class="note" style="border-top:0">Koi nahi</div>`;
    [...new Set(arr.map(w=>w.month))].forEach(m=>{const items=arr.filter(w=>w.month===m).sort((a,b)=>a.date<b.date?-1:1);
      o+=`<div class="sub">${esc(m)} · ${items.length} · ${fmt(items.reduce((a,w)=>a+w.amount,0))}</div><div class="scroll"><table><tbody>${items.map(w=>`<tr><td class="num">${dmy(w.date)}</td><td class="r num">${fmt(w.amount)}</td><td>${w.named?`<span class="pill ok">${esc(w.lender)}</span>`:""}${flag&&cand.has(w.date+"|"+w.amount)?`<span class="pill warn">advance ho sakti hai</span>`:""} <small>${esc(clean(w.desc))}</small></td></tr>`).join("")}</tbody></table></div>`});
    return o+"</div>";};
  h+=group(R.wires_in,"Incoming wires / instant payments",true)+group(R.wires_out,"Outgoing wires",false);
  $("#rbody").innerHTML=h;
}
function tabReview(){
  const R=S.R;
  $("#rbody").innerHTML=`<p class="lead">Jahan tool pakka nahi hai, wahan friend ko khud dekhna hai.</p><div class="card">${R.flags.map(x=>`<div class="flag"><span class="pill ${x.c}">${x.c==="bad"?"zaroori":x.c==="warn"?"check":"info"}</span><div>${esc(x.t)}<small>${esc(x.s)}</small></div></div>`).join("")}</div>`;
}

/* ================= Pichle cases ================= */
async function viewCases(){
  $("#main").innerHTML=`<p class="lead">Loading...</p>`;
  const cs=await api("/api/cases");
  $("#main").innerHTML=`<div class="card"><h2><span>Pichle cases</span><small>${cs.length}</small></h2>${cs.length?cs.map(c=>`<div class="row"><div class="lab"><b>${esc(c.client)}</b><small>${esc(c.bank)} · ${esc(c.range)} · ${c.positions} MCA · ${esc(c.created)}</small></div><div><button class="btn sm" data-o="${esc(c.id)}">Kholo</button> <button class="btn sm" data-d="${esc(c.id)}">Hatao</button></div></div>`).join(""):`<div class="note" style="border-top:0">Abhi koi case nahi.</div>`}</div>`;
  $("#main").onclick=async e=>{const b=e.target.closest("button");if(!b)return;
    if(b.dataset.o){ const r=await api("/api/case?id="+encodeURIComponent(b.dataset.o)); S.reports=[r]; S.R=r; S.tab="months"; S.view="report"; show(); }
    if(b.dataset.d){ if(confirm("Ye case hata du?")){ await api("/api/case/delete",{id:b.dataset.d}); viewCases(); } } };
}

/* ================= Lender list ================= */
let LEND=[];
const KINDS=[["MCA","MCA"],["REVERSE","Reverse lender"],["REVIEW","Friend decide"],["LOAN","Loan (MCA nahi)"],["NOT_MCA","MCA nahi"]];
async function viewLenders(){ LEND=await api("/api/lenders"); drawLenders(); }
function syncLenders(){
  document.querySelectorAll("#lt tbody tr").forEach(tr=>{const L=LEND[+tr.dataset.i];
    tr.querySelectorAll("[data-f]").forEach(el=>{const v=el.value;
      if(el.dataset.f==="forced_freq"){ if(v) L.forced_freq=v; else delete L.forced_freq; } else L[el.dataset.f]=v; });});
}
function drawLenders(){
  $("#main").innerHTML=`<p class="lead">Yahan se lenders jodo, badlo ya hatao. <b>Pattern</b> text mein dhundha jaata hai (capital/small ka farak nahi), kai naam <code>|</code> se alag karo, jaise <code>fundbox|fund box</code>. Jo upar hai wo pehle match hota hai.</p>
  <div class="card"><h2><span>Lender list</span><small>${LEND.length} entries</small></h2>
  <div class="scroll"><table id="lt"><thead><tr><th>Naam</th><th>Pattern</th><th>Kya hai</th><th>Frequency fix</th><th></th></tr></thead><tbody>${LEND.map((L,i)=>`<tr data-i="${i}"><td><input class="fld" style="width:170px" value="${esc(L.name)}" data-f="name"></td><td><input class="fld" style="width:210px" value="${esc(L.pattern)}" data-f="pattern"></td><td><select class="fld" data-f="kind">${KINDS.map(k=>`<option value="${k[0]}" ${L.kind===k[0]?"selected":""}>${k[1]}</option>`).join("")}</select></td><td><select class="fld" data-f="forced_freq"><option value="">auto</option>${["Daily","Twice weekly","Weekly","Bi-weekly","Monthly"].map(f=>`<option ${L.forced_freq===f?"selected":""}>${f}</option>`).join("")}</select></td><td><button class="btn sm" data-del="${i}">Hatao</button></td></tr>`).join("")}</tbody></table></div>
  <div class="note"><button class="btn" id="addrow">+ Naya lender</button> <button class="btn primary" id="savel">Save karo</button> <span id="lmsg"></span></div></div>
  <div class="card"><div class="note" style="border-top:0">Source: <b>notes</b> = tere handwritten notes ki list, <b>keyword</b> = naam mein fund/capital wagairah dekh ke jodi (confirm karna), <b>added</b> = tumne yahan se jodi.</div></div>`;
  $("#main").onclick=async e=>{const b=e.target.closest("button");if(!b)return;
    if(b.dataset.del!==undefined){syncLenders();LEND.splice(+b.dataset.del,1);drawLenders();}
    else if(b.id==="addrow"){syncLenders();LEND.unshift({name:"Naya lender",pattern:"naya naam",kind:"MCA",src:"added"});drawLenders();}
    else if(b.id==="savel"){syncLenders();
      const bad=LEND.find(L=>{try{new RegExp(L.pattern);return false}catch(x){return true}});
      if(bad){$("#lmsg").textContent="Pattern galat hai: "+bad.name;return}
      const r=await api("/api/lenders",LEND);
      $("#lmsg").textContent=r.ok?"Save ho gaya. Naye case mein lagega; purane case par 'Dobara chalao' dabao.":("Error: "+r.error);}};
}

/* ================= Banks ================= */
async function viewBanks(){
  const b=await api("/api/banks");
  $("#main").innerHTML=`<div class="card"><h2><span>Jo banks padh sakta hai</span><small>${b.banks.length}</small></h2>${b.banks.map(n=>`<div class="row"><div class="lab">${esc(n)}</div><span class="pill ok">ready</span></div>`).join("")}${b.errors.length?`<div class="note err">Load nahi hue: ${esc(b.errors.join("; "))}</div>`:""}</div>
  <div class="card"><h2><span>Naya bank kaise jodein</span></h2><div class="note" style="border-top:0;line-height:1.7">
  1. Us bank ki ek sample statement (PDF) Claude ko bhejo aur bolo: "iska parser banao, js/banks/_template.js.txt ke format mein".<br>
  2. Claude jo <code>.js</code> file de, usko repo ke <code>js/banks/</code> folder mein daalo (jaise <code>chase.js</code>).<br>
  3. <code>js/banks/registry.js</code> kholo aur list mein naam jodo: <code>["pnc","wells_fargo","rbfcu","rbfcu_online","chase"]</code>.<br>
  4. GitHub par save (commit) karo. 1-2 minute mein site update ho jaati hai. Page refresh karo (Ctrl+F5).<br>
  Jab tak parser nahi jodta, us bank ki PDF par "Bank pehchana nahi gaya" aayega.</div></div>`;
}

/* ================= Backup ================= */
function dl(name,text){const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([text],{type:"application/json"}));a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500);}
function viewBackup(){
  $("#main").innerHTML=`<div class="card"><h2><span>Backup aur restore</span></h2><div class="note" style="border-top:0;line-height:1.6">Tera lender list aur saare cases is browser mein hi save hote hain (kisi server par nahi). Browser data saaf karoge ya dusre computer par jaoge to wo nahi milenge, isliye ek backup file download karke rakh lo.</div>
  <div class="row"><div class="lab">Backup download karo<small>lender list + saare cases (ek .json file)</small></div><button class="btn" id="bk">Download</button></div>
  <div class="row"><div class="lab">Backup wapas lao<small>pehle download ki hui .json file chuno</small></div><button class="btn" id="rs">File chuno</button><input type="file" id="rsf" accept=".json,application/json" hidden></div>
  <div class="row"><div class="lab">Lender list shuru wali kar do<small>jo tumne jodi/badli wo hat jaayengi</small></div><button class="btn" id="rst">Reset</button></div><div class="note" id="bkmsg"></div></div>`;
  $("#bk").onclick=()=>{dl("mca_backup_"+new Date().toISOString().slice(0,10)+".json",MCA.exportAll());$("#bkmsg").textContent="Download ho gaya. Is file ko safe jagah rakhna (isme client ka data hai)."};
  $("#rs").onclick=()=>$("#rsf").click();
  $("#rsf").onchange=async e=>{const f=e.target.files[0];if(!f)return;try{const r=MCA.importAll(await f.text());$("#bkmsg").textContent=`Wapas aa gaya: ${r.lenders} lenders, ${r.cases} naye cases.`}catch(x){$("#bkmsg").textContent="File sahi nahi lag rahi: "+x.message}};
  $("#rst").onclick=()=>{if(confirm("Lender list shuru wali kar du?")){MCA.resetLenders();$("#bkmsg").textContent="Ho gaya."}};
}
window.startUI = show;

const $ = id => document.getElementById(id);
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = n => Number(n).toLocaleString('en-NG');
const percent = (n,d) => d ? `${(100*n/d).toFixed(1)}%` : '—';
const date = value => new Date(value).toLocaleString('en-NG',{dateStyle:'medium',timeStyle:'short',timeZone:'Africa/Lagos'})+' WAT';
const labels = {pending:'Pending review',verified:'Verified',disputed:'Disputed'};
let directory={}, records=[], selectedState='', selectedLga='', online=false, roles=[], auth, inviteToken, callbackMode;
async function api(method='GET',body,id='') {
 const response=await fetch('/api/results'+(id?'?id='+encodeURIComponent(id):''),{method,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,cache:'no-store'});
 let data;try{data=await response.json();}catch{throw Error('The results service is unavailable. Please retry.');}
 if(!response.ok) throw Error(data.error||'Request failed. Please retry.');return data;
}
function paintMap(){document.querySelectorAll('#map path').forEach(path=>{path.classList.toggle('active',path.dataset.state===selectedState);path.classList.toggle('reported',records.some(r=>r.state===path.dataset.state));path.setAttribute('aria-pressed',String(path.dataset.state===selectedState));});}
function renderList(){
 $('state-title').textContent=selectedState||'Select a state';
 const all=directory[selectedState]||[];const list=all.filter(l=>l.toLowerCase().includes($('search').value.toLowerCase().trim()));
 $('lga-count').textContent=selectedState?`${list.length} / ${all.length} LGAs`:'';
 $('lga-list').innerHTML=!selectedState?'<p class="empty">Choose a state on the map or from the menu.</p>':!list.length?'<p class="empty">No local governments match your search.</p>':list.map(l=>{const r=records.find(r=>r.state===selectedState&&r.lga===l);return `<button class="lga-row ${l===selectedLga?'active':''}" data-lga="${escape(l)}" aria-pressed="${l===selectedLga}"><span>${escape(l)}</span><small>${r?labels[r.status]||'Pending review':online?'Awaiting upload':'Status unavailable'} →</small></button>`;}).join('');
 $('lga-list').querySelectorAll('button').forEach(b=>b.onclick=()=>selectLga(b.dataset.lga,true));
}
function selectState(state){if(!state){selectedState='';selectedLga='';$('search').value='';paintMap();renderList();$('detail').innerHTML='<h2>Choose a state to explore its results.</h2>';const url=new URL(location.href);url.searchParams.delete('state');url.searchParams.delete('lga');history.replaceState(null,'',url);return;}if(!directory[state])return;selectedState=state;selectedLga='';$('state').value=state;$('search').value='';paintMap();renderList();$('detail').innerHTML=`<p class="eyebrow">03 / ${escape(state.toUpperCase())}</p><h2>Choose a local government.</h2><p class="muted">Explore ${directory[state].length} local governments and their result evidence.</p>`;updateUrl();}
function updateUrl(){const url=new URL(location.href);if(selectedState)url.searchParams.set('state',selectedState);if(selectedLga)url.searchParams.set('lga',selectedLga);else url.searchParams.delete('lga');history.replaceState(null,'',url);}
async function selectLga(lga,scroll=false){
 if(!directory[selectedState]?.includes(lga))return;selectedLga=lga;renderList();updateUrl();
 const r=records.find(r=>r.state===selectedState&&r.lga===lga);
 const heading=`<p class="eyebrow">03 / LGA RESULTS · ${escape(selectedState.toUpperCase())}</p><div class="panel-title"><h2>${escape(lga)}</h2><span class="badge ${r?escape(r.status):''}">${r?labels[r.status]||'Pending review':online?'Awaiting upload':'Service unavailable'}</span></div>`;
 if(!r){$('detail').innerHTML=heading+`<p class="empty">${online?'No 2027 presidential result has been uploaded for this local government. Vote totals, turnout, and party analytics appear here once an administrator uploads a source-backed result.':'Result availability cannot be checked right now. Retry the results service above.'}</p>`;if(scroll)$('detail').scrollIntoView({behavior:'smooth',block:'start'});return;}
 const parties=Object.entries(r.votes).sort((a,b)=>b[1]-a[1]);const valid=parties.reduce((n,p)=>n+p[1],0);const cast=valid+r.rejected;
 const tied=parties.length>1&&parties[0][1]===parties[1][1];const margin=parties.length>1?parties[0][1]-parties[1][1]:null;
 $('detail').innerHTML=heading+`<p class="muted">2027 presidential election · Uploaded figures · Version ${r.version} · Updated ${escape(date(r.updatedAt))}</p><div class="analytics"><div><b>${fmt(cast)}</b><span>Total ballots cast</span></div><div><b>${percent(cast,r.registered)}</b><span>Turnout / registered voters</span></div><div><b>${margin===null?'—':fmt(margin)}</b><span>${tied?'Tied highest vote totals':'Leading margin (votes)'}</span></div><div><b>${percent(r.rejected,cast)}</b><span>Rejected ballot rate</span></div></div><div class="result-grid"><div><h3>Party vote distribution</h3><p class="muted">${tied?'Highest totals are tied.':valid?`${escape(parties[0][0])} leads the uploaded LGA figures.`:'No valid votes recorded.'} Shares use ${fmt(valid)} valid votes.</p><table><thead><tr><th scope="col">Party</th><th scope="col">Votes</th><th scope="col">Share</th></tr></thead><tbody>${parties.map(([p,v])=>`<tr><td>${escape(p)}<div class="bar"><i style="width:${valid?100*v/valid:0}%"></i></div></td><td>${fmt(v)}</td><td>${percent(v,valid)}</td></tr>`).join('')}</tbody></table><p class="muted">Registered: ${fmt(r.registered)} · Accredited: ${fmt(r.accredited)} (${percent(r.accredited,r.registered)}) · Rejected: ${fmt(r.rejected)}</p></div><div class="evidence"><h3>Evidence & editorial review</h3><a href="${escape(r.source)}" target="_blank" rel="noopener noreferrer">Open source result document ↗</a><p><b>${labels[r.status]||'Pending review'}</b><br>${escape(r.notes||'This upload has not received an editorial decision.')}</p><p>Editorial verification is independent of an official INEC declaration.</p><h4>Review history</h4><div id="history">Loading review history…</div></div></div>${roles.some(x=>['admin','reviewer'].includes(x))?`<form id="review"><h3>Record an editorial decision</h3><label>Decision<select id="decision"><option value="verified">Verified — evidence checked</option><option value="disputed">Disputed — concern identified</option></select></label><label>Review notes<textarea id="review-notes" minlength="10" maxlength="3000" required placeholder="Explain the evidence checked or the discrepancy found…"></textarea></label><button class="primary">Save review</button><p id="review-message" role="status"></p></form>`:''}`;
 if($('review')) $('review').onsubmit=async e=>{e.preventDefault();await busy(e.currentTarget,async()=>{await api('PATCH',{id:r.id,version:r.version,status:$('decision').value,notes:$('review-notes').value});await refresh();},'review-message');};
 if(scroll)$('detail').scrollIntoView({behavior:'smooth',block:'start'});
 const requested=r.id;
 try{const data=await api('GET',null,r.id);if(`${selectedState}/${selectedLga}`!==requested)return;$('history').innerHTML=data.history.length?`<ol class="history">${data.history.map(h=>`<li><b>${escape(h.action)}</b> · v${h.version} · ${escape(date(h.createdAt))}<br>${escape(h.notes)}</li>`).join('')}</ol>`:'No review history recorded.';}catch{if(`${selectedState}/${selectedLga}`===requested&&$('history'))$('history').textContent='Review history is unavailable. Reopen this LGA to retry.';}
}
async function refresh(){
 try{const data=await api();records=data.results;online=true;$('uploaded').textContent=fmt(records.length);$('verified').textContent=fmt(records.filter(r=>r.status==='verified').length);$('service').className='notice';$('service').textContent=`${records.length} of 774 LGA results uploaded. ${records.filter(r=>r.status==='verified').length} editorially verified. Awaiting upload does not mean zero votes.`;}
 catch(error){online=false;records=[];$('uploaded').textContent='—';$('verified').textContent='—';$('service').className='notice error';$('service').innerHTML=`${escape(error.message)} The map and LGA directory remain available. <button id="retry">Retry</button>`;$('retry').onclick=refresh;}
 paintMap();renderList();if(selectedLga)await selectLga(selectedLga);
}
async function busy(form,work,message='admin-message'){
 const button=form.querySelector('button[type="submit"],button.primary');if(button)button.disabled=true;
 try{$(message).textContent='Working…';await work();if($(message))$(message).textContent='Saved successfully.';}catch(e){if($(message))$(message).textContent=e.message||'Unable to complete this action.';}finally{if(button)button.disabled=false;}
}
async function identity(){if(!auth)auth=await import('https://esm.sh/@netlify/identity@2.0.0');return auth;}
async function session(){
 const sdk=await identity();const user=await sdk.getUser();roles=user?.roles||[];
 $('login').hidden=!!user;$('signout').hidden=!user;$('desk').hidden=!user;
 $('upload-area').hidden=!roles.includes('admin');$('role-info').textContent=roles.some(r=>['admin','reviewer'].includes(r))?`Signed in · ${roles.includes('admin')?'Administrator':'Reviewer'}`:'Your account needs an admin or reviewer role assigned by the site owner.';
 if(selectedLga)await selectLga(selectedLga);
}
$('admin-toggle').onclick=async()=>{$('admin').hidden=!$('admin').hidden;if(!$('admin').hidden){$('admin').scrollIntoView({behavior:'smooth'});try{await session();}catch{$('admin-message').textContent='Sign-in could not load. Please check your connection and reopen the editorial desk.';}}};
$('login').onsubmit=e=>{e.preventDefault();busy(e.currentTarget,async()=>{const sdk=await identity();await sdk.login($('email').value,$('password').value);$('password').value='';await session();});};
$('signout').onclick=async()=>{try{await (await identity()).logout();await session();}catch{$('admin-message').textContent='Sign-out failed. Please retry.';}};
$('forgot').onclick=async()=>{if(!$('email').reportValidity())return;try{await (await identity()).requestPasswordRecovery($('email').value);$('admin-message').textContent='Check your email for a password reset link.';}catch{$('admin-message').textContent='Could not send a reset email. Please retry.';}};
$('callback').onsubmit=e=>{e.preventDefault();busy(e.currentTarget,async()=>{const sdk=await identity();if(callbackMode==='invite')await sdk.acceptInvite(inviteToken,$('new-password').value);else await sdk.updateUser({password:$('new-password').value});$('new-password').value='';$('callback').hidden=true;await session();});};
$('upload').onsubmit=e=>{e.preventDefault();busy(e.currentTarget,async()=>{const file=$('result-file').files[0];if(!file||file.size>1000000)throw Error('Select a JSON file smaller than 1 MB.');let data;try{data=JSON.parse(await file.text());}catch{throw Error('The file is not valid JSON.');}await (await identity()).getUser();const result=await api('POST',data);await refresh();$('upload').reset();return result;});};
$('state').onchange=e=>selectState(e.target.value);$('search').oninput=renderList;
async function init(){
 const initial=new URLSearchParams(location.search);
 try{const response=await fetch('/assets/lgas.json');if(!response.ok)throw Error();directory=await response.json();$('state').innerHTML='<option value="">Choose a state</option>'+Object.keys(directory).map(s=>`<option>${escape(s)}</option>`).join('');if(directory[initial.get('state')]){selectState(initial.get('state'));if(directory[selectedState].includes(initial.get('lga')))selectedLga=initial.get('lga');}}catch{$('lga-list').innerHTML='<p class="empty">The LGA directory could not load. Reload the page to retry.</p>';}
 try{const response=await fetch('/assets/nigeria.svg');if(!response.ok)throw Error();$('map').innerHTML=await response.text();document.querySelectorAll('#map path').forEach(path=>{path.onclick=()=>selectState(path.dataset.state);path.onkeydown=e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();selectState(path.dataset.state);}};});paintMap();}catch{$('map').textContent='The map could not load. Use the state menu to explore all LGAs.';}
 await refresh();
 if(/(?:invite|recovery|confirmation|access)_token=/.test(location.hash)){
  $('admin').hidden=false;
  try{const sdk=await identity();const result=await sdk.handleAuthCallback();if(result?.type==='invite'||result?.type==='recovery'){callbackMode=result.type;inviteToken=result.token;$('callback').hidden=false;$('login').hidden=true;}else await session();}catch{$('admin-message').textContent='This sign-in link could not be processed. Request a new invite or password reset.';}
 }
}
init();

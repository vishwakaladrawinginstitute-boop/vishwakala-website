import { auth, db, storage, onAuthStateChanged, signInWithEmailAndPassword, signOut, doc, getDoc, collection, getDocs, ref, listAll, getDownloadURL } from './firebase.js';

const $ = id => document.getElementById(id);
const modal = $('loginModal');
const nav = $('nav');

document.querySelector('.menu-btn')?.addEventListener('click', () => nav.classList.toggle('open'));
['loginOpen','heroLogin','tccLogin','footerLogin'].forEach(id => $(id)?.addEventListener('click', () => openLogin()));
$('closeLogin')?.addEventListener('click', closeLogin);
modal?.addEventListener('click', e => { if(e.target === modal) closeLogin(); });
function openLogin(){ modal.classList.remove('hidden'); $('loginStatus').textContent=''; $('email').focus(); }
function closeLogin(){ modal.classList.add('hidden'); }

$('loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const email = $('email').value.trim();
  const password = $('password').value;
  const status = $('loginStatus');
  status.className='status'; status.textContent='Checking account…';
  try{
    const cred = await signInWithEmailAndPassword(auth,email,password);
    const snap = await getDoc(doc(db,'students',cred.user.uid));
    if(!snap.exists()) throw new Error('Student profile was not found. Please contact Vishwakala Institute.');
    const data = snap.data();
    if(data.approved !== true){
      await signOut(auth);
      throw new Error('Your account is not approved yet. Please contact Vishwakala Institute.');
    }
    closeLogin(); showPortal(data);
  }catch(err){
    status.className='status error';
    status.textContent = friendlyError(err);
  }
});
function friendlyError(err){
  const code=err?.code||'';
  if(code.includes('invalid-credential')||code.includes('invalid-login-credentials')) return 'Incorrect email or password.';
  if(code.includes('too-many-requests')) return 'Too many attempts. Please try again later.';
  if(code.includes('network-request-failed')) return 'Network problem. Please check your internet connection.';
  return err?.message || 'Unable to sign in.';
}

onAuthStateChanged(auth, async user => {
  if(!user) return;
  try{
    const snap = await getDoc(doc(db,'students',user.uid));
    if(snap.exists() && snap.data().approved === true) showPortal(snap.data());
    else await signOut(auth);
  }catch(e){ console.error(e); }
});

function showPortal(data){
  $('student').classList.remove('hidden');
  $('studentName').textContent=data.name || 'Student';
  $('studentCourse').textContent=(data.course || 'Approved student') + ' • Approved';
  $('profileInfo').textContent=`${data.mobile || ''}${data.email ? ' • '+data.email : ''}`;
  $('student').scrollIntoView({behavior:'smooth'});
}

$('logoutBtn').addEventListener('click', async ()=>{ await signOut(auth); $('student').classList.add('hidden'); window.scrollTo({top:0,behavior:'smooth'}); });

$('loadVideos').addEventListener('click', async ()=>{
  const area=$('videoArea'); area.innerHTML='<div class="portal-card">Loading videos from Firebase Storage…</div>';
  try{
    const result=await listAll(ref(storage,'videos'));
    const files=result.items.filter(i=>/\.mp4$/i.test(i.name));
    if(!files.length){area.innerHTML='<div class="portal-card">No MP4 videos found.</div>';return;}
    const cards=[];
    for(const item of files){
      const url=await getDownloadURL(item);
      const title=item.name.replace(/\.mp4$/i,'').replace(/[_-]+/g,' ');
      cards.push(`<article class="video-item"><h3>${escapeHtml(title)}</h3><video controls preload="metadata" src="${url}"></video></article>`);
    }
    area.innerHTML=cards.join('');
  }catch(e){area.innerHTML='<div class="portal-card"><b>Unable to load videos.</b><p>'+escapeHtml(e.message||'Check Firebase Storage rules.')+'</p></div>';}
});

$('loadPdfs').addEventListener('click', async ()=>{
  const area=$('pdfArea'); area.innerHTML='<div class="portal-card">Loading PDF notes from Firestore…</div>';
  try{
    const snap=await getDocs(collection(db,'pdfs'));
    if(snap.empty){area.innerHTML='<div class="portal-card">No PDF notes found.</div>';return;}
    const cards=[];
    snap.forEach(d=>{
      const x=d.data();
      if(x.pdfUrl){ cards.push(`<article class="pdf-item"><h3>${escapeHtml(x.title||'PDF Notes')}</h3><p>${escapeHtml(x.course||'')}</p><p>${escapeHtml(x.description||'')}</p><iframe loading="lazy" src="${x.pdfUrl}" title="${escapeHtml(x.title||'PDF')}"></iframe><p><a class="pdf-link" href="${x.pdfUrl}" target="_blank" rel="noopener">Open PDF in New Tab →</a></p></article>`); }
    });
    area.innerHTML=cards.length?cards.join(''):'<div class="portal-card">PDF records were found, but no pdfUrl is available.</div>';
  }catch(e){area.innerHTML='<div class="portal-card"><b>Unable to load PDF notes.</b><p>'+escapeHtml(e.message||'Check Firestore and Storage rules.')+'</p></div>';}
});

function escapeHtml(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}

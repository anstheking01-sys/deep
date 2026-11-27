
// app.js - المنطق الرئيسي للتطبيق
// هذا الملف يدير التنقل بين الصفحات والتحميل العام

// متغيرات عامة
let examBuilderQuestions = [];
let curExam = null, curQuestions = [], curAnswers = {}, examTimeLeft = 3600, examTimerInterval = null;

// مؤثرات صوتية بسيطة باستخدام Web Audio (تعمل بعد أول تفاعل من المستخدم)
let uiAudioContext=null;
function soundOn(){try{return localStorage.getItem('deep_sound')!=='off';}catch(e){return true;}}
function toggleSound(){const on=!soundOn();try{localStorage.setItem('deep_sound',on?'on':'off');}catch(e){}updateSoundBtn();if(on)playTone(660,.12,'sine',.05);}
function updateSoundBtn(){const b=document.getElementById('soundBtn');if(b)b.textContent=soundOn()?'🔊':'🔇';}
function playStreakSound(){[523,659,784,1047,1319,1568].forEach((f,i)=>playTone(f,.22,i%2?'triangle':'sine',.055,i*.09));playTone(2093,.5,'sine',.025,.55);}
function playTone(freq=520,duration=0.07,type='sine',volume=0.035,delay=0){
  if(!soundOn())return;
  try{
    const Ctx=window.AudioContext||window.webkitAudioContext;if(!Ctx)return;
    uiAudioContext=uiAudioContext||new Ctx();if(uiAudioContext.state==='suspended')uiAudioContext.resume();
    const osc=uiAudioContext.createOscillator(),gain=uiAudioContext.createGain();
    osc.type=type;osc.frequency.setValueAtTime(freq,uiAudioContext.currentTime+delay);
    gain.gain.setValueAtTime(0.0001,uiAudioContext.currentTime+delay);
    gain.gain.exponentialRampToValueAtTime(volume,uiAudioContext.currentTime+delay+0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001,uiAudioContext.currentTime+delay+duration);
    osc.connect(gain);gain.connect(uiAudioContext.destination);osc.start(uiAudioContext.currentTime+delay);osc.stop(uiAudioContext.currentTime+delay+duration+0.02);
  }catch(e){}
}
function playExamResultSound(pct){
  if(pct>=90){[660,784,988,1175].forEach((f,i)=>playTone(f,.18,'triangle',.045,i*.12));}
  else if(pct>=70){[523,659,784].forEach((f,i)=>playTone(f,.16,'sine',.04,i*.13));}
  else if(pct>=50){[440,523].forEach((f,i)=>playTone(f,.18,'sine',.035,i*.16));}
  else {[330,262,220].forEach((f,i)=>playTone(f,.2,'triangle',.035,i*.17));}
}
document.addEventListener('click',e=>{
  const target=e.target.closest('button,.btn,[role="button"]');
  if(target&&!target.disabled)playTone(560,.055,'sine',.018);
},true);
function addAmbientLayers(){
  if(document.getElementById('ambientLayers'))return;
  const layer=document.createElement('div');layer.id='ambientLayers';layer.className='ambient-layers';
  layer.innerHTML='<i></i><i></i><i></i><i></i>';
  document.body.prepend(layer);
}


// دالة عرض رسالة Toast
function toast(msg){
  const t=document.getElementById('toast');
  t.textContent=msg;
  t.classList.remove('hidden');
  setTimeout(()=>t.classList.add('hidden'),3000);
}

// عرض حالة التحميل
function showLoading(msg='جاري التحميل...'){
  let el=document.getElementById('loadingOverlay');
  if(!el){
    el=document.createElement('div');
    el.id='loadingOverlay';
    el.className='loading';
    el.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:100;display:grid;place-items:center;backdrop-filter:blur(4px)';
    document.body.appendChild(el);
  }
  el.innerHTML='<div style="text-align:center"><div class="loading"></div><div style="margin-top:12px;color:#fff">'+msg+'</div></div>';
  el.classList.remove('hidden');
}
function hideLoading(){
  const el=document.getElementById('loadingOverlay');
  if(el) el.classList.add('hidden');
}

// تبديل قائمة الصف
function toggleSelect(id){
  const el=document.getElementById(id);
  if(!el) return;
  const list=el.querySelector('.select-list');
  if(list) list.classList.toggle('hidden');
}
function pickGrade(v){
  const input=document.getElementById('s_grade');
  if(input) input.value=v;
  const head=document.querySelector('#gradeSelect .select-head');
  if(head) head.innerHTML=v+' <span>▼</span>';
  const list=document.querySelector('#gradeSelect .select-list');
  if(list) list.classList.add('hidden');
}

// تبديل بين تسجيل الدخول وإنشاء حساب
function switchAuth(t){
  document.getElementById('tLogin').classList.toggle('on',t==='login');
  document.getElementById('tSign').classList.toggle('on',t==='signup');
  document.getElementById('loginForm').classList.toggle('hidden',t!=='login');
  document.getElementById('signupForm').classList.toggle('hidden',t!=='signup');
}

// دخول التطبيق بعد تسجيل الدخول
function enterApp(){
  setTimeout(()=>{try{maybeShowGuide();}catch(e){}},0);
  document.getElementById('authView').classList.add('hidden');
  document.getElementById('appView').classList.remove('hidden');
  document.getElementById('userNameTop').textContent=currentUser.full_name||currentUser.fullName;
  document.getElementById('profileAvatar').textContent=(currentUser.full_name||currentUser.fullName||'م')[0];
  document.getElementById('profileName').textContent=currentUser.full_name||currentUser.fullName;
  document.getElementById('profileMeta').textContent=(currentUser.grade||'')+' • '+(currentUser.gender||'');
  document.getElementById('pf_name').value=currentUser.full_name||currentUser.fullName||'';
  document.getElementById('pf_phone').value=currentUser.phone2||currentUser.phone||'';
  document.getElementById('pf_parent').value=currentUser.parent_phone||currentUser.parentPhone||'';
  const canEditProfile=isTeacher();
  ['pf_name','pf_phone','pf_parent'].forEach(id=>{const field=document.getElementById(id);if(field)field.disabled=!canEditProfile;});
  const profileSaveBtn=document.getElementById('profileSaveBtn');if(profileSaveBtn)profileSaveBtn.classList.toggle('hidden',!canEditProfile);
  const studentProfileNote=document.getElementById('studentProfileNote');if(studentProfileNote)studentProfileNote.classList.toggle('hidden',canEditProfile);
  document.getElementById('roleBadge').textContent=currentUser.role==='owner'?'مدير المنصة':currentUser.role==='admin'?'مدير':isTeacher()?'مستر':'طالب';
  document.getElementById('welcomeTitle').innerHTML=(isTeacher()?'أهلاً '+escapeHtml(currentUser.full_name||currentUser.fullName||'مستر'):'أهلاً يا '+escapeHtml(currentUser.first_name||currentUser.firstName||''))+' <span class="wave">👋</span>';
  
  // حساب XP والمستوى
  const xp = currentUser.xp||0;
  const level = Math.floor(xp/100)+1;
  updateXPDisplay(xp);
  
  buildNav();
  showPage(isTeacher()?'dashboard':'home');
  refreshAll();
}


// بطاقة المستوى في الصفحة الرئيسية للطالب
function updateXPDisplay(xpValue){
  const xp = Math.max(0, Number(xpValue) || 0);
  const level = Math.floor(xp / 100) + 1;
  const into = xp % 100;
  const markup = `<div class="xp-level">${level}</div><div class="xp-body"><div class="xp-title">المستوى ${level}</div><div class="xp-sub">${xp} XP • باقي ${100 - into} نقطة للمستوى التالي</div><div class="xp-bar"><div class="xp-fill" style="width:${into}%"></div></div></div>`;
  ['xpInfoTop', 'xpInfoHome'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = markup;
  });
}

// ---------- القائمة: أول 4 عناصر تظهر في شريط الهاتف، والباقي داخل زر "المزيد" ----------
const NAV_STUDENT=[['home','🏠','الرئيسية'],['lessons','📚','الدروس'],['exams','📝','الامتحانات'],['training','✍️','التدريبات'],['resources','📂','الملازم'],['leaderboard','🏆','الترتيب'],['messages','💬','الرسائل'],['profile','👤','حسابي']];
const NAV_TEACHER=[['dashboard','📊','الرئيسية'],['students','👥','الطلاب'],['lessons','📚','الدروس'],['exams','📝','الامتحانات'],['training','✍️','التدريبات'],['resources','📂','الملازم'],['results','📈','النتائج'],['grades-classes','🏫','الصفوف'],['leaderboard','🏆','الترتيب'],['messages','💬','الرسائل'],['profile','👤','حسابي']];
const NAV_MAIN_COUNT=4;
function navItems(){return isTeacher()?NAV_TEACHER:NAV_STUDENT;}
function buildNav(){
  const items=navItems();
  const btn=([id,ic,lb])=>`<button data-page="${id}" onclick="showPage('${id}')"><span class="ni">${ic}</span><span>${lb}</span></button>`;
  document.getElementById('nav').innerHTML=items.map(btn).join('');
  document.getElementById('mobileNav').innerHTML=items.slice(0,NAV_MAIN_COUNT).map(btn).join('')
    +`<button data-page="__more" onclick="openMoreMenu()"><span class="ni">☰</span><span>المزيد</span></button>`;
  const addLessonBtn=document.getElementById('addLessonBtn'); if(addLessonBtn) addLessonBtn.classList.toggle('hidden',!isTeacher());
  const addExamBtn=document.getElementById('addExamBtn'); if(addExamBtn) addExamBtn.classList.toggle('hidden',!isTeacher());
  const addResourceBtn=document.getElementById('addResourceBtn'); if(addResourceBtn) addResourceBtn.classList.toggle('hidden',!isTeacher());
  document.querySelectorAll('.teacher-only').forEach(el=>el.classList.toggle('hidden',!isTeacher()));
  ['xpInfoHome','streakCard','homeNoticesWrap'].forEach(id=>{const el=document.getElementById(id);if(el)el.classList.toggle('hidden',isTeacher());});
  const noticeComposer=document.getElementById('teacherNoticeComposer'); if(noticeComposer) noticeComposer.classList.toggle('hidden',!isTeacher());
}
let currentPageId='';
function openMoreMenu(){
  const rest=navItems().slice(NAV_MAIN_COUNT);
  openModal('القائمة',`<div class="more-grid">${rest.map(([id,ic,lb])=>`<button class="${id===currentPageId?'active':''}" onclick="closeModal();showPage('${id}')"><span>${ic}</span>${lb}</button>`).join('')}</div>`);
}

function showPage(id){
  currentPageId=id;
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  const el=document.getElementById('p-'+id);
  if(el) el.classList.add('active');
  const inMain=navItems().slice(0,NAV_MAIN_COUNT).some(([pid])=>pid===id);
  document.querySelectorAll('#nav button').forEach(b=>b.classList.toggle('active',b.dataset.page===id));
  document.querySelectorAll('#mobileNav button').forEach(b=>b.classList.toggle('active',inMain?b.dataset.page===id:b.dataset.page==='__more'));
  window.scrollTo({top:0,behavior:'smooth'});
  // تحميل بيانات الصفحة
  if(id==='training') renderTrainingList();
  if(id==='resources') renderResources();
  if(id==='leaderboard') renderLeaderboard();
  if(id==='messages'){renderMessages();renderNotifications();}
  if(id==='results') renderResults();
  if(id==='grades-classes') renderGradeClasses();
}

// ---------- الوضع الفاتح / الداكن ----------
function applyTheme(theme){
  if(theme==='light')document.documentElement.setAttribute('data-theme','light');
  else document.documentElement.removeAttribute('data-theme');
  const b=document.getElementById('themeBtn');if(b)b.textContent=theme==='light'?'🌙':'☀️';
  updateSoundBtn();
  const m=document.querySelector('meta[name=theme-color]');if(m)m.content=theme==='light'?'#F3F6FC':'#0A0F1C';
}
function toggleTheme(){
  const next=document.documentElement.getAttribute('data-theme')==='light'?'dark':'light';
  applyTheme(next);
  try{localStorage.setItem('deep_theme',next);}catch(e){}
}
try{applyTheme(localStorage.getItem('deep_theme')==='light'?'light':'dark');}catch(e){}

async function refreshAll(){
  try{
    renderLessons();
    renderTrainingList();
    renderResources();
    renderExams();
    renderStudents();
    renderDashboard();
  }catch(e){console.error(e)}
}

// بيانات التطبيق تُقرأ من ذاكرة مؤقتة تم تحميلها من Supabase؛ لا توجد قاعدة محلية تجريبية.
// آمنة داخل خاصية HTML مثل onclick="f(...)": علامات التنصيص تتحول إلى &quot;
function jsArg(value){ return JSON.stringify(String(value ?? '')).replace(/&/g,'&amp;').replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
function visibleToCurrentStudent(item){ return isTeacher() || (item.grade && item.grade===currentUser?.grade); }

// مودال
function openModal(t,h){document.getElementById('modalTitle').textContent=t;document.getElementById('modalBody').innerHTML=h;document.getElementById('modal').classList.remove('hidden')}
function closeModal(){document.getElementById('modal').classList.add('hidden')}
function openContact(){document.getElementById('contactModal').classList.remove('hidden')}
function closeContact(){document.getElementById('contactModal').classList.add('hidden')}


// بدء المنصة بعد تحميل ملفات Supabase والواجهة.
window.addEventListener('DOMContentLoaded', () => {
  initializeDeepPlatform();
});

// تسجيل عامل الخدمة (يعمل على https أو localhost فقط)
if('serviceWorker' in navigator && (location.protocol==='https:'||location.hostname==='localhost')){window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));}

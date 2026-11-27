// streak.js - نظام الاستريك 🔥 الأسبوعي (حصة كل جمعة، مهلة حتى الثلاثاء)
// يُحسب من نشاط الطالب الحقيقي المحفوظ في Supabase.
// لا يحتاج أعمدة جديدة في قاعدة البيانات ولا يمكن التلاعب به من المتصفح.

const STREAK_DAY_LABELS=['أحد','اثنين','ثلاثاء','أربعاء','خميس','جمعة','سبت'];
function localDayKey(value){
  const d=new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function studentActivityDays(db,studentId){
  const days=new Set();
  (db.attempts||[]).forEach(a=>{if(String(a.student_id)===String(studentId)&&a.created_at)days.add(localDayKey(a.created_at));});
  (db.lessonCompletions||[]).forEach(c=>{
    if(String(c.student_id)!==String(studentId))return;
    const t=c.completed_at||c.created_at;if(t)days.add(localDayKey(t));
  });
  return days;
}
// ---- منطق الاستريك ----
// كل درس (له تدريب) أو امتحان له "مهلة" تبدأ من وقت نزوله. المستر يحدد المهلة لكل درس/امتحان (streak_hours):
//   - فاضي = الافتراضي: لحد آخر يوم الثلاثاء بعد النزول   - رقم = عدد ساعات من النزول   - 0 = بدون مهلة (لا يؤثر على الاستريك)
// خلال المهلة الاستريك "بارد" ❄️ ومحفوظ. لو انتهت المهلة والطالب لم يحل ذلك الدرس/الامتحان، تنكسر السلسلة.
const STREAK_DEADLINE_DAY=2;   // الثلاثاء (الأحد=0)
const STREAK_MIN_GAP_DAYS=3;
function deadlineFor(item){
  const r=new Date(item.created_at).getTime();
  if(!Number.isFinite(r))return null;
  const h=item.streak_hours;
  if(h!==undefined&&h!==null&&h!==''){
    const n=Number(h);
    if(!Number.isFinite(n)||n<=0)return null;      // 0 = بدون مهلة
    return r+n*3600000;
  }
  const d=new Date(r);d.setHours(0,0,0,0);d.setDate(d.getDate()+STREAK_MIN_GAP_DAYS);
  while(d.getDay()!==STREAK_DEADLINE_DAY)d.setDate(d.getDate()+1);
  d.setHours(23,59,59,999);return d.getTime();
}
function studentActivityTimes(db,studentId){
  const times=[];
  (db.attempts||[]).forEach(a=>{if(String(a.student_id)===String(studentId)&&a.created_at)times.push(new Date(a.created_at).getTime());});
  (db.lessonCompletions||[]).forEach(c=>{
    if(String(c.student_id)!==String(studentId))return;
    const t=c.completed_at||c.created_at;if(t)times.push(new Date(t).getTime());
  });
  return times.filter(Number.isFinite).sort((a,b)=>a-b);
}
// المطلوب من الطالب لكل عنصر: وقت إنجازه (أو null لو لم ينجزه). عنصر بلا مطلوب = undefined
function itemDoneTime(db,studentId,kind,item){
  if(kind==='exam'){
    const t=(db.attempts||[]).filter(a=>String(a.student_id)===String(studentId)&&String(a.exam_id)===String(item.id)).map(a=>new Date(a.created_at).getTime()).filter(Number.isFinite);
    return t.length?Math.min(...t):null;
  }
  if(!(item.training_questions||[]).length)return undefined;   // درس بلا تدريب: لا يوجد شيء يُحل
  const c=(db.lessonCompletions||[]).find(x=>String(x.student_id)===String(studentId)&&String(x.lesson_id)===String(item.id));
  if(!c)return null;
  const t=new Date(c.completed_at||c.created_at||0).getTime();
  return Number.isFinite(t)&&t>0?t:0;
}
function computeStreak(db,studentId,nowTs=Date.now()){
  const times=studentActivityTimes(db,studentId);
  const joined=new Date((db.users||[]).find(u=>String(u.id)===String(studentId))?.created_at||0).getTime()||0;
  const reqs=[];
  (db.lessons||[]).forEach(l=>{const dl=deadlineFor(l);if(dl===null)return;const done=itemDoneTime(db,studentId,'lesson',l);if(done===undefined)return;reqs.push({title:l.title,dl,done});});
  (db.exams||[]).forEach(e=>{const dl=deadlineFor(e);if(dl===null)return;reqs.push({title:e.title,dl,done:itemDoneTime(db,studentId,'exam',e)});});
  reqs.sort((a,b)=>a.dl-b.dl);
  let lastBreak=-Infinity,segStart=-Infinity;const segments=[];
  let open=null;
  reqs.forEach(r=>{
    if(r.dl<joined)return;                       // مهلة انتهت قبل انضمام الطالب
    const ok=r.done!==null&&r.done<=r.dl;
    if(r.dl<nowTs){if(!ok){segments.push([segStart,r.dl]);segStart=r.dl;lastBreak=r.dl;}}
    else if(r.done===null&&(!open||r.dl<open.dl))open={title:r.title,dl:r.dl};   // أقرب مهلة مفتوحة لم تُحل
  });
  segments.push([segStart,Infinity]);
  const dayKey=t=>localDayKey(t);
  const daysIn=(from,to)=>new Set(times.filter(t=>t>from&&t<=to).map(dayKey)).size;
  const count=daysIn(lastBreak,Infinity);
  const best=Math.max(...segments.map(([f,t])=>daysIn(f,t)));
  const broke=lastBreak>-Infinity&&count===0&&nowTs-lastBreak<7*86400000;
  const days=new Set(times.map(dayKey));
  const base=new Date();base.setHours(12,0,0,0);
  const dayAt=off=>{const d=new Date(base);d.setDate(d.getDate()-off);return d;};
  const week=[6,5,4,3,2,1,0].map(off=>{const d=dayAt(off);return {label:STREAK_DAY_LABELS[d.getDay()],done:days.has(localDayKey(d)),today:off===0};});
  const doneToday=days.has(localDayKey(new Date(nowTs)));
  const waiting=open!==null;
  return {count,best,doneToday,week,waiting,openDeadline:open?open.dl:null,openTitle:open?open.title:'',openDone:!waiting&&reqs.some(r=>r.dl>=nowTs),broke,frozen:true};
}
let lastStreakCount=null;
function renderStreakCard(){
  const host=document.getElementById('streakCard');
  if(!host||isTeacher()||!currentUser)return;
  const s=computeStreak(getDB(),currentUser.id);
  const fmt=t=>new Date(t).toLocaleString('ar-EG',{weekday:'long',day:'numeric',month:'long',hour:'numeric',minute:'2-digit'});
  const msg=s.waiting?`❄️ الاستريك بارد. حل «${escapeHtml(s.openTitle||'المطلوب')}» قبل ${fmt(s.openDeadline)} عشان ما يضيعش`
    :s.openDone?'✅ كملت كل المطلوب. استريكك محفوظ لحد الحصة الجاية'
    :s.broke?'💔 السلسلة اتكسرت لأن المهلة خلصت. حل أي امتحان أو تدريب وابدأ من جديد'
    :'❄️ مفيش جديد دلوقتي، استريكك محفوظ. استنى الحصة الجاية (الجمعة)';
  const milestone=s.count>=30?'🏅 بطل الشهر':s.count>=7?'🏅 أسبوع كامل':'';
  const grew=lastStreakCount!==null&&s.count>lastStreakCount;
  host.innerHTML=`<div class="streak ${s.count?'on':''} ${s.waiting?'cold':''} ${s.broke?'risk':''} ${grew?'grew':''}">
    <div class="streak-flame">🔥</div>
    <div class="streak-body">
      <div class="streak-num">${s.count}<span> ${s.count===1?'يوم نشاط':'أيام نشاط'}</span>${milestone?` <em>${milestone}</em>`:''}</div>
      <div class="streak-msg">${msg}</div>
      <div class="streak-week">${s.week.map(d=>`<div class="sd ${d.done?'done':''} ${d.today?'today':''}"><i>${d.done?'🔥':''}</i><small>${d.label}</small></div>`).join('')}</div>
      ${s.best>1?`<div class="muted" style="margin-top:6px">أفضل سلسلة لك: ${s.best} يوم نشاط</div>`:''}
    </div></div>`;
  if(grew)setTimeout(()=>{if(typeof playStreakSound==='function')playStreakSound();},900);
  if(grew)setTimeout(()=>toast(`🔥 سلسلتك وصلت ${s.count} ${s.count===1?'يوم':'أيام'}!`),2600);
  lastStreakCount=s.count;
}

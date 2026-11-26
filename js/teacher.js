
// teacher.js - لوحة تحكم المستر

function renderStudents(){
  if(!isTeacher()) return;
  const q=(document.getElementById('studentSearch')?.value||'').toLowerCase();
  const db=getDB();
  const studs=db.users.filter(u=>u.role==='student').filter(u=>(u.full_name||u.fullName||'').toLowerCase().includes(q) || (u.phone||'').includes(q));
  const map={}; db.attempts.forEach(a=>{ const sid=a.student_id||a.studentId; if(!map[sid]) map[sid]=[]; map[sid].push(a.score); });
  const enriched=studs.map(s=>{
    const scores=map[s.id]||[]; const avg=scores.length?Math.round(scores.reduce((a,b)=>a+b,0)/scores.length):0; const best=scores.length?Math.max(...scores):0;
    return {...s, avg, best, attemptsCount:scores.length, xp:s.xp||0}
  }).sort((a,b)=>b.avg-a.avg);
  
  const el=document.getElementById('studentsRows');
  if(!el) return;
  el.innerHTML=enriched.map((s,i)=>`
    <div class="list-item" onclick="openStudentDetail(${jsArg(s.id)})">
      <div>
        <div><span style="background:var(--primary-color);color:var(--on-primary);padding:2px 6px;border-radius:6px;font-size:9px">#${i+1}</span> <b>${escapeHtml(s.full_name||s.fullName||'')}</b> <span style="background:var(--surface-3);padding:2px 6px;border-radius:6px;font-size:9px">${s.xp} XP</span></div>
        <div class="muted">${escapeHtml(s.phone||'')} • ولي الأمر: ${escapeHtml(s.parent_phone||s.parentPhone||'')} • ${escapeHtml(s.grade||'')} • ${s.attemptsCount} امتحان • متوسط ${s.avg}%</div>
      </div>
      <div style="display:flex;gap:4px;align-items:center" onclick="event.stopPropagation()">
        <span class="badge ${s.avg>=50?'green':'red'}">${s.avg}%</span>
        <button class="btn small sec" onclick="openStudentModal(${jsArg(s.id)})">تعديل</button>
      </div>
    </div>
  `).join('')||'<div class="empty">لا يوجد طلاب - الطلاب يسجلون بأنفسهم من صفحة إنشاء حساب</div>';
}

function openStudentDetail(id){
  if(!isTeacher()){toast('هذه الصفحة متاحة للمستر فقط');return;}
  const db=getDB();
  const s=db.users.find(u=>String(u.id)===String(id));
  if(!s){toast('الطالب غير موجود');return;}
  const my=db.attempts.filter(a=>String(a.student_id||a.studentId)===String(id)).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
  const allInGrade=db.users.filter(u=>u.role==='student' && u.grade===s.grade);
  const map={}; db.attempts.forEach(a=>{ const sid=a.student_id||a.studentId; if(!map[sid]) map[sid]=[]; map[sid].push(a.score); });
  const avgs=allInGrade.map(p=>{const sc=map[p.id]||[]; return {id:p.id, avg:sc.length?Math.round(sc.reduce((a,b)=>a+b,0)/sc.length):0}}).sort((a,b)=>b.avg-a.avg);
  const rank=avgs.findIndex(x=>x.id===id)+1;
  const studentProgress=(db.lessonProgress||[]).find(x=>String(x.student_id)===String(id));
  const lastLesson=(db.lessons||[]).find(x=>studentProgress&&String(x.id)===String(studentProgress.last_lesson_id));
  const lastTrainingDone=!!(lastLesson&&(db.lessonCompletions||[]).some(x=>String(x.student_id)===String(id)&&String(x.lesson_id)===String(lastLesson.id)));
  
  let html=`<div style="background:var(--card-color);border:1px solid var(--border-color);border-radius:10px;padding:12px;margin-bottom:12px"><b>${escapeHtml(s.full_name||s.fullName||'')}</b> - ${escapeHtml(s.grade||'')}<br><small class="muted">${escapeHtml(s.phone||'')} • ولي الأمر: ${escapeHtml(s.parent_phone||s.parentPhone||'')} • XP: ${s.xp||0}</small><br><div style="margin-top:8px"><span class="badge green">ترتيب في صفه: #${rank} من ${allInGrade.length}</span> <span class="badge">متوسط: ${avgs.find(x=>x.id===id)?.avg||0}%</span></div></div><div class="box" style="margin-bottom:12px"><b>📚 آخر درس وصل له:</b> ${lastLesson?escapeHtml(lastLesson.title):'لم يبدأ بعد'}<br><span class="muted">${lastLesson?(lastTrainingDone?'✅ أكمل التدريب المرتبط به':'⏳ لم يكمل التدريب المرتبط به'):'لا يوجد تقدم مسجل حتى الآن'}</span></div><h4>كل امتحاناته (${my.length}) - اضغط لرؤية التفاصيل</h4>`;
  if(my.length===0) html+='<div class="empty">لم يحل أي امتحان</div>';
  else{
    my.forEach((att,idx)=>{
      const bestScore=Math.max(...my.filter(a=>a.exam_id===att.exam_id).map(a=>a.score));
      const isBest=att.score===bestScore;
      html+=`<div class="list-item" onclick="openAttemptDetail(${jsArg(att.id)})"><div><b>${escapeHtml(att.exam_title||att.examTitle||'امتحان')}</b> ${idx===0?'<span class="badge">أحدث</span>':''} ${isBest?'<span class="badge green">أفضل</span>':''} ${my.filter(a=>a.exam_id===att.exam_id).length>1?'<span class="badge">محاولة '+(my.filter(a=>a.exam_id===att.exam_id).length-idx)+'</span>':''}<div class="muted">${new Date(att.created_at).toLocaleString('ar-EG')} • ${att.correct}/${att.total} صح • ${att.score}%</div></div><b style="color:${att.score>=50?'var(--success)':'var(--danger)'}">${att.score}%</b></div>`;
    });
  }
  openModal(`تفاصيل: ${escapeHtml(s.full_name||s.fullName||'طالب')}`, html);
}

function openAttemptDetail(id){
  const db=getDB();
  const att=db.attempts.find(a=>String(a.id)===String(id));
  if(!att || !att.details){toast('لا توجد تفاصيل');return;}
  let html=`<div class="result-summary"><h3>${escapeHtml(att.exam_title||att.examTitle||'امتحان')} - ${Number(att.score)||0}%</h3><p>${att.correct} من ${att.total} صح</p><small class="muted">${new Date(att.created_at).toLocaleString('ar-EG')}</small></div>`;
  att.details.forEach((d,idx)=>{
    const isCorrect=d.userAnswer===d.correctAnswer;
    html+=`<div class="exam-question"><b>${idx+1}. ${escapeHtml(d.question||'')} ${isCorrect?'<span style="color:var(--success)">✔</span>':'<span style="color:var(--danger)">✘</span>'}</b>${d.qImageData?`<img src="${safeImageSrc(d.qImageData)}" style="max-width:100%;border-radius:8px;margin:6px 0">`:''}`;
    d.options.forEach((opt,oi)=>{
      let cls=''; if(oi===d.correctAnswer) cls='correct'; if(d.userAnswer!==undefined && oi===d.userAnswer && d.userAnswer!==d.correctAnswer) cls='wrong';
      html+=`<div class="exam-opt ${cls}">${oi+1}. ${escapeHtml(opt)} ${oi===d.correctAnswer?' (الصح)':''} ${oi===d.userAnswer?' ← اختيار الطالب':''}</div>`;
    });
    html+=`</div>`;
  });
  openModal(`تفاصيل محاولة: ${Number(att.score)||0}%`, html);
}

// تعديل بيانات الطالب فقط (لا إضافة ولا حذف من لوحة المستر)
function openStudentModal(id){
  if(!isTeacher()){toast('تعديل بيانات الطلاب متاح للمستر فقط');return;}
  const db=getDB();
  const u=db.users.find(x=>String(x.id)===String(id));
  if(!u){toast('الطالب غير موجود');return;}
  openModal('تعديل بيانات الطالب',
    `<input id="st_first" value="${escapeHtml(u.first_name||u.firstName||'')}" placeholder="الاسم الأول">
     <input id="st_father" value="${escapeHtml(u.father_name||u.fatherName||'')}" placeholder="اسم الأب">
     <input id="st_phone" value="${escapeHtml(u.phone2||u.phone||'')}" placeholder="رقم تواصل الطالب (لا يغيّر رقم الدخول)">
     <input id="st_parent" value="${escapeHtml(u.parent_phone||u.parentPhone||'')}" placeholder="رقم ولي الأمر * إجباري">
     <select id="st_grade"><option>${escapeHtml(u.grade||'')}</option><option>الأول الإعدادي</option><option>الثاني الإعدادي</option><option>الثالث الإعدادي</option><option>الأول الثانوي</option><option>الثاني الثانوي</option><option>الثالث الثانوي</option></select>
     <select id="st_gender"><option>${escapeHtml(u.gender||'')}</option><option>ذكر</option><option>أنثى</option></select>
     <input id="st_xp" type="number" value="${u.xp||0}" placeholder="XP">
     <button class="btn" onclick="saveStudent(${jsArg(id)})">💾 حفظ التعديلات</button>
     <hr style="border:0;border-top:1px solid var(--border-color);margin:14px 0">
     <b>🔑 نسي كلمة المرور؟</b>
     <input id="st_newpass" type="text" autocomplete="off" placeholder="كلمة مرور جديدة (8 أحرف أو أكثر)">
     <button class="btn sec" onclick="resetStudentPassword(${jsArg(id)})">🔑 تعيين كلمة المرور الجديدة</button>
     <small class="muted" style="display:block;margin-top:8px">رقم الدخول يبقى هو الرقم المسجَّل وقت إنشاء الحساب. بعد تعيين كلمة مرور جديدة أرسلها للطالب.</small>`
  );
}

async function resetStudentPassword(id){
  if(!isTeacher()){toast('غير مسموح');return;}
  const pass=document.getElementById('st_newpass').value;
  if(pass.length<8){toast('كلمة المرور يجب ألا تقل عن 8 أحرف');return;}
  if(!confirm('تعيين كلمة المرور الجديدة لهذا الطالب؟'))return;
  try{
    const {error}=await ensureCloud().rpc('admin_reset_password',{target_id:String(id),new_password:pass});
    if(error)throw error;
    document.getElementById('st_newpass').value='';
    toast('تم تغيير كلمة المرور ✅ أرسلها للطالب');
  }catch(e){
    toast(/admin_reset_password|function/i.test(e.message||'')?'شغّل ملف SUPABASE_V11_PATCH.sql في Supabase أولًا':('تعذر تغيير كلمة المرور: '+(e.message||'')));
  }
}

async function saveStudent(id){
  if(!isTeacher()){toast('غير مسموح بتعديل بيانات الطلاب');return;}
  const first=document.getElementById('st_first').value.trim();
  const father=document.getElementById('st_father').value.trim();
  const phone=document.getElementById('st_phone').value.trim();
  const parent=document.getElementById('st_parent').value.trim();
  const grade=document.getElementById('st_grade').value;
  const gender=document.getElementById('st_gender').value;
  const xp=parseInt(document.getElementById('st_xp').value)||0;
  if(!parent){toast('رقم ولي الأمر إجباري');return;}
  const db=getDB();
  const old=db.users.find(x=>String(x.id)===String(id));
  if(old){
    old.first_name=first; old.firstName=first;
    old.father_name=father; old.fatherName=father;
    old.full_name=`${first} ${father}`.trim(); old.fullName=`${first} ${father}`.trim();
    old.phone=phone; old.phone2=phone;
    old.parent_phone=parent; old.parentPhone=parent;
    old.grade=grade; old.gender=gender; old.xp=xp;
    try{await saveDB(db);}catch(e){return;}
    closeModal();
    renderStudents();
    toast('تم حفظ تعديلات الطالب ✅');
  }
}

function renderDashboard(){
  const db=getDB();
  const studs=db.users.filter(u=>u.role==='student');
  const lessons=db.lessons;
  const attempts=db.attempts;
  const avg=attempts.length?Math.round(attempts.reduce((a,b)=>a+(b.score||0),0)/attempts.length):0;
  const successRate=attempts.length?Math.round(attempts.filter(a=>a.score>=50).length/attempts.length*100):0;
  
  if(!isTeacher()){
    const studentExams=getExamsForUser(db,currentUser);
    const eligibleExamIds=new Set(studentExams.map(ex=>String(ex.id)));
    const myAttempts=attempts.filter(a=>String(getAttemptStudentId(a))===String(currentUser.id) && eligibleExamIds.has(String(getAttemptExamId(a))));
    const myAvg=myAttempts.length?Math.round(myAttempts.reduce((a,b)=>a+(Number(b.score)||0),0)/myAttempts.length):0;
    const totalExams=studentExams.length;
    const completedExams=new Set(myAttempts.map(getAttemptExamId).map(String)).size;
    const progress=totalExams?Math.min(100,Math.round(completedExams/totalExams*100)):0;
    
    const el=document.getElementById('studentStats');
    renderStreakCard();
    renderHomeNotices();
    const lessonProgress=(db.lessonProgress||[]).find(x=>String(x.student_id)===String(currentUser.id));
    const lastLesson=(db.lessons||[]).find(x=>lessonProgress&&String(x.id)===String(lessonProgress.last_lesson_id));
    const lastCompleted=!!(lastLesson&&(db.lessonCompletions||[]).some(x=>String(x.student_id)===String(currentUser.id)&&String(x.lesson_id)===String(lastLesson.id)));
    if(el) el.innerHTML=`
      <div class="card" ${lastLesson?`onclick="viewLesson(${lastLesson.id})"`:`onclick="showPage('lessons')"`}><div class="ico">▶️</div><div class="label">كمّل من حيث وقفت</div><b style="font-size:17px">${lastLesson?escapeHtml(lastLesson.title):'ابدأ أول درس'}</b><small class="muted">${lastLesson?(lastCompleted?'✅ أكملت تدريبه':'⏳ التدريب لم يكتمل'):'اضغط لفتح الدروس'}</small></div>
      <div class="card green" onclick="showPage('exams')"><div class="ico">📈</div><div class="label">متوسط درجاتي</div><b>${myAvg}%</b><small class="muted">من ${myAttempts.length} محاولة</small></div>
      <div class="card purple" onclick="showPage('exams')"><div class="ico">📝</div><div class="label">الامتحانات</div><b>${completedExams}/${totalExams}</b><div class="xp-bar"><div class="xp-fill" style="width:${progress}%"></div></div></div>
    `;
    return;
  }
  
  const teacherEl=document.getElementById('teacherStats');
  if(teacherEl) teacherEl.innerHTML=`
    <div class="card" onclick="showPage('students')"><div class="ico">👥</div><div class="label">الطلاب</div><b>${studs.length}</b></div>
    <div class="card purple" onclick="showPage('lessons')"><div class="ico">📚</div><div class="label">الدروس</div><b>${lessons.length}</b></div>
    <div class="card warn" onclick="showPage('results')"><div class="ico">📈</div><div class="label">متوسط الدرجات</div><b>${avg}%</b><small class="muted">من ${attempts.length} محاولة</small></div>
    <div class="card green" onclick="showPage('results')"><div class="ico">✅</div><div class="label">نسبة النجاح</div><b>${successRate}%</b><div class="xp-bar"><div class="xp-fill" style="width:${successRate}%;background:var(--success)"></div></div></div>
  `;
}

// Leaderboard: الطالب لا يقرأ ملفات زملائه (RLS)، لذلك يعتمد على عرض grade_leaderboard الآمن.
function renderLeaderboard(){
  const db=getDB();
  const gradeFilter=isTeacher()?(document.getElementById('lbGrade')?.value||''):'';
  const gradeSel=document.getElementById('lbGrade');
  if(gradeSel&&!gradeSel.options.length)gradeSel.innerHTML=gradeOptionsHtml('','كل الصفوف');
  let ranked;
  if(Array.isArray(db.leaderboard)){
    ranked=db.leaderboard.filter(s=>isTeacher()||s.grade===currentUser.grade).map(s=>{
      const mine=String(s.id)===String(currentUser.id);
      const own=mine?db.attempts.filter(a=>String(getAttemptStudentId(a))===String(s.id)).map(a=>Number(a.score)||0):null;
      return {id:s.id,full_name:s.full_name,grade:s.grade,xp:mine?(Number(currentUser.xp)||0):(Number(s.xp)||0),
        avg:own?avgOf(own):(Number(s.avg_score)||0),count:own?own.length:(Number(s.attempts_count)||0)};
    });
  }else{
    ranked=db.users.filter(u=>u.role==='student'&&(isTeacher()||u.grade===currentUser.grade)).map(s=>{
      const scores=db.attempts.filter(a=>String(getAttemptStudentId(a))===String(s.id)).map(a=>Number(a.score)||0);
      return {id:s.id,full_name:s.full_name||s.fullName,grade:s.grade,xp:Number(s.xp)||0,avg:avgOf(scores),count:scores.length};
    });
  }
  ranked=ranked.filter(s=>!gradeFilter||s.grade===gradeFilter).sort((a,b)=>b.xp!==a.xp?b.xp-a.xp:b.avg-a.avg);
  const el=document.getElementById('leaderboardList');
  if(!el) return;
  el.innerHTML=ranked.map((s,i)=>{
    let rankClass=''; if(i===0) rankClass='gold'; else if(i===1) rankClass='silver'; else if(i===2) rankClass='bronze';
    const mine=!isTeacher()&&String(s.id)===String(currentUser.id);
    return `<div class="leaderboard-item" ${mine?'style="border-color:var(--accent)"':''}><div class="leaderboard-rank ${rankClass}">${i+1}</div><div style="flex:1"><b>${escapeHtml(s.full_name||'')}</b>${mine?' <span class="badge">أنت</span>':''}<div class="muted">${escapeHtml(s.grade||'')} • ${s.count} امتحان • متوسط ${s.avg}% • المستوى ${Math.floor(s.xp/100)+1}</div></div><b style="color:var(--accent)">${s.xp} XP</b></div>`;
  }).join('')||'<div class="empty">لا يوجد طلاب بعد</div>';
}

// الصفوف والنتائج موجودة في management.js

// إشعارات ورسائل
function visibleNotifications(db){
  return db.notifications.filter(n=>isTeacher()||((!n.target_user||String(n.target_user)===String(currentUser.id))&&(!n.target_grade||n.target_grade==='الكل'||n.target_grade===currentUser.grade)))
    .slice().sort((x,y)=>new Date(y.created_at)-new Date(x.created_at));
}
function renderNotifications(){
  const db=getDB();
  const el=document.getElementById('notificationsList');
  if(!el) return;
  el.innerHTML=visibleNotifications(db).map(n=>`<div class="list-item"><div style="flex:1"><b>${escapeHtml(n.title||'إشعار')}</b><div class="muted">${escapeHtml(n.message||'')}</div><small class="muted">${new Date(n.created_at).toLocaleString('ar-EG')} • ${escapeHtml(n.target_grade||'الكل')}</small></div>${isTeacher()?`<button class="btn small danger" title="حذف الإشعار" onclick="deleteNotification(${jsArg(n.id)})">🗑️ حذف</button>`:''}</div>`).join('')||'<div class="empty">لا توجد إشعارات</div>';
}
function renderHomeNotices(){
  const el=document.getElementById('homeNotices');
  if(!el||isTeacher())return;
  const list=visibleNotifications(getDB()).slice(0,3);
  el.innerHTML=list.map(n=>`<div class="list-item notice" onclick="showPage('messages')"><div><b>📢 ${escapeHtml(n.title||'إشعار')}</b><div class="muted">${escapeHtml(n.message||'')}</div><small class="muted">${new Date(n.created_at).toLocaleDateString('ar-EG')}</small></div></div>`).join('')||'<div class="empty">لا توجد إشعارات جديدة من المستر</div>';
}
async function deleteNotification(id){
  if(!isTeacher())return;
  if(!confirm('حذف هذا الإشعار نهائيًا؟ سيختفي عند كل الطلاب.'))return;
  const db=getDB();
  db.notifications=db.notifications.filter(n=>String(n.id)!==String(id));
  try{await saveDB(db);}catch(e){return;}
  renderNotifications();
  toast('تم حذف الإشعار 🗑️');
}

async function sendNotification(){
  const title=document.getElementById('notifTitle').value.trim();
  const msg=document.getElementById('notifMsg').value.trim();
  const grade=document.getElementById('notifGrade').value;
  if(!title||!msg){toast('العنوان والرسالة مطلوبان');return;}
  const db=getDB();
  db.notifications.push({id:String(Date.now()),title,message:msg,target_grade:grade||'الكل',created_by:currentUser.id,created_at:new Date().toISOString()});
  try{await saveDB(db);}catch(e){return;}
  document.getElementById('notifTitle').value=''; document.getElementById('notifMsg').value='';
  renderNotifications();
  toast('تم إرسال الإشعار ✅');
}

function renderMessages(){
  const db=getDB();
  const el=document.getElementById('messagesList');
  if(!el) return;
  const myMessages=db.messages.filter(m=>m.receiver_id===currentUser.id || m.sender_id===currentUser.id).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
  el.innerHTML=myMessages.map(m=>{
    const isMe=m.sender_id===currentUser.id;
    const otherId=isMe?m.receiver_id:m.sender_id;
    const other=db.users.find(u=>u.id===otherId);
    return `<div class="list-item" style="${isMe?'background:var(--surface-3)':''}"><div><b>${escapeHtml(isMe?'أنت → '+(other?.full_name||other?.fullName||'مستر'):(other?.full_name||other?.fullName||'مجهول'))}</b><div>${escapeHtml(m.content)}</div><small class="muted">${new Date(m.created_at).toLocaleString('ar-EG')}</small></div></div>`;
  }).join('')||'<div class="empty">لا توجد رسائل</div>';
  
  // قائمة المستلمين
  const receiverSel=document.getElementById('msgReceiver');
  if(receiverSel){
    const students=db.users.filter(u=>u.role==='student');
    const teachers=db.users.filter(u=>['teacher','admin','owner'].includes(u.role));
    const options=isTeacher()?students.map(s=>`<option value="${escapeHtml(s.id)}">${escapeHtml(s.full_name||s.fullName||'طالب')} - ${escapeHtml(s.grade||'')}</option>`).join(''):teachers.map(t=>`<option value="${escapeHtml(t.id)}">${escapeHtml(t.full_name||t.fullName||'مستر')}</option>`).join('');
    receiverSel.innerHTML=options;
  }
}

async function sendMessage(){
  const receiverId=document.getElementById('msgReceiver').value;
  const content=document.getElementById('msgContent').value.trim();
  if(!receiverId){toast(isTeacher()?'اختر الطالب أولًا':'تعذر تحديد المستر. حدّث الصفحة أو شغّل ملف SUPABASE_V11_PATCH.sql');return;}
  if(!content){toast('اكتب رسالة');return;}
  const db=getDB();
  db.messages.push({id:String(Date.now()),sender_id:currentUser.id,receiver_id:receiverId,content,read:false,created_at:new Date().toISOString()});
  try{await saveDB(db);}catch(e){return;}
  document.getElementById('msgContent').value='';
  renderMessages();
  toast('تم إرسال الرسالة ✅');
}

async function saveProfile(){
  if(!isTeacher()){toast('بيانات الطالب لا يمكن تعديلها من حسابه؛ اطلب المساعدة من المستر');return;}
  const name=document.getElementById('pf_name')?.value.trim()||'';
  const phone=document.getElementById('pf_phone')?.value.trim()||'';
  const parent=document.getElementById('pf_parent')?.value.trim()||'';
  if(!name){toast('الاسم مطلوب');return;}
  const db=getDB();
  const user=db.users.find(u=>String(u.id)===String(currentUser.id));
  if(!user){toast('الحساب غير موجود');return;}
  if(phone && !/^01[0-9]{9}$/.test(phone)){toast('رقم الهاتف غير صحيح');return;}
  user.full_name=name;user.fullName=name;
  if(phone){user.phone=phone;user.phone2=phone;}
  user.parent_phone=parent;user.parentPhone=parent;
  try{await saveDB(db);}catch(e){return;}
  currentUser=user;
  document.getElementById('profileName').textContent=name;
  document.getElementById('userNameTop').textContent=name;
  toast('تم حفظ التعديلات ✅');
}


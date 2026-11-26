// management.js - الصفوف الدراسية ونتائج الطلاب


// التاريخ المحلي (toISOString يعطي توقيت UTC فيُسجَّل الحضور على يوم خاطئ بعد منتصف الليل في مصر)
function todayLocal(){
  const d=new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function gradeOptionsHtml(selected,allLabel){
  const grades=(typeof lessonGrades!=='undefined')?lessonGrades:[];
  return (allLabel?`<option value="">${escapeHtml(allLabel)}</option>`:'')+grades.map(g=>`<option value="${escapeHtml(g)}" ${g===selected?'selected':''}>${escapeHtml(g)}</option>`).join('');
}
function studentName(db,id){
  const u=db.users.find(x=>String(x.id)===String(id));
  return u?(u.full_name||u.fullName||'طالب'):'طالب محذوف';
}
function avgOf(list){return list.length?Math.round(list.reduce((a,b)=>a+(Number(b)||0),0)/list.length):0;}

// ====================== الصفوف الدراسية ======================
function renderGradeClasses(){
  if(!isTeacher())return;
  const host=document.getElementById('classesList');if(!host)return;
  const db=getDB();
  const names=[...new Set([...lessonGrades,...(db.gradesClasses||[]).map(g=>g.name)])];
  host.innerHTML=names.map(g=>{
    const studs=db.users.filter(u=>u.role==='student'&&u.grade===g);
    const ids=new Set(studs.map(s=>String(s.id)));
    const scores=db.attempts.filter(a=>ids.has(String(a.student_id))).map(a=>a.score);
    return `<div class="card" onclick="openGradeDetail(${jsArg(g)})"><div class="label">${escapeHtml(g)}</div><b>${studs.length} طالب</b><small class="muted">${db.lessons.filter(l=>l.grade===g).length} درس • ${db.exams.filter(e=>e.grade===g).length} امتحان • متوسط ${avgOf(scores)}%</small></div>`;
  }).join('');
}
function openGradeDetail(grade){
  if(!isTeacher())return;
  const db=getDB();
  const studs=db.users.filter(u=>u.role==='student'&&u.grade===grade).map(s=>({s,avg:avgOf(db.attempts.filter(a=>String(a.student_id)===String(s.id)).map(a=>a.score))}))
    .sort((a,b)=>(Number(b.s.xp)||0)-(Number(a.s.xp)||0));
  const html=studs.map(({s,avg},i)=>`<div class="list-item" onclick="openStudentDetail(${jsArg(s.id)})"><div><b>${i+1}. ${escapeHtml(s.full_name||'')}</b><div class="muted">${escapeHtml(s.phone||'')} • ولي الأمر: ${escapeHtml(s.parent_phone||'')}</div></div><div><span class="badge">${Number(s.xp)||0} XP</span> <span class="badge ${avg>=50?'green':'red'}">${avg}%</span></div></div>`).join('')||'<div class="empty">لا يوجد طلاب في هذا الصف بعد</div>';
  openModal(`🏫 ${grade} (${studs.length} طالب)`,`<div class="list">${html}</div>`);
}

// ====================== النتائج ======================
function renderResults(){
  if(!isTeacher())return;
  const host=document.getElementById('resultsList');if(!host)return;
  const db=getDB();
  const gradeSel=document.getElementById('resGrade'),examSel=document.getElementById('resExam');
  if(gradeSel&&!gradeSel.options.length)gradeSel.innerHTML=gradeOptionsHtml('', 'كل الصفوف');
  if(examSel){
    const prev=examSel.value;
    examSel.innerHTML='<option value="">كل الامتحانات</option>'+db.exams.map(e=>`<option value="${escapeHtml(e.id)}">${escapeHtml(e.title)} - ${escapeHtml(e.grade||'')}</option>`).join('');
    examSel.value=prev;
  }
  const rows=filteredResults(db);
  const avg=avgOf(rows.map(r=>r.score)),pass=rows.length?Math.round(rows.filter(r=>r.score>=50).length/rows.length*100):0;
  const sum=document.getElementById('resultsSummary');
  if(sum)sum.innerHTML=`<span class="badge">${rows.length} محاولة</span> <span class="badge">متوسط ${avg}%</span> <span class="badge green">نجاح ${pass}%</span>`;
  host.innerHTML=rows.slice(0,300).map(r=>`<div class="list-item" onclick="openAttemptDetail(${jsArg(r.id)})"><div><b>${escapeHtml(r.name)}</b> <span class="muted">${escapeHtml(r.grade||'')}</span><div class="muted">${escapeHtml(r.exam_title||'امتحان')} • ${new Date(r.created_at).toLocaleString('ar-EG')} • ${r.correct}/${r.total} صح</div></div><span class="badge ${r.score>=50?'green':'red'}">${r.score}%</span></div>`).join('')||'<div class="empty">لا توجد نتائج مطابقة</div>'
    +(rows.length>300?`<div class="muted" style="text-align:center;padding:8px">يُعرض أحدث 300 نتيجة من ${rows.length}. استخدم التصدير للحصول على الكل.</div>`:'');
}
function filteredResults(db){
  const grade=document.getElementById('resGrade')?.value||'',exam=document.getElementById('resExam')?.value||'';
  const q=(document.getElementById('resSearch')?.value||'').trim().toLowerCase();
  return db.attempts.map(a=>{
    const u=db.users.find(x=>String(x.id)===String(a.student_id));
    return {...a,score:Number(a.score)||0,name:u?(u.full_name||'طالب'):'طالب محذوف',grade:u?.grade||a.grade||''};
  }).filter(r=>(!grade||r.grade===grade)&&(!exam||String(r.exam_id)===String(exam))&&(!q||r.name.toLowerCase().includes(q)))
    .sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
}
// منع حقن الصيغ في Excel: الاسم يأتي من الطلاب، فنسبق أي قيمة تبدأ برمز صيغة بعلامة '
function csvCell(v){
  let s=String(v??'');
  if(/^[=+\-@\t\r]/.test(s))s="'"+s;
  return `"${s.replace(/"/g,'""')}"`;
}
function exportResultsCsv(){
  if(!isTeacher())return;
  const rows=filteredResults(getDB());
  if(!rows.length){toast('لا توجد نتائج للتصدير');return;}
  const head=['الطالب','الصف','الامتحان','الدرجة %','الصحيح','الإجمالي','التاريخ'];
  const lines=[head,...rows.map(r=>[r.name,r.grade,r.exam_title,r.score,r.correct,r.total,new Date(r.created_at).toLocaleString('ar-EG')])];
  const blob=new Blob(['﻿'+lines.map(l=>l.map(csvCell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`نتائج-${todayLocal()}.csv`;
  document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),2000);
}

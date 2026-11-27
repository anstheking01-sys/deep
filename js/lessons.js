const MAX_UPLOAD_MB=50; // لازم يساوي حد الـ bucket في Supabase (SUPABASE_V12_PATCH.sql)
// بطاقة موحدة بسيطة: أيقونة + عنوان + وصف قصير + شارات
function lessonCardHtml({icon,title,desc,chips,onclick,actions}){
  const cs=(chips||[]).filter(Boolean).map(c=>typeof c==='string'?{t:c}:c);
  return `<div class="lesson" ${onclick?`onclick="${onclick}"`:''}><div class="lesson-top"><span class="lesson-ico">${icon}</span><div style="min-width:0"><h4>${escapeHtml(title)}</h4>${desc?`<p>${escapeHtml(desc)}</p>`:''}</div></div><div class="chips">${cs.map(c=>`<span class="chip ${c.cls||''}">${escapeHtml(c.t)}</span>`).join('')}</div>${actions||''}</div>`;
}
// lessons.js - الدروس والتدريبات الاختيارية
let lessonTrainingQuestions=[];
const lessonGrades=['الأول الإعدادي','الثاني الإعدادي','الثالث الإعدادي','الأول الثانوي','الثاني الثانوي','الثالث الثانوي'];
function renderLessons(){
  const q=(document.getElementById('lessonSearch')?.value||'').toLowerCase(); const db=getDB();
  const lessons=db.lessons.filter(l=>visibleToCurrentStudent(l)&&((l.title||'')+(l.description||'')).toLowerCase().includes(q));
  const card=l=>lessonCardHtml({icon:'📘',title:l.title,desc:l.description,onclick:`viewLesson(${l.id})`,
    chips:[l.grade||'عام',(l.training_questions||[]).length?`${l.training_questions.length} سؤال تدريب`:'',(l.attachments||[]).length?`${l.attachments.length} مرفقات`:''],
    actions:isTeacher()?`<div style="display:flex;gap:6px" onclick="event.stopPropagation()"><button class="btn small sec" onclick="openLessonModal(${l.id})">✏️ تعديل</button><button class="btn small danger" onclick="deleteLesson(${l.id})">🗑️ حذف</button></div>`:''});
  const allEl=document.getElementById('allLessons'),homeEl=document.getElementById('homeLessons');
  if(allEl) allEl.innerHTML=lessons.map(card).join('')||'<div class="empty">لا توجد دروس</div>';
  if(homeEl) homeEl.innerHTML=db.lessons.filter(visibleToCurrentStudent).slice(0,3).map(card).join('')||'<div class="empty">لا توجد دروس بعد</div>';
}
function renderTrainingBuilder(){
 const host=document.getElementById('trainingQuestionsBuilder'); if(!host)return; host.innerHTML='';
 lessonTrainingQuestions.forEach((q,i)=>{
  const box=document.createElement('div');box.className='box';box.style.margin='10px 0';
  box.innerHTML=`<b>سؤال التدريب ${i+1}</b><button type="button" class="btn small danger" style="float:left" data-del="${i}">حذف</button><input data-q="${i}" placeholder="اكتب السؤال" value="${escapeHtml(q.q||'')}"><div class="row">${[0,1,2,3].map(j=>`<input data-opt="${i}:${j}" placeholder="اختيار ${j+1}" value="${escapeHtml(q.opts?.[j]||'')}">`).join('')}</div><label class="muted">الإجابة الصحيحة</label><select data-ans="${i}">${[0,1,2,3].map(j=>`<option value="${j}" ${Number(q.ans)===j?'selected':''}>اختيار ${j+1}</option>`).join('')}</select>`;
  host.appendChild(box);
 });
 host.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{lessonTrainingQuestions.splice(Number(b.dataset.del),1);renderTrainingBuilder()});
 host.querySelectorAll('[data-q]').forEach(x=>x.oninput=()=>lessonTrainingQuestions[Number(x.dataset.q)].q=x.value);
 host.querySelectorAll('[data-opt]').forEach(x=>x.oninput=()=>{const [i,j]=x.dataset.opt.split(':').map(Number);lessonTrainingQuestions[i].opts[j]=x.value});
 host.querySelectorAll('[data-ans]').forEach(x=>x.onchange=()=>lessonTrainingQuestions[Number(x.dataset.ans)].ans=Number(x.value));
}
function existingAttachmentsHtml(list){
 if(!(list||[]).length)return '';
 return `<div class="box" style="margin:10px 0"><b>المرفقات الحالية</b><div class="muted">علّم على المرفق لحذفه عند الحفظ</div>${list.map((a,i)=>`<label style="display:flex;gap:8px;align-items:center;margin-top:6px;cursor:pointer"><input type="checkbox" class="rm-att" value="${i}" style="width:auto;margin:0"> 🗑️ ${escapeHtml(a.name||'ملف')}</label>`).join('')}</div>`;
}
function takeRemovedAttachments(old){
 const idx=new Set([...document.querySelectorAll('.rm-att:checked')].map(x=>Number(x.value)));
 const all=[...(old?.attachments||[])];
 return {kept:all.filter((_,i)=>!idx.has(i)),removed:all.filter((_,i)=>idx.has(i))};
}
// يقبل صور data:image فقط لمنع أي رابط خبيث داخل بيانات الأسئلة
function safeImageSrc(v){const x=String(v||'');return /^data:image\/(png|jpe?g|gif|webp);base64,[A-Za-z0-9+\/=]+$/.test(x)?x:'';}
function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function openLessonModal(id){
 if(!isTeacher()){toast('غير مصرح');return;} const db=getDB(),l=id?db.lessons.find(x=>x.id===id):null;
 lessonTrainingQuestions=(l?.training_questions||[]).map(q=>({...q,opts:[...(q.opts||['','','',''])]}));
 const oldTypes=new Set(l?.content_types||['text',...(l?.youtube_url?['youtube']:[]),...((l?.attachments||[]).some(a=>a.type==='application/pdf')?['pdf']:[]),...((l?.attachments||[]).some(a=>(a.type||'').startsWith('image/'))?['image']:[]),...((l?.attachments||[]).some(a=>(a.type||'').startsWith('video/'))?['video']:[])]);
 openModal(id?'تعديل درس':'إضافة درس',`
 <input id="m_title" placeholder="عنوان الدرس" value="${escapeHtml(l?.title||'')}">
 <textarea id="m_desc" placeholder="وصف قصير">${escapeHtml(l?.description||'')}</textarea>
 <h4>اختار محتوى الدرس (تقدر تختار أكتر من نوع)</h4>
 <div class="lesson-type-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin:8px 0 14px">
 ${[['text','شرح نصي'],['pdf','ملف PDF'],['image','صورة'],['video','فيديو عادي'],['youtube','فيديو يوتيوب']].map(([v,t])=>`<label class="box" style="display:flex;gap:8px;align-items:center;cursor:pointer"><input type="checkbox" class="lesson-type-check" value="${v}" ${oldTypes.has(v)?'checked':''} style="width:auto;margin:0"> ${t}</label>`).join('')}
 </div>
 <div id="lessonTypeFields">
 <div data-type-field="text"><label class="muted">شرح نصي</label><textarea id="m_content" placeholder="اكتب شرح الدرس">${escapeHtml(l?.content||'')}</textarea></div>
 <div data-type-field="pdf"><label class="muted">اختيار ملف PDF</label><input id="m_pdf" type="file" accept="application/pdf,.pdf" multiple></div>
 <div data-type-field="image"><label class="muted">اختيار صور</label><input id="m_image" type="file" accept="image/*" multiple></div>
 <div data-type-field="video"><label class="muted">اختيار فيديو من الجهاز</label><input id="m_video" type="file" accept="video/*" multiple></div>
 <div data-type-field="youtube"><label class="muted">رابط فيديو يوتيوب</label><input id="m_youtube" placeholder="https://youtube.com/..." value="${escapeHtml(l?.youtube_url||l?.video_url||'')}"></div>
 </div>
 ${existingAttachmentsHtml(l?.attachments)}
 <small class="muted">يمكنك اختيار أكتر من نوع وإضافة أكتر من ملف. الحد الأقصى 50 ميجابايت لكل ملف (للأكبر استخدم رابط Google Drive).</small>
 <label class="muted">الصف الذي سيظهر له الدرس</label><select id="m_grade">${lessonGrades.map(g=>`<option>${g}</option>`).join('')}</select>
 <label class="muted">نقاط XP عند إكمال التدريب</label><input id="m_xp" type="number" min="0" max="10000" value="${l?.xp_reward??10}">
 <h4>📝 أسئلة تدريب بعد الدرس (اختيار من متعدد - حتى 10)</h4><div id="trainingQuestionsBuilder"></div>
 <button type="button" id="addTrainingQuestion" class="btn sec">+ إضافة سؤال تدريب</button>
 <button class="btn" onclick="saveLesson(${id||0})" style="margin-top:12px">💾 حفظ الدرس</button>`);
 const gs=document.getElementById('m_grade');gs.value=l?.grade||'الأول الإعدادي';
 const syncTypeFields=()=>{const chosen=[...document.querySelectorAll('.lesson-type-check:checked')].map(x=>x.value);document.querySelectorAll('[data-type-field]').forEach(el=>el.style.display=chosen.includes(el.dataset.typeField)?'block':'none')};
 document.querySelectorAll('.lesson-type-check').forEach(x=>x.addEventListener('change',syncTypeFields));syncTypeFields();
 renderTrainingBuilder(); document.getElementById('addTrainingQuestion').onclick=()=>{if(lessonTrainingQuestions.length>=10){toast('التدريب بحد أقصى 10 أسئلة');return;}lessonTrainingQuestions.push({q:'',opts:['','','',''],ans:0});renderTrainingBuilder()};
}
async function fileToData(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file)})}
async function saveLesson(id){
 if(!isTeacher())return;const title=document.getElementById('m_title').value.trim();if(!title){toast('عنوان الدرس مطلوب');return;}
 const selectedTypes=[...document.querySelectorAll('.lesson-type-check:checked')].map(x=>x.value);if(!selectedTypes.length){toast('اختار نوع محتوى واحد على الأقل');return;}
 const fileInputs=[['pdf',document.getElementById('m_pdf')],['image',document.getElementById('m_image')],['video',document.getElementById('m_video')]];
 const files=fileInputs.filter(([type])=>selectedTypes.includes(type)).flatMap(([type,input])=>[...(input?.files||[])].map(file=>({file,type})));
 if(files.some(x=>x.file.size>MAX_UPLOAD_MB*1024*1024)){toast(`فيه ملف أكبر من ${MAX_UPLOAD_MB} ميجابايت. ارفعه على Google Drive`);return;}
 const db=getDB(),old=id?db.lessons.find(x=>x.id===id):null;const {kept,removed}=takeRemovedAttachments(old);let attachments=kept;
 try{for(const {file,type} of files){
   const stored=await uploadPrivateFile('lesson-files',document.getElementById('m_grade').value,file,'lessons');
   attachments.push({name:file.name,type:file.type||(type==='pdf'?'application/pdf':type==='video'?'video/mp4':'image/*'),content_type:type,...stored});
 }}catch(e){toast(`تعذر رفع المرفق إلى التخزين الخاص: ${e.message||''}`);return;}
 const questions=lessonTrainingQuestions.filter(q=>q.q.trim()&&q.opts.every(o=>o.trim()));
 if(questions.length!==lessonTrainingQuestions.length){toast('اكمل نص السؤال والاختيارات الأربعة أو احذف السؤال الناقص');return;}
 const item={id:id||Date.now(),title,description:document.getElementById('m_desc').value,content:selectedTypes.includes('text')?document.getElementById('m_content').value:'',content_types:selectedTypes,category:'عام',youtube_url:selectedTypes.includes('youtube')?document.getElementById('m_youtube').value.trim():'',grade:document.getElementById('m_grade').value,xp_reward:Math.max(0,Math.min(10000,Number(document.getElementById('m_xp').value)||0)),training_questions:questions,attachments,created_by:currentUser.id,created_at:old?.created_at||new Date().toISOString()};
 if(old)Object.assign(old,item);else db.lessons.push(item);try{await saveDB(db);}catch(e){return;}if(removed.length)await removePrivateAttachments(removed);closeModal();renderLessons();toast('تم حفظ الدرس والتدريب والمرفقات على المنصة');
}
async function deleteLesson(id){if(!confirm('حذف الدرس؟'))return;const db=getDB(),old=db.lessons.find(x=>String(x.id)===String(id));db.lessons=db.lessons.filter(x=>String(x.id)!==String(id));db.lessonCompletions=(db.lessonCompletions||[]).filter(x=>String(x.lesson_id)!==String(id));try{await saveDB(db);acceptRemoteRpcState();if(old)await removePrivateAttachments(old.attachments||[]);renderLessons();toast('تم حذف الدرس');}catch(e){}}
function getLessonCompletion(db,id,userId){
 return (db.lessonCompletions||[]).find(x=>Number(x.lesson_id)===Number(id)&&String(x.student_id)===String(userId));
}
function getStudentLessonProgress(db,userId){
 return (db.lessonProgress||[]).find(x=>String(x.student_id)===String(userId));
}
function calculateTrainingGrade(correct,total,maxXP){
 const count=Math.max(0,Number(total)||0);
 const right=Math.max(0,Math.min(count,Number(correct)||0));
 const xpCap=Math.max(0,Number(maxXP)||0);
 const ratio=count?right/count:0;
 return {correct:right,total:count,percentage:count?Math.round(ratio*100):0,xpEarned:Math.round(xpCap*ratio)};
}
async function saveStudentLessonProgress(lesson,activity='lesson',completed=false){
 if(!currentUser||isTeacher()||!lesson)return;
 const db=getDB();if(!db.lessonProgress)db.lessonProgress=[];
 let row=getStudentLessonProgress(db,currentUser.id);
 if(!row){row={student_id:currentUser.id};db.lessonProgress.push(row);}
 const previousLessonId=row.last_lesson_id;
 row.last_lesson_id=lesson.id;
 row.last_lesson_title=lesson.title||'درس';
 row.last_lesson_at=new Date().toISOString();
 row.last_activity=activity;
 if(completed){row.completed_training=true;row.training_completed_at=new Date().toISOString();}
 else if(String(previousLessonId)!==String(lesson.id)){row.completed_training=false;}
 const completion=getLessonCompletion(db,lesson.id,currentUser.id);
 if(completion)row.completed_training=true;
 await saveDB(db);
 if(typeof renderDashboard==='function')renderDashboard();
}
function viewLesson(id){
 const db=getDB(),l=db.lessons.find(x=>Number(x.id)===Number(id));if(!l){toast('الدرس غير موجود');return;}
 const qs=l.training_questions||[];
 const done=!!(currentUser&&getLessonCompletion(db,l.id,currentUser.id));
 openModal(l.title,`<div class="lesson-choice"><p>${escapeHtml(l.description||'اختار هتدخل على إيه')}</p><div class="muted" style="margin-bottom:12px">الصف: ${escapeHtml(l.grade||'عام')} • ${qs.length} سؤال تدريب</div><div class="lesson-choice-actions"><button class="btn" onclick="showLessonContent(${l.id})">📖 مشاهدة الدرس</button><button class="btn sec" ${qs.length?'':'disabled'} onclick="startLessonTraining(${l.id})">✍️ ${done?'عرض التدريب (مكتمل)':'دخول التدريب'}</button></div>${!qs.length?'<small class="muted" style="display:block;margin-top:10px">لا يوجد تدريب مضاف لهذا الدرس حاليًا.</small>':''}</div>`);
}
function buildLessonContent(l){
 let html=`<p>${escapeHtml(l.description||'')}</p><div class="muted">الصف: ${escapeHtml(l.grade||'عام')}</div>${(l.content||'').trim()?`<div class="box" style="white-space:pre-wrap;margin:12px 0">${escapeHtml(l.content)}</div>`:''}`;
 if(l.youtube_url||l.video_url||l.video)html+=`<a class="btn" style="display:block;text-align:center;text-decoration:none;margin:8px 0" target="_blank" rel="noopener" href="${escapeHtml(l.youtube_url||l.video_url||l.video)}">▶ مشاهدة فيديو يوتيوب</a>`;
 (l.attachments||[]).forEach(a=>{if(a.content_type==='image'||(a.type||'').startsWith('image/'))html+=`<div><img alt="${escapeHtml(a.name)}" ${a.path?`data-storage-bucket="${escapeHtml(a.bucket||'lesson-files')}" data-storage-path="${escapeHtml(a.path)}"`:`src="${a.data||''}"`} style="max-width:100%;border-radius:10px;margin:8px 0"></div>`;else if(a.content_type==='video'||(a.type||'').startsWith('video/'))html+=`<video controls style="width:100%;max-height:360px" ${a.path?`data-storage-bucket="${escapeHtml(a.bucket||'lesson-files')}" data-storage-path="${escapeHtml(a.path)}"`:`src="${a.data||''}"`}></video>`;else if(isPdfAtt(a)&&a.path)html+=pdfBtnHtml(a);else html+=`<a class="btn sec" target="_blank" rel="noopener" download="${escapeHtml(a.name)}" ${a.path?`data-storage-bucket="${escapeHtml(a.bucket||'lesson-files')}" data-storage-path="${escapeHtml(a.path)}"`:`href="${a.data||''}"`} style="display:block;text-align:center;text-decoration:none;margin:8px 0">📄 ${escapeHtml(a.name)} - فتح/تحميل</a>`;});
 if(l.image_url||l.imageData)html+=`<img alt="صورة الدرس" src="${l.image_url||l.imageData}" style="max-width:100%">`;
 if(l.pdf_url||l.pdfData)html+=`<a class="btn sec" href="${l.pdf_url||l.pdfData}" download="${escapeHtml(l.pdf_name||'lesson.pdf')}">تحميل PDF</a>`;
 return html;
}
async function showLessonContent(id){
 window.pdfBack=`showLessonContent(${id})`;
 const db=getDB(),l=db.lessons.find(x=>Number(x.id)===Number(id));if(!l){toast('الدرس غير موجود');return;}
 await saveStudentLessonProgress(l,'lesson');
 const qs=l.training_questions||[];
 const actions=qs.length?`<div class="lesson-bottom-actions"><button class="btn" onclick="startLessonTraining(${l.id})">➡️ الانتقال إلى التدريب</button><button class="btn sec" onclick="closeModal()">خروج</button></div>`:`<div class="lesson-bottom-actions"><button class="btn sec" onclick="closeModal()">خروج</button></div>`;
 openModal(l.title,`${buildLessonContent(l)}${actions}`);
 await hydrateStorageElements(document.getElementById('modalBody'));
}
async function startLessonTraining(id){
 const db=getDB(),l=db.lessons.find(x=>Number(x.id)===Number(id));if(!l){toast('الدرس غير موجود');return;}
 const qs=l.training_questions||[];if(!qs.length){toast('لا يوجد تدريب لهذا الدرس');return;}
 await saveStudentLessonProgress(l,'training');
 const completion=currentUser&&!isTeacher()?getLessonCompletion(db,l.id,currentUser.id):null;
 let html=`<p class="muted">تدريب مرتبط بالدرس: ${escapeHtml(l.title)}</p>`;
 const maxXP=Math.max(0,Number(l.xp_reward??10));
 html+=`<div class="box" style="margin-bottom:12px">كل سؤال له نفس الوزن؛ الدرجة تُحسب بنسبة إجاباتك الصحيحة من إجمالي الأسئلة. الحد الأقصى للمكافأة ${maxXP} XP.</div>`;
 if(completion){const oldGrade=calculateTrainingGrade(completion.score,completion.total,maxXP);const oldPct=Number.isFinite(Number(completion.percentage))?Number(completion.percentage):oldGrade.percentage;const oldReward=completion.xp_earned!==undefined?`المكافأة السابقة: ${Number(completion.xp_earned)||0} XP.`:'تم إكماله قبل تحديث طريقة احتساب النقاط.';html+=`<div class="box" style="margin-bottom:12px">✅ أكملت هذا التدريب من قبل: ${completion.score}/${completion.total} (${oldPct}%). ${oldReward} لن تُضاف نقاط مرة ثانية.</div>`;}
 qs.forEach((q,i)=>{html+=`<div class="exam-question"><b>${i+1}. ${escapeHtml(q.q)}</b>${shuffle((q.opts||[]).map((o,j)=>[o,j])).map(([o,j])=>`<label class="exam-opt"><input type="radio" name="lq_${i}" value="${j}"> ${escapeHtml(o)}</label>`).join('')}</div>`;});
 html+=`<div class="lesson-bottom-actions"><button class="btn" onclick="submitLessonTraining(${l.id})">تسليم التدريب</button><button class="btn sec" onclick="closeModal()">خروج</button></div>`;
 openModal(`تدريب: ${l.title}`,html);
}
async function submitLessonTraining(id){
 const db=getDB(),l=db.lessons.find(x=>Number(x.id)===Number(id));
 if(!l||!currentUser){toast('الدرس أو الحساب غير موجود');return;}
 const previous=getLessonCompletion(db,id,currentUser.id);
 const qs=l.training_questions||[];
 if(!qs.length){toast('لا يوجد تدريب لهذا الدرس');return;}
 const answers=[];
 for(let i=0;i<qs.length;i++){
   const picked=document.querySelector(`input[name="lq_${i}"]:checked`);
   if(!picked){toast('جاوب على كل الأسئلة أولاً');return;}
   answers.push(Number(picked.value));
 }
 if(previous){
   const pct=Number(previous.percentage)||0;
   toast(`التدريب مكتمل بالفعل: ${previous.score}/${previous.total} (${pct}%). لن تُضاف نقاط مرة ثانية.`);
   closeModal();return;
 }
 showLoading('جاري تصحيح التدريب وحفظ النتيجة...');
 try{
   const {data,error}=await ensureCloud().rpc('submit_training',{p_lesson_id:String(l.id),p_answers:answers});
   if(error)throw error;
   const result=data||{};
   const completion={student_id:String(currentUser.id),lesson_id:l.id,score:Number(result.score)||0,total:Number(result.total)||answers.length,
     percentage:Number(result.percentage)||0,xp_earned:result.already_completed?0:(Number(result.xp_earned)||0),xp_max:Number(l.xp_reward)||0,completed_at:new Date().toISOString()};
   await saveStudentLessonProgress(l,'training',true);
   const completionIndex=db.lessonCompletions.findIndex(x=>String(x.student_id)===String(completion.student_id)&&String(x.lesson_id)===String(completion.lesson_id));
   if(completionIndex>=0)db.lessonCompletions[completionIndex]=completion;else db.lessonCompletions.push(completion);
   currentUser.xp=(Number(currentUser.xp)||0)+completion.xp_earned;
   const me=db.users.find(u=>String(u.id)===String(currentUser.id));if(me)me.xp=currentUser.xp;
   acceptRemoteRpcState();
   updateXPDisplay(currentUser.xp||0);closeModal();
   toast(`تم تصحيح التدريب: ${completion.score}/${completion.total} (${completion.percentage}%) • +${completion.xp_earned} XP`);
   renderTrainingList();renderDashboard();
 }catch(error){toast(`تعذر تصحيح التدريب: ${error.message||'حاول مرة أخرى'}`);}
 finally{hideLoading();}
}

function renderTrainingList(){
 const host=document.getElementById('trainingList');if(!host)return;
 const db=getDB(),q=(document.getElementById('trainingSearch')?.value||'').toLowerCase();
 const items=db.lessons.filter(l=>visibleToCurrentStudent(l)&&(l.training_questions||[]).length&&((l.title||'')+(l.description||'')).toLowerCase().includes(q));
 host.innerHTML=items.map(l=>{const done=!!(currentUser&&getLessonCompletion(db,l.id,currentUser.id));return lessonCardHtml({icon:'✍️',title:l.title,desc:l.description||'تدريب على محتوى الدرس',
   chips:[l.grade||'عام',`${l.training_questions.length} سؤال`,{t:done?'✅ مكتمل':'لم يكتمل',cls:done?'ok':''}],
   actions:`<div style="display:flex;gap:6px"><button class="btn small" style="flex:1" onclick="startLessonTraining(${l.id})">${done?'🔁 مراجعة التدريب':'▶️ ابدأ التدريب'}</button>${isTeacher()?`<button class="btn small sec" onclick="openLessonModal(${l.id})">✏️</button>`:''}</div>`});}).join('')||'<div class="empty">لا توجد تدريبات متاحة حاليًا</div>';
}

// ==================== الملازم والمنصة ====================
function resourceTypes(r){
 return new Set(r?.content_types||['text',...(r?.youtube_url?['youtube']:[]),...((r?.attachments||[]).some(a=>a.content_type==='pdf'||(a.type||'').startsWith('application/pdf'))?['pdf']:[]),...((r?.attachments||[]).some(a=>a.content_type==='image'||(a.type||'').startsWith('image/'))?['image']:[]),...((r?.attachments||[]).some(a=>a.content_type==='video'||(a.type||'').startsWith('video/'))?['video']:[])]);
}
function renderResources(){
 const host=document.getElementById('resourcesList');if(!host)return;
 const q=(document.getElementById('resourceSearch')?.value||'').toLowerCase(),db=getDB();
 const resources=(db.resources||[]).filter(r=>visibleToCurrentStudent(r)&&((r.title||'')+(r.description||'')).toLowerCase().includes(q));
 host.innerHTML=resources.map(r=>lessonCardHtml({icon:'📂',title:r.title,desc:r.description,onclick:`viewResource(${r.id})`,
   chips:[r.grade||'عام',(r.attachments||[]).length?`${r.attachments.length} مرفقات`:''],
   actions:isTeacher()?`<div style="display:flex;gap:6px" onclick="event.stopPropagation()"><button class="btn small sec" onclick="openResourceModal(${r.id})">✏️ تعديل</button><button class="btn small danger" onclick="deleteResource(${r.id})">🗑️ حذف</button></div>`:''})).join('')||'<div class="empty">لا توجد ملازم أو محتويات مضافة بعد</div>';
}
function openResourceModal(id){
 if(!isTeacher()){toast('غير مصرح');return;}
 const db=getDB(),r=id?(db.resources||[]).find(x=>Number(x.id)===Number(id)):null,types=resourceTypes(r);
 openModal(id?'تعديل محتوى':'إضافة محتوى للملازم / المنصة',`
 <input id="r_title" placeholder="عنوان المحتوى" value="${escapeHtml(r?.title||'')}">
 <textarea id="r_desc" placeholder="وصف قصير">${escapeHtml(r?.description||'')}</textarea>
 <h4>اختار أنواع المحتوى (يمكن اختيار أكثر من نوع)</h4>
 <div class="lesson-type-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin:8px 0 14px">
 ${[['text','شرح نصي'],['pdf','ملف PDF'],['image','صورة'],['video','فيديو عادي'],['youtube','فيديو يوتيوب'],['drive','رابط Google Drive (للملفات الكبيرة)']].map(([v,t])=>`<label class="box" style="display:flex;gap:8px;align-items:center;cursor:pointer"><input type="checkbox" class="resource-type-check" value="${v}" ${types.has(v)?'checked':''} style="width:auto;margin:0"> ${t}</label>`).join('')}
 </div>
 <div data-resource-field="text"><label class="muted">النص / الشرح</label><textarea id="r_content" placeholder="اكتب المحتوى">${escapeHtml(r?.content||'')}</textarea></div>
 <div data-resource-field="pdf"><label class="muted">ملفات PDF</label><input id="r_pdf" type="file" accept="application/pdf,.pdf" multiple></div>
 <div data-resource-field="image"><label class="muted">صور</label><input id="r_image" type="file" accept="image/*" multiple></div>
 <div data-resource-field="video"><label class="muted">فيديوهات من الجهاز</label><input id="r_video" type="file" accept="video/*" multiple></div>
 <div data-resource-field="youtube"><label class="muted">رابط يوتيوب</label><input id="r_youtube" placeholder="https://youtube.com/..." value="${escapeHtml(r?.youtube_url||'')}"></div>
 <div data-resource-field="drive"><label class="muted">رابط Google Drive (اجعل الملف "أي شخص لديه الرابط")</label><input id="r_drive" placeholder="https://drive.google.com/file/d/..." value="${escapeHtml(r?.drive_url||'')}"></div>
 ${existingAttachmentsHtml(r?.attachments)}
 <small class="muted">يمكن اختيار أكثر من نوع وإضافة أكثر من ملف. الحد الأقصى 50 ميجابايت لكل ملف (للأكبر استخدم رابط Google Drive).</small>
 <label class="muted">الصف الدراسي</label><select id="r_grade">${lessonGrades.map(g=>`<option>${g}</option>`).join('')}</select>
 <button class="btn" onclick="saveResource(${id||0})" style="margin-top:12px">💾 حفظ المحتوى</button>`);
 const grade=document.getElementById('r_grade');grade.value=r?.grade||'الأول الإعدادي';
 const sync=()=>{const chosen=[...document.querySelectorAll('.resource-type-check:checked')].map(x=>x.value);document.querySelectorAll('[data-resource-field]').forEach(el=>el.style.display=chosen.includes(el.dataset.resourceField)?'block':'none');};
 document.querySelectorAll('.resource-type-check').forEach(x=>x.addEventListener('change',sync));sync();
}
async function saveResource(id){
 if(!isTeacher())return;
 const title=document.getElementById('r_title').value.trim();if(!title){toast('عنوان المحتوى مطلوب');return;}
 const selected=[...document.querySelectorAll('.resource-type-check:checked')].map(x=>x.value);if(!selected.length){toast('اختار نوع محتوى واحد على الأقل');return;}
 const inputs=[['pdf',document.getElementById('r_pdf')],['image',document.getElementById('r_image')],['video',document.getElementById('r_video')]];
 const files=inputs.filter(([type])=>selected.includes(type)).flatMap(([type,input])=>[...(input?.files||[])].map(file=>({file,type})));
 if(files.some(x=>x.file.size>MAX_UPLOAD_MB*1024*1024)){toast(`فيه ملف أكبر من ${MAX_UPLOAD_MB} ميجابايت. ارفعه على Google Drive وحط الرابط`);return;}
 const driveUrl=selected.includes('drive')?document.getElementById('r_drive').value.trim():'';
 if(selected.includes('drive')&&!/^https:\/\/(drive|docs)\.google\.com\//i.test(driveUrl)){toast('الرابط لازم يبدأ بـ https://drive.google.com/');return;}
 const db=getDB();if(!db.resources)db.resources=[];const old=id?db.resources.find(x=>Number(x.id)===Number(id)):null;const {kept,removed}=takeRemovedAttachments(old);let attachments=kept;
 try{for(const {file,type} of files){const stored=await uploadPrivateFile('lesson-files',document.getElementById('r_grade').value,file,'resources');attachments.push({name:file.name,type:file.type||(type==='pdf'?'application/pdf':type==='video'?'video/mp4':'image/*'),content_type:type,...stored});}}catch(e){toast(`تعذر رفع المرفق: ${e.message||''}`);return;}
 const item={id:id||Date.now(),title,description:document.getElementById('r_desc').value,content:selected.includes('text')?document.getElementById('r_content').value:'',content_types:selected,category:'الملازم / المنصة',youtube_url:selected.includes('youtube')?document.getElementById('r_youtube').value.trim():'',drive_url:driveUrl,grade:document.getElementById('r_grade').value,attachments,created_by:currentUser.id,created_at:old?.created_at||new Date().toISOString()};
 if(old)Object.assign(old,item);else db.resources.push(item);
 try{await saveDB(db);}catch(e){return;}
 if(removed.length)await removePrivateAttachments(removed);
 closeModal();renderResources();toast('تم حفظ محتوى الملازم / المنصة');
}
async function viewResource(id){
 window.pdfBack=`viewResource(${id})`;
 const db=getDB(),r=(db.resources||[]).find(x=>Number(x.id)===Number(id));if(!r){toast('المحتوى غير موجود');return;}
 let html=`<p>${escapeHtml(r.description||'')}</p><div class="muted">الصف: ${escapeHtml(r.grade||'عام')}</div>${(r.content||'').trim()?`<div class="box" style="white-space:pre-wrap;margin:12px 0">${escapeHtml(r.content)}</div>`:''}`;
 if(r.youtube_url)html+=`<a class="btn" style="display:block;text-align:center;text-decoration:none;margin:8px 0" target="_blank" rel="noopener" href="${escapeHtml(r.youtube_url)}">▶ مشاهدة فيديو يوتيوب</a>`;
 if(r.drive_url&&driveEmbedUrl(r.drive_url))html+=`<iframe src="${escapeHtml(driveEmbedUrl(r.drive_url))}" allow="autoplay" referrerpolicy="no-referrer" style="width:100%;height:68vh;border:1px solid var(--border-color);border-radius:12px;background:#fff;margin:8px 0"></iframe>`;
 if(r.drive_url&&/^https:\/\/(drive|docs)\.google\.com\//i.test(r.drive_url))html+=`<a class="btn sec" style="display:block;text-align:center;text-decoration:none;margin:8px 0" target="_blank" rel="noopener noreferrer" href="${escapeHtml(r.drive_url)}">↗ فتح في تاب جديد</a>`;
 (r.attachments||[]).forEach(a=>{if(a.content_type==='image'||(a.type||'').startsWith('image/'))html+=`<div><img alt="${escapeHtml(a.name)}" ${a.path?`data-storage-bucket="${escapeHtml(a.bucket||'lesson-files')}" data-storage-path="${escapeHtml(a.path)}"`:`src="${a.data||''}"`} style="max-width:100%;border-radius:10px;margin:8px 0"></div>`;else if(a.content_type==='video'||(a.type||'').startsWith('video/'))html+=`<video controls style="width:100%;max-height:360px" ${a.path?`data-storage-bucket="${escapeHtml(a.bucket||'lesson-files')}" data-storage-path="${escapeHtml(a.path)}"`:`src="${a.data||''}"`}></video>`;else if(isPdfAtt(a)&&a.path)html+=pdfBtnHtml(a);else html+=`<a class="btn sec" target="_blank" rel="noopener" download="${escapeHtml(a.name)}" ${a.path?`data-storage-bucket="${escapeHtml(a.bucket||'lesson-files')}" data-storage-path="${escapeHtml(a.path)}"`:`href="${a.data||''}"`} style="display:block;text-align:center;text-decoration:none;margin:8px 0">📄 ${escapeHtml(a.name)} - فتح/تحميل</a>`;});
 html+=`<div class="lesson-bottom-actions"><button class="btn sec" onclick="closeModal()">خروج</button></div>`;
 openModal(r.title,html);
 await hydrateStorageElements(document.getElementById('modalBody'));
}
async function deleteResource(id){if(!confirm('حذف هذا المحتوى؟'))return;const db=getDB(),old=(db.resources||[]).find(x=>String(x.id)===String(id));db.resources=(db.resources||[]).filter(x=>String(x.id)!==String(id));try{await saveDB(db);if(old)await removePrivateAttachments(old.attachments||[]);renderResources();toast('تم الحذف');}catch(e){}}

// ---------- عرض PDF داخل الموقع ----------
function isPdfAtt(a){return a&&(a.content_type==='pdf'||/pdf/i.test(a.type||'')||/\.pdf$/i.test(a.name||''));}
function pdfBtnHtml(a){
  return `<button class="btn" style="display:block;width:100%;margin:8px 0" data-pdf-bucket="${escapeHtml(a.bucket||'lesson-files')}" data-pdf-path="${escapeHtml(a.path)}" data-pdf-name="${escapeHtml(a.name||'file.pdf')}" onclick="openPdfViewer(this)">📄 ${escapeHtml(a.name||'PDF')} — عرض</button>`;
}
async function openPdfViewer(btn){
  const {pdfBucket:bucket,pdfPath:path,pdfName:name}=btn.dataset,back=window.pdfBack||'closeModal()';
  showLoading('جاري فتح الملف...');
  try{
    const url=await resolvePrivateFileUrl(bucket,path);
    const res=await fetch(url);if(!res.ok)throw new Error('تعذر تحميل الملف');
    const blob=new Blob([await res.blob()],{type:'application/pdf'});
    if(window.pdfBlobUrl)URL.revokeObjectURL(window.pdfBlobUrl);
    const obj=window.pdfBlobUrl=URL.createObjectURL(blob);
    openModal(name,`<iframe src="${obj}" style="width:100%;height:70vh;border:1px solid var(--border-color);border-radius:12px;background:#fff"></iframe>
      <div class="lesson-bottom-actions"><a class="btn" href="${obj}" download="${escapeHtml(name)}" style="text-decoration:none;text-align:center">⬇ تحميل</a><a class="btn sec" href="${obj}" target="_blank" rel="noopener" style="text-decoration:none;text-align:center">↗ تاب جديد</a><button class="btn sec" onclick="${back}">→ رجوع</button></div>
      <small class="muted">لو الملف مش ظاهر على موبايلك استخدم "تاب جديد" أو "تحميل".</small>`);
  }catch(e){toast(e.message||'تعذر فتح الملف');}
  finally{hideLoading();}
}
// يحوّل رابط Google Drive/Docs إلى رابط معاينة قابل للتضمين داخل الموقع
function driveEmbedUrl(url){
  let m;
  if(!/^https:\/\/(drive|docs)\.google\.com\//i.test(url||''))return '';
  if((m=url.match(/\/(document|presentation|spreadsheets)\/d\/([\w-]+)/)))return `https://docs.google.com/${m[1]}/d/${m[2]}/preview`;
  if((m=url.match(/\/file\/d\/([\w-]+)/))||(m=url.match(/[?&]id=([\w-]+)/)))return `https://drive.google.com/file/d/${m[1]}/preview`;
  return '';
}

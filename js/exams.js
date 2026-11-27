
// exams.js - إدارة الامتحانات

function getExamsForUser(db,user){
  const exams=Array.isArray(db?.exams)?db.exams:[];
  if(user && ['teacher','admin','owner'].includes(user.role)) return exams;
  return exams.filter(ex=>!ex.grade || !user?.grade || ex.grade===user.grade);
}
function getAttemptExamId(attempt){return attempt?.exam_id??attempt?.examId;}
function getAttemptStudentId(attempt){return attempt?.student_id??attempt?.studentId;}

function renderExams(){
  const db=getDB();
  const exams=isTeacher()?db.exams:getExamsForUser(db,currentUser);
  const myAttempts=db.attempts.filter(a=>String(getAttemptStudentId(a))===String(currentUser.id));
  const html=exams.map(ex=>{
    const myEx=myAttempts.filter(a=>String(getAttemptExamId(a))===String(ex.id));
    const best=myEx.length?Math.max(...myEx.map(a=>a.score)):null;
    let status=myEx.length?`<span class="badge green">أفضل: ${best}%</span> <span class="muted">${myEx.length} محاولات</span>`:'<span class="badge">لم تحل بعد</span>';
    if(isTeacher()) status=`<span class="muted">${ex.questions?.length||0} سؤال • ${db.attempts.filter(a=>String(getAttemptExamId(a))===String(ex.id)).length} محاولة • ${ex.duration||60} دقيقة</span>`;
    const btn=myEx.length?'حل مرة أخرى':'ابدأ الامتحان';
    return `<div class="list-item"><div><b>${escapeHtml(ex.title||'امتحان')}</b><div style="margin-top:4px">${status}</div><small class="muted">${escapeHtml(ex.description||'')}</small></div><div style="display:flex;gap:6px"><button class="btn small" onclick="startExam(${ex.id})">${btn}</button>${isTeacher()?`<button class="btn small sec" onclick="openExamModal(${ex.id})">تعديل</button><button class="btn small danger" onclick="deleteExam(${ex.id})">حذف</button>`:''}</div></div>`;
  }).join('')||'<div class="empty">لا توجد امتحانات - أنشئ امتحان جديد</div>';
  document.getElementById('examsList').innerHTML=html;
}

// نفس منطق إنشاء الامتحان المستقر بدون فقدان التركيز
function openExamModal(id){
  const db=getDB();
  const ex=id?db.exams.find(x=>x.id===id):null;
  examBuilderQuestions=ex?ex.questions.map(q=>({...q})): [{q:'',opts:['','','',''],ans:0,qImageData:''}];
  const titleVal=ex?ex.title:'';
  const descVal=ex?ex.description||'':'';
  
  const body=document.getElementById('modalBody');
  document.getElementById('modalTitle').textContent=id?'تعديل امتحان':'إنشاء امتحان جديد';
  body.innerHTML='';
  
  const titleInput=document.createElement('input');
  titleInput.id='ex_title'; titleInput.placeholder='عنوان الامتحان'; titleInput.value=titleVal; titleInput.autocomplete='off';
  body.appendChild(titleInput);
  
  const descInput=document.createElement('input');
  descInput.id='ex_desc'; descInput.placeholder='وصف الامتحان (اختياري)'; descInput.value=descVal;
  body.appendChild(descInput);
  
  const durLabel=document.createElement('label');
  durLabel.textContent='مدة الامتحان بالدقائق';
  durLabel.style.cssText='font-size:10px;color:var(--text-muted);margin-top:8px;display:block';
  body.appendChild(durLabel);
  const durInput=document.createElement('input');
  durInput.id='ex_duration'; durInput.type='number'; durInput.value=ex?.duration||60;
  body.appendChild(durInput);

  const gradeLabel=document.createElement('label');gradeLabel.textContent='الصف الذي سيظهر له الامتحان';gradeLabel.className='muted';body.appendChild(gradeLabel);
  const gradeInput=document.createElement('select');gradeInput.id='ex_grade';
  ['الأول الإعدادي','الثاني الإعدادي','الثالث الإعدادي','الأول الثانوي','الثاني الثانوي','الثالث الثانوي'].forEach(g=>{const o=document.createElement('option');o.value=g;o.textContent=g;gradeInput.appendChild(o)});
  gradeInput.value=ex?.grade||'الأول الإعدادي';body.appendChild(gradeInput);
  const xpLabel=document.createElement('label');xpLabel.textContent='نقاط XP عند إكمال الامتحان';xpLabel.className='muted';body.appendChild(xpLabel);
  const xpInput=document.createElement('input');xpInput.id='ex_xp';xpInput.type='number';xpInput.min='0';xpInput.max='10000';xpInput.value=ex?.xp_reward??50;body.appendChild(xpInput);
  const stLabel=document.createElement('label');stLabel.textContent='مهلة الاستريك (لو الطالب ما حلّش الامتحان في المهلة يضيع استريكه)';stLabel.className='muted';body.appendChild(stLabel);
  const stWrap=document.createElement('div');stWrap.innerHTML=streakSelectHtml('ex_streak',ex?.streak_hours);body.appendChild(stWrap);
  
  const qsContainer=document.createElement('div');
  qsContainer.id='ex_qs';
  body.appendChild(qsContainer);
  
  function renderBuilder(){
    qsContainer.innerHTML='';
    examBuilderQuestions.forEach((qq,idx)=>{
      const box=document.createElement('div');
      box.className='box';
      box.style.cssText='border:1px dashed var(--border-color);padding:10px;border-radius:10px;margin-bottom:10px;background:var(--surface-2)';
      
      const header=document.createElement('div');
      header.style.cssText='display:flex;justify-content:space-between;align-items:center;margin-bottom:6px';
      header.innerHTML=`<b>سؤال ${idx+1}</b>`;
      const delBtn=document.createElement('button');
      delBtn.className='btn small danger'; delBtn.textContent='حذف'; delBtn.type='button';
      delBtn.onclick=()=>{ examBuilderQuestions.splice(idx,1); if(examBuilderQuestions.length===0) examBuilderQuestions.push({q:'',opts:['','','',''],ans:0,qImageData:''}); renderBuilder(); };
      header.appendChild(delBtn);
      box.appendChild(header);
      
      const qInput=document.createElement('input');
      qInput.placeholder='نص السؤال - اكتب هنا (يدعم الكتابة الطويلة بدون قطع)';
      qInput.value=qq.q; qInput.autocomplete='off';
      qInput.oninput=(e)=>{ examBuilderQuestions[idx].q=e.target.value; };
      box.appendChild(qInput);
      
      const imgLabel=document.createElement('div');
      imgLabel.textContent='صورة للسؤال (اختياري)';
      imgLabel.style.cssText='font-size:10px;color:var(--text-muted);margin:4px 0';
      box.appendChild(imgLabel);
      const imgInput=document.createElement('input');
      imgInput.type='file'; imgInput.accept='image/*';
      imgInput.onchange=async(e)=>{
        if(e.target.files[0]){
          examBuilderQuestions[idx].qImageData=await new Promise(r=>{const fr=new FileReader();fr.onload=()=>r(fr.result);fr.readAsDataURL(e.target.files[0])});
          toast('تم تحميل صورة السؤال');
        }
      };
      box.appendChild(imgInput);
      if(qq.qImageData){
        const img=document.createElement('img');
        img.src=safeImageSrc(qq.qImageData); img.style.cssText='max-width:100%;border-radius:8px;margin:6px 0;max-height:150px';
        box.appendChild(img);
      }
      
      const grid=document.createElement('div');
      grid.style.cssText='display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:8px 0';
      for(let oi=0;oi<4;oi++){
        const wrapper=document.createElement('div');
        const label=document.createElement('div');
        label.textContent=`اختيار ${oi+1}`;
        label.style.cssText='font-size:9px;color:var(--text-muted)';
        wrapper.appendChild(label);
        const oInput=document.createElement('input');
        oInput.placeholder=`الاختيار ${oi+1}`;
        oInput.value=qq.opts[oi]||''; oInput.autocomplete='off';
        oInput.oninput=(e)=>{ examBuilderQuestions[idx].opts[oi]=e.target.value; };
        wrapper.appendChild(oInput);
        grid.appendChild(wrapper);
      }
      box.appendChild(grid);
      
      const ansLabel=document.createElement('div');
      ansLabel.textContent='الإجابة الصحيحة (1-4)';
      ansLabel.style.cssText='font-size:10px;color:var(--text-muted)';
      box.appendChild(ansLabel);
      const ansSelect=document.createElement('select');
      ansSelect.innerHTML='<option value="0">1 - الأول هو الصح</option><option value="1">2 - الثاني هو الصح</option><option value="2">3 - الثالث هو الصح</option><option value="3">4 - الرابع هو الصح</option>';
      ansSelect.value=qq.ans;
      ansSelect.onchange=(e)=>{ examBuilderQuestions[idx].ans=parseInt(e.target.value)||0; };
      box.appendChild(ansSelect);
      
      qsContainer.appendChild(box);
    });
  }
  
  renderBuilder();
  
  const addBtn=document.createElement('button');
  addBtn.className='btn sec'; addBtn.textContent='+ إضافة سؤال جديد'; addBtn.type='button'; addBtn.style.marginTop='8px';
  addBtn.onclick=()=>{ examBuilderQuestions.push({q:'',opts:['','','',''],ans:0,qImageData:''}); renderBuilder(); };
  body.appendChild(addBtn);
  
  const saveBtn=document.createElement('button');
  saveBtn.className='btn'; saveBtn.textContent='💾 حفظ الامتحان'; saveBtn.type='button'; saveBtn.style.marginTop='12px';
  saveBtn.onclick=()=>saveExamV3(id);
  body.appendChild(saveBtn);
  
  document.getElementById('modal').classList.remove('hidden');
}

async function saveExamV3(id){
  const titleEl=document.getElementById('ex_title');
  const title=titleEl?titleEl.value.trim():'';
  if(!title){toast('عنوان الامتحان مطلوب'); titleEl.focus(); return;}
  const desc=document.getElementById('ex_desc')?.value||'';
  const duration=parseInt(document.getElementById('ex_duration')?.value)||60;
  const grade=document.getElementById('ex_grade')?.value||currentUser.grade;
  const xpReward=Math.max(0,Math.min(10000,parseInt(document.getElementById('ex_xp')?.value)||0));
  const qs=examBuilderQuestions.filter(q=>q.q.trim()!=='').map(q=>({q:q.q.trim(), opts:q.opts.map(o=>o.trim()||'اختيار'), ans:q.ans, qImageData:q.qImageData||''}));
  if(qs.length===0){toast('أضف سؤال واحد على الأقل');return;}
  if(qs.some(q=>q.qImageData && q.qImageData.length>700000)){toast('صورة السؤال كبيرة جدًا. اختر صورة مضغوطة لا يتجاوز حجمها التقريبي 500 كيلوبايت.');return;}
  
  const db=getDB();
  if(id){
    const old=db.exams.find(x=>x.id===id);
    if(old){old.title=title; old.description=desc; old.duration=duration; old.questions=qs; old.grade=grade; old.xp_reward=xpReward; old.streak_hours=streakValue('ex_streak');}
  }else{
    db.exams.push({id:Date.now(),title,description:desc,duration,questions:qs,grade,xp_reward:xpReward,streak_hours:streakValue('ex_streak'),created_by:currentUser.id,created_at:new Date().toISOString()});
  }
  try{await saveDB(db);}catch(e){return;}
  closeModal();
  renderExams();
  toast(`✅ تم حفظ الامتحان - ${qs.length} سؤال - الترقيم 1,2,3,4`);
}

async function deleteExam(id){
  if(!confirm('حذف الامتحان؟ سيتم حذف جميع محاولات الطلاب فيه')) return;
  const db=getDB();
  db.exams=db.exams.filter(x=>String(x.id)!==String(id));
  db.attempts=db.attempts.filter(a=>String(a.exam_id)!==String(id));
  try{await saveDB(db);renderExams();toast('تم الحذف');}catch(e){}
}

// بدء الامتحان مع خلط الأسئلة والإجابات
function shuffle(arr){const a=[...arr]; for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]} return a;}

function startExam(id){
  const db=getDB();
  curExam=db.exams.find(x=>String(x.id)===String(id));
  if(!curExam || !curExam.questions || curExam.questions.length===0){toast('الامتحان فارغ');return;}
  // خلط الأسئلة والاختيارات في كل محاولة. نحتفظ بالفهرس الأصلي (origIdx/perm) لأن المصحح في السيرفر يعتمد عليه.
  curQuestions=shuffle(curExam.questions.map((q,origIdx)=>{
    const perm=shuffle((q.opts||[]).map((_,i)=>i));
    return {origIdx,perm,q:q.q,opts:perm.map(i=>q.opts[i]),qImageData:q.qImageData||''};
  }));
  curAnswers={};
  examTimeLeft=(curExam.duration||60)*60;
  startTimer();
  renderFullExam();
  document.getElementById('examFooter').classList.remove('hidden');
  document.getElementById('examResult').classList.add('hidden');
}

function startTimer(){
  clearInterval(examTimerInterval);
  const el=document.getElementById('examTimer');
  function update(){
    const m=Math.floor(examTimeLeft/60).toString().padStart(2,'0');
    const s=(examTimeLeft%60).toString().padStart(2,'0');
    if(el) el.textContent=m+':'+s;
  }
  update();
  examTimerInterval=setInterval(()=>{
    examTimeLeft--;
    update();
    if(examTimeLeft<=0){clearInterval(examTimerInterval); toast('انتهى الوقت - سيتم التسليم تلقائياً'); submitFullExam();}
  },1000);
}

function renderFullExam(){
  document.getElementById('examOverlay').classList.remove('hidden');
  document.getElementById('examQTitle').textContent=curExam.title;
  document.getElementById('examProgress').textContent=curQuestions.length+' سؤال • '+curExam.duration+' دقيقة';
  let html='';
  curQuestions.forEach((qq,idx)=>{
    html+=`<div class="exam-question" data-q="${idx}"><b>${idx+1}. ${escapeHtml(qq.q)}</b>${qq.qImageData?`<img src="${safeImageSrc(qq.qImageData)}" style="max-width:100%;border-radius:8px;margin:8px 0;max-height:200px">`:''}`;
    qq.opts.forEach((opt,oi)=>{
      const sel=curAnswers[idx]===oi?'selected':'';
      html+=`<div class="exam-opt ${sel}" onclick="selectAnswer(${idx},${oi})"><input type="radio" name="q${idx}" ${sel?'checked':''} style="width:auto"> ${oi+1}. ${escapeHtml(opt)}</div>`;
    });
    html+=`</div>`;
  });
  document.getElementById('examQBody').innerHTML=html;
  hydrateStorageElements(document.getElementById('examQBody'));
}

function selectAnswer(qI,oI){
  curAnswers[qI]=oI;
  const container=document.getElementById('examQBody');
  const qDivs=container.querySelectorAll('.exam-question');
  const opts=qDivs[qI].querySelectorAll('.exam-opt');
  opts.forEach((el,i)=>{el.classList.toggle('selected',i===oI); const inp=el.querySelector('input'); if(inp) inp.checked=i===oI;});
}

function closeExam(){
  if(!confirm('هل تريد الخروج؟ لن يتم حفظ إجاباتك')) return;
  clearInterval(examTimerInterval);
  document.getElementById('examOverlay').classList.add('hidden');
  curQuestions=[]; curAnswers={};
  toast('تم الخروج - يمكنك الحل مرة أخرى وسيظهر تحسنك للمستر');
}

async function submitFullExam(){
  clearInterval(examTimerInterval);
  if(!curExam || !currentUser){toast('لا توجد محاولة مفتوحة');return;}
  const answers=new Array(curQuestions.length).fill(null);
  curQuestions.forEach((qq,idx)=>{if(Object.prototype.hasOwnProperty.call(curAnswers,idx))answers[qq.origIdx]=qq.perm[curAnswers[idx]];});
  showLoading('جاري تصحيح الامتحان وحفظ النتيجة...');
  try{
    const {data,error}=await ensureCloud().rpc('submit_exam',{p_exam_id:String(curExam.id),p_answers:answers});
    if(error)throw error;
    const result=data||{};
    const details=Array.isArray(result.details)?result.details:[];
    const pct=Number(result.score)||0,score=Number(result.correct)||0,total=Number(result.total)||curQuestions.length;
    if(typeof playExamResultSound==='function')playExamResultSound(pct);
    let html=`<div class="result-summary"><h3>النتيجة: ${score} من ${total} صح</h3><p>درجتك: <b>${pct}%</b></p><p>نقاط الخبرة المكتسبة: <b>${Number(result.xp_earned)||0} XP</b></p></div>`;
    details.forEach((d,i)=>{
      const ok=d.userAnswer!==null && Number(d.userAnswer)===Number(d.correctAnswer);
      html+=`<div class="exam-question"><b>${i+1}. ${escapeHtml(d.question||'')} ${ok?'<span style="color:var(--success)">✔ صح</span>':'<span style="color:var(--danger)">✘ غلط</span>'}</b>${d.qImageData?`<img src="${safeImageSrc(d.qImageData)}" style="max-width:100%;border-radius:8px;margin:6px 0">`:''}`;
      (d.options||[]).forEach((opt,oi)=>{
        let cls='';if(oi===Number(d.correctAnswer))cls='correct';if(d.userAnswer!==null&&oi===Number(d.userAnswer)&&oi!==Number(d.correctAnswer))cls='wrong';
        html+=`<div class="exam-opt ${cls}">${oi+1}. ${escapeHtml(opt)} ${oi===Number(d.correctAnswer)?' (الصح)':''} ${d.userAnswer!==null&&oi===Number(d.userAnswer)?' ← اختيارك':''}</div>`;
      });
      html+='</div>';
    });
    const res=document.getElementById('examResult');
    res.innerHTML=html+`<button class="btn" onclick="closeExamAfterResult()" style="margin-top:12px">إغلاق النتيجة</button>`;
    res.classList.remove('hidden');
    document.getElementById('examQBody').innerHTML='';
    document.getElementById('examFooter').classList.add('hidden');
    document.getElementById('examQTitle').textContent=`النتيجة: ${score}/${total} - ${pct}%`;
    const attempt={id:String(result.id),student_id:String(currentUser.id),exam_id:curExam.id,exam_title:curExam.title,score:pct,correct:score,total,details,xp_awarded:!!result.xp_awarded,created_at:result.created_at||new Date().toISOString()};
    remoteDB.attempts.push(attempt);
    currentUser.xp=(Number(currentUser.xp)||0)+(Number(result.xp_earned)||0);
    const me=remoteDB.users.find(u=>String(u.id)===String(currentUser.id));if(me)me.xp=currentUser.xp;
    acceptRemoteRpcState();
    updateXPDisplay(currentUser.xp);
    renderExams();renderDashboard();renderStudents();renderLeaderboard();
    toast(`تم حفظ الامتحان: ${pct}% • +${Number(result.xp_earned)||0} XP`);
  }catch(error){
    toast(`تعذر تصحيح الامتحان: ${error.message||'حاول مرة أخرى'}`);
    document.getElementById('examFooter').classList.remove('hidden');
  }finally{hideLoading();}
}
function closeExamAfterResult(){
  document.getElementById('examOverlay').classList.add('hidden');
  document.getElementById('examResult').classList.add('hidden');
  document.getElementById('examFooter').classList.remove('hidden');
  curQuestions=[];curAnswers={};curExam=null;
}


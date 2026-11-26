// Cloud data adapter: keeps the existing UI's synchronous render model while all
// persistent data is loaded from and saved to Supabase. No local demo database.
let remoteDB = emptyRemoteDB();
let remoteSnapshot = null;
let remoteWriteQueue = Promise.resolve();
let cloudSignedUrlCache = new Map();

function emptyRemoteDB(){
  return {users:[],lessons:[],resources:[],lessonProgress:[],lessonCompletions:[],exams:[],attempts:[],notifications:[],messages:[],attendance:[],schedules:[],gradesClasses:[],leaderboard:[]};
}
const GRADE_SLUGS={'الأول الإعدادي':'prep-1','الثاني الإعدادي':'prep-2','الثالث الإعدادي':'prep-3','الأول الثانوي':'sec-1','الثاني الثانوي':'sec-2','الثالث الثانوي':'sec-3'};
function gradeSlug(grade){return GRADE_SLUGS[grade]||'general';}
function cloneData(value){ return JSON.parse(JSON.stringify(value ?? null)); }
function getDB(){ return remoteDB; }
function idForApp(value){
  const s=String(value ?? '');
  return /^\d+$/.test(s) ? Number(s) : s;
}
function appId(value){ return String(value ?? ''); }
function mapProfile(row){
  return {...row, id:String(row.id), fullName:row.full_name, firstName:row.first_name, fatherName:row.father_name, phone2:row.phone2||row.phone, parentPhone:row.parent_phone};
}
function mapPayloadRow(row){
  const payload = row.payload && typeof row.payload === 'object' ? row.payload : {};
  return {...payload, id:idForApp(row.id), title:row.title, description:row.description||'', grade:row.grade, created_by:row.created_by, created_at:row.created_at,
    ...(row.duration !== undefined ? {duration:row.duration} : {})};
}
function mapProgress(row){ return {...row, student_id:String(row.student_id), last_lesson_id:idForApp(row.last_lesson_id)}; }
function mapCompletion(row){ return {...row, student_id:String(row.student_id), lesson_id:idForApp(row.lesson_id)}; }
function mapAttempt(row){ return {...row, id:idForApp(row.id), student_id:String(row.student_id), exam_id:idForApp(row.exam_id)}; }
function mapMessage(row){ return {...row, id:idForApp(row.id), sender_id:String(row.sender_id), receiver_id:String(row.receiver_id)}; }
function mapNotification(row){ return {...row, id:idForApp(row.id), target_user:row.target_user ? String(row.target_user) : null, created_by:row.created_by ? String(row.created_by) : null, message:row.message}; }
function ensureCloud(){
  if (!window.supabaseClient) throw new Error('اتصال Supabase غير مُعد. أدخل رابط المشروع والمفتاح العام أولاً.');
  return window.supabaseClient;
}
async function fetchRows(table, select='*', configure){
  let query = ensureCloud().from(table).select(select);
  if (typeof configure === 'function') query = configure(query);
  const {data,error} = await query;
  if (error) throw new Error(`${table}: ${error.message}`);
  return data || [];
}
async function loadCloudDatabase(profile){
  const staff = ['teacher','admin','owner'].includes(profile.role);
  const sb = ensureCloud();
  const jobs = [
    staff ? fetchRows('profiles') : fetchRows('profiles','*',q=>q.eq('id',profile.id)),
    staff ? fetchRows('lessons') : fetchRows('student_lessons'),
    staff ? fetchRows('resources') : fetchRows('student_resources'),
    staff ? fetchRows('exams') : fetchRows('student_exams'),
    fetchRows('attempts'), fetchRows('lesson_progress'), fetchRows('lesson_completions'),
    fetchRows('notifications'), fetchRows('messages'), fetchRows('grades_classes')
  ];
  if (!staff) jobs.push(fetchRows('staff_directory'));
  // عرض الترتيب يحتاج SUPABASE_V8_PATCH.sql؛ إن لم يُشغَّل بعد لا نمنع الدخول.
  const leaderboardJob = fetchRows('grade_leaderboard').catch(error => { console.warn('grade_leaderboard غير متاح (شغّل SUPABASE_V8_PATCH.sql):', error.message); return null; });
  const [result, leaderboardRows] = await Promise.all([Promise.all(jobs), leaderboardJob]);
  const [profiles,lessons,resources,exams,attempts,progress,completions,notifications,messages,grades] = result;
  const people = staff ? profiles.map(mapProfile) : [mapProfile(profiles[0] || profile), ...(result[10] || []).map(mapProfile)];
  remoteDB = {
    users:people,
    lessons:lessons.map(mapPayloadRow),
    resources:resources.map(mapPayloadRow),
    exams:exams.map(mapPayloadRow),
    attempts:attempts.map(mapAttempt),
    lessonProgress:progress.map(mapProgress),
    lessonCompletions:completions.map(mapCompletion),
    notifications:notifications.map(mapNotification),
    messages:messages.map(mapMessage),
    gradesClasses:grades,
    leaderboard:leaderboardRows ? leaderboardRows.map(r=>({...r,id:String(r.id)})) : null
  };
  remoteSnapshot = cloneData(remoteDB);
  return {db:remoteDB, user:people.find(p=>p.id===String(profile.id)) || mapProfile(profile)};
}
function stableJson(value){
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stableJson(value[k])).join(',')}}`;
  return JSON.stringify(value);
}
function rowsBy(items,key){ return new Map((items||[]).map(row=>[String(key(row)),row])); }
function payloadFor(row, excluded){
  const out={...row}; excluded.forEach(k=>delete out[k]); return out;
}
function contentDbRow(item, table){
  const common = ['id','title','description','grade','created_by','created_at','updated_at'];
  const excluded = table === 'exams' ? [...common,'duration'] : common;
  const payload = payloadFor(item, excluded);
  const row = {id:appId(item.id), title:String(item.title||''), description:item.description||'', grade:item.grade||'', payload,
    created_by:item.created_by || null, created_at:item.created_at || new Date().toISOString(), updated_at:new Date().toISOString()};
  if (table === 'exams') row.duration=Math.max(1, Number(item.duration)||60);
  return row;
}
async function syncChangedRows(table, before, after, keyFn, mapper, options={}){
  const sb=ensureCloud(), oldMap=rowsBy(before,keyFn), newMap=rowsBy(after,keyFn);
  const upsertRows=[];
  for (const [key,row] of newMap.entries()){
    const old=oldMap.get(key);
    if (!old || stableJson(old)!==stableJson(row)) upsertRows.push(row);
  }
  for (const row of upsertRows){
    if(options.mode==='profile'){
      const fields=['full_name','first_name','father_name','phone','phone2','parent_phone','grade','gender','xp','level','avatar_url'];
      const patch={}; fields.forEach(k=>{if(row[k]!==undefined)patch[k]=row[k];});
      if(patch.xp!==undefined){patch.xp=Math.max(0,Math.floor(Number(patch.xp)||0));patch.level=Math.floor(patch.xp/100)+1;}
      const {error}=await sb.from('profiles').update(patch).eq('id',String(row.id));
      if(error) throw error;
    } else if(options.mode==='insert-only'){
      const {error}=await sb.from(table).insert(mapper(row)); if(error) throw error;
    } else {
      const {error}=await sb.from(table).upsert(mapper(row),{onConflict:options.conflict||'id'}); if(error) throw error;
    }
  }
  if(options.delete){
    for (const [key] of oldMap.entries()) if(!newMap.has(key)){
      const {error}=await sb.from(table).delete().eq(options.deleteKey||'id',key); if(error) throw error;
    }
  }
}
async function persistDiff(before, after){
  const sb=ensureCloud();
  await syncChangedRows('profiles',before.users,after.users,x=>x.id,x=>x,{mode:'profile'});
  for(const table of ['lessons','resources','exams']){
    await syncChangedRows(table,before[table],after[table],x=>x.id,x=>contentDbRow(x,table),{delete:true});
  }
  await syncChangedRows('lesson_progress',before.lessonProgress,after.lessonProgress,x=>x.student_id,x=>({
    student_id:String(x.student_id),last_lesson_id:x.last_lesson_id==null?null:appId(x.last_lesson_id),last_lesson_title:x.last_lesson_title||null,
    last_lesson_at:x.last_lesson_at||null,last_activity:x.last_activity||null,completed_training:!!x.completed_training,
    training_completed_at:x.training_completed_at||null,updated_at:new Date().toISOString()
  }),{conflict:'student_id'});
  await syncChangedRows('notifications',before.notifications,after.notifications,x=>x.id,x=>({
    id:appId(x.id),title:x.title,message:x.message,target_grade:x.target_grade||'الكل',target_user:x.target_user||null,
    created_by:x.created_by||null,created_at:x.created_at||new Date().toISOString()
  }),{delete:true});
  // الرسائل: الجديدة تُضاف INSERT فقط (upsert كان يُرفض للطالب بسبب سياسة UPDATE)، والتعديل الوحيد المسموح هو علامة "مقروءة".
  {
    const oldMsgs=rowsBy(before.messages,x=>x.id);
    for(const m of after.messages){
      const prev=oldMsgs.get(String(m.id));
      if(!prev){
        const {error}=await sb.from('messages').insert({id:appId(m.id),sender_id:String(m.sender_id),receiver_id:String(m.receiver_id),content:m.content,read:!!m.read});
        if(error) throw error;
      }else if(!!prev.read!==!!m.read){
        const {error}=await sb.from('messages').update({read:!!m.read}).eq('id',appId(m.id));
        if(error) throw error;
      }
    }
  }
  // Attempts and training completions are written only by trusted grading RPCs.
  if(stableJson(before.attempts)!==stableJson(after.attempts)){
    const beforeIds=new Set(before.attempts.map(x=>String(x.id)));
    for(const a of after.attempts) if(!beforeIds.has(String(a.id))) throw new Error('محاولات الامتحان تُحفظ عبر دالة التصحيح الآمنة فقط.');
    await syncChangedRows('attempts',before.attempts,after.attempts,x=>x.id,x=>x,{delete:true});
  }
  const oldCompletionIds=new Set(before.lessonCompletions.map(x=>`${x.student_id}|${x.lesson_id}`));
  for(const completion of after.lessonCompletions){if(!oldCompletionIds.has(`${completion.student_id}|${completion.lesson_id}`))throw new Error('إكمال التدريب يُحفظ عبر دالة التصحيح الآمنة فقط.');}
  // Completion rows removed with a deleted lesson are removed by the database foreign-key cascade.
}
function saveDB(db=remoteDB){
  const target=cloneData(db);
  const task=remoteWriteQueue.catch(()=>{}).then(async()=>{
    if(!remoteSnapshot) throw new Error('لم يتم تحميل بيانات Supabase بعد.');
    await persistDiff(remoteSnapshot,target);
    remoteSnapshot=target;
    return true;
  });
  remoteWriteQueue=task.catch(error=>{
    console.error('Supabase save failed:',error);
    toast(`تعذر الحفظ في قاعدة البيانات: ${error.message||'خطأ غير معروف'}`);
  });
  return task;
}
async function uploadPrivateFile(bucket, grade, file, prefix='files'){
  const sb=ensureCloud();
  if(!file || !file.size) throw new Error('الملف فارغ');
  // مسارات ASCII فقط: Supabase Storage قد يرفض المفاتيح العربية (Invalid key).
  // الاسم الأصلي للملف يبقى محفوظًا في بيانات المرفق (attachment.name) ويظهر للطالب.
  const safeGrade=gradeSlug(grade);
  const rawName=String(file.name||'file');
  const ext=((rawName.match(/\.([A-Za-z0-9]{1,8})$/)||[])[1]||'').toLowerCase();
  const base=(rawName.replace(/\.[^.]*$/,'').replace(/[^A-Za-z0-9_-]+/g,'_').replace(/^_+|_+$/g,'').slice(0,60))||'file';
  const uuid=(window.crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const path=`${safeGrade}/${prefix}/${uuid}-${base}${ext?'.'+ext:''}`;
  const {error}=await sb.storage.from(bucket).upload(path,file,{upsert:false,contentType:file.type||'application/octet-stream'});
  if(error) throw error;
  return {path,bucket};
}
function dataUrlToBlob(dataUrl){
  const [head,base64]=String(dataUrl||'').split(',');
  if(!head || !base64) throw new Error('تعذر قراءة الصورة');
  const mime=(head.match(/data:([^;]+)/)||[])[1]||'application/octet-stream';
  const binary=atob(base64);const bytes=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
  return new Blob([bytes],{type:mime});
}
async function resolvePrivateFileUrl(bucket,path){
  if(!path) return '';
  const key=`${bucket}:${path}`, cached=cloudSignedUrlCache.get(key);
  if(cached && cached.expires>Date.now()) return cached.url;
  const {data,error}=await ensureCloud().storage.from(bucket).createSignedUrl(path,3600);
  if(error) throw error;
  cloudSignedUrlCache.set(key,{url:data.signedUrl,expires:Date.now()+3500000});
  return data.signedUrl;
}
async function hydrateStorageElements(root=document){
  const elements=[...root.querySelectorAll('[data-storage-path]')];
  await Promise.all(elements.map(async el=>{
    try{
      const url=await resolvePrivateFileUrl(el.dataset.storageBucket||'lesson-files',el.dataset.storagePath);
      if(el.tagName==='A') el.href=url; else el.src=url;
    }catch(error){console.warn('Storage file unavailable:',error);el.replaceWith(document.createTextNode('تعذر تحميل الملف الخاص'));}
  }));
}

function acceptRemoteRpcState(){ remoteSnapshot=cloneData(remoteDB); }

async function removePrivateAttachments(attachments){
  const groups={};
  (attachments||[]).forEach(file=>{if(file?.path){const bucket=file.bucket||'lesson-files';(groups[bucket] ||= []).push(file.path);}});
  for(const [bucket,paths] of Object.entries(groups)){
    const {error}=await ensureCloud().storage.from(bucket).remove(paths);
    if(error)console.warn('تعذر حذف بعض المرفقات من Storage:',error.message);
  }
}

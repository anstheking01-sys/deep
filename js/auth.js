// Supabase Auth only. Public/local demo password storage has been removed.
let currentUser = null;

function normalizeEgyptPhone(value){
  let digits=String(value||'').replace(/[^0-9+]/g,'');
  if(digits.startsWith('+')) return digits;
  digits=digits.replace(/^00/,'');
  if(digits.startsWith('20')) return `+${digits}`;
  if(digits.startsWith('0')) return `+20${digits.slice(1)}`;
  if(digits.startsWith('1') && digits.length===10) return `+20${digits}`;
  return `+${digits}`;
}
// الدخول بالهاتف دون SMS: نحوّل الرقم إلى بريد داخلي ثابت (لا يُرسل إليه شيء أبدًا).
// يجب إيقاف Confirm email في Supabase حتى يُنشأ الحساب فورًا.
// Supabase يرفض النطاقات الوهمية (يتحقق من وجود خادم بريد للنطاق)، لذلك نستخدم نطاقًا حقيقيًا. لا يُرسَل أي بريد أبدًا (Confirm email متوقف).
const PHONE_EMAIL_DOMAIN='gmail.com';
function phoneToEmail(raw){
  const digits=normalizeEgyptPhone(raw).replace(/[^0-9]/g,'');
  return `deep.${digits}@${PHONE_EMAIL_DOMAIN}`;
}
function friendlyAuthError(error){
  const m=String(error?.message||'');
  if(/already registered|already been registered|user_already_exists/i.test(m+(error?.code||'')))return 'هذا الرقم مسجَّل بالفعل. سجّل الدخول أو تواصل مع المستر.';
  if(/invalid login credentials/i.test(m))return 'رقم الهاتف أو كلمة المرور غير صحيحة.';
  if(/rate limit|too many/i.test(m))return 'محاولات كثيرة. انتظر قليلًا ثم حاول مرة أخرى.';
  if(/signups? not allowed|signup_disabled/i.test(m))return 'إنشاء الحسابات متوقف حاليًا. تواصل مع المستر.';
  return m||'حدث خطأ غير متوقع';
}
function showAuthMessage(message){
  const box=document.getElementById('authMessage');
  if(box){box.textContent=message;box.classList.remove('hidden');}
  else toast(message);
}
function hideAuthMessage(){const box=document.getElementById('authMessage');if(box)box.classList.add('hidden');}
function setSupabaseConnectionStatus(message, ok){
  const box=document.getElementById('supabaseConnectionStatus');
  if(!box)return;
  box.textContent=message;
  box.style.color=ok?'var(--success)':'var(--danger)';
  box.style.borderColor=ok?'var(--success)':'var(--danger)';
  box.classList.remove('hidden');
}
// يعيد نموذج الدخول لحالته الأصلية (كان يبقى نموذج OTP ظاهرًا بعد الخروج).
function resetAuthForms(){
    document.getElementById('signupForm')?.classList.add('hidden');
  document.getElementById('loginForm')?.classList.remove('hidden');
  document.querySelector('.tabs')?.classList.remove('hidden');
  document.getElementById('tLogin')?.classList.add('on');
  document.getElementById('tSign')?.classList.remove('on');
  const pass=document.getElementById('loginPass'); if(pass)pass.value='';
  ['s_pass','s_confirm','signupOtp'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
}
function showAuthView(){
  resetAuthForms();
  document.getElementById('authView')?.classList.remove('hidden');
  document.getElementById('appView')?.classList.add('hidden');
  ['modal','contactModal','examOverlay'].forEach(id=>document.getElementById(id)?.classList.add('hidden'));
}
let authListenerBound=false;
async function loadProfileAndEnter(authUser){
  const sb=ensureCloud();
  let profile=null, lastError=null;
  for(let attempt=0;attempt<6;attempt++){
    const {data,error}=await sb.from('profiles').select('*').eq('id',authUser.id).maybeSingle();
    if(error) throw error;
    if(data){profile=data;break;}
    lastError=new Error('لم يتم إنشاء ملف الحساب في جدول profiles بعد.');
    await new Promise(resolve=>setTimeout(resolve,700));
  }
  if(!profile) throw lastError||new Error('تعذر العثور على بيانات الحساب.');
  const loaded=await loadCloudDatabase(profile);
  currentUser=loaded.user;
  hideLoading();
  hideAuthMessage();
  const configBox=document.getElementById('supabaseConnectBox');if(configBox)configBox.classList.add('hidden');
  document.getElementById('authView')?.classList.add('hidden');
  enterApp();
}
async function initializeDeepPlatform(){
  const setup=document.getElementById('supabaseConnectBox');
  try{
    if(typeof addAmbientLayers==='function')addAmbientLayers();
    if(!window.supabaseClient){
      if(setup)setup.classList.remove('hidden');
      showAuthView();
      showAuthMessage('اربط المنصة بمشروع Supabase أولاً. استخدم Project URL والمفتاح العام anon/publishable فقط.');
      return;
    }
    showLoading('جاري اختبار الاتصال بخدمات Supabase...');
    if(typeof window.verifyStoredSupabaseConnection!=='function') throw new Error('أداة اختبار الاتصال غير محمّلة. حدّث ملفات النسخة وافتحها من جديد.');
    await window.verifyStoredSupabaseConnection();
    if(setup)setup.classList.add('hidden');
    document.getElementById('supabaseConnectionStatus')?.classList.add('hidden'); // لا نعرض رسالة نجاح؛ تظهر الرسائل عند الفشل فقط
    const {data,error}=await window.supabaseClient.auth.getSession();
    if(error)throw error;
    if(data.session?.user){
      await loadProfileAndEnter(data.session.user);
    }else{
      hideLoading();showAuthView();
    }
    if(!authListenerBound){
      authListenerBound=true;
      window.supabaseClient.auth.onAuthStateChange((event)=>{
        if(event==='SIGNED_OUT'){
          currentUser=null;remoteDB=emptyRemoteDB();remoteSnapshot=null;cloudSignedUrlCache.clear();showAuthView();
        }
      });
    }
  }catch(error){
    console.error('Supabase initialization failed:',error);
    hideLoading();showAuthView();
    if(setup)setup.classList.remove('hidden');
    setSupabaseConnectionStatus(`✕ فشل اختبار الاتصال: ${error.message||'خطأ غير معروف'}`,false);
    showAuthMessage(`تعذر الاتصال بالمنصة: ${error.message||'تحقق من الرابط والمفتاح والإنترنت'}`);
  }
}
function loadCurrentUser(){ return currentUser; }

async function handleLogin(e){
  e.preventDefault();hideAuthMessage();
  const phone=normalizeEgyptPhone(document.getElementById('loginPhone').value.trim());
  const password=document.getElementById('loginPass').value;
  showLoading('جاري تسجيل الدخول...');
  try{
    const sb=ensureCloud();
    const {data,error}=await sb.auth.signInWithPassword({email:phoneToEmail(phone),password});
    if(error)throw error;
    if(!data.user)throw new Error('لم يتم إنشاء جلسة دخول.');
    await loadProfileAndEnter(data.user);
    toast('تم تسجيل الدخول بنجاح');
  }catch(error){hideLoading();showAuthMessage(friendlyAuthError(error));}
}
async function handleSignup(e){
  e.preventDefault();hideAuthMessage();
  const first=document.getElementById('s_first').value.trim();
  const father=document.getElementById('s_father').value.trim();
  const rawPhone=document.getElementById('s_phone').value.trim();
  const parent=document.getElementById('s_parent').value.trim();
  const grade=document.getElementById('s_grade').value;
  const gender=document.getElementById('s_gender').value;
  const password=document.getElementById('s_pass').value;
  const confirmPassword=document.getElementById('s_confirm').value;
  if(!first||!father||!rawPhone||!parent||!grade||!gender){showAuthMessage('كل الحقول إجبارية');return;}
  if(!/^01[0-9]{9}$/.test(rawPhone)||!/^01[0-9]{9}$/.test(parent)){showAuthMessage('رقم الهاتف يجب أن يكون 11 رقمًا ويبدأ بـ 01');return;}
  if(password.length<8){showAuthMessage('كلمة المرور يجب ألا تقل عن 8 أحرف');return;}
  if(password!==confirmPassword){showAuthMessage('تأكيد كلمة المرور غير متطابق');return;}
  showLoading('جاري إنشاء حساب الطالب...');
  try{
    const {data,error}=await ensureCloud().auth.signUp({
      email:phoneToEmail(rawPhone),password,
      options:{data:{full_name:`${first} ${father}`.trim(),first_name:first,father_name:father,phone:rawPhone,parent_phone:parent,grade,gender}}
    });
    if(error)throw error;
    if(data.session?.user){await loadProfileAndEnter(data.session.user);toast('تم إنشاء الحساب بنجاح');return;}
    throw new Error('تم إنشاء الحساب لكن Supabase ما زال يطلب تأكيدًا. أوقف Confirm email من Authentication > Providers > Email.');
  }catch(error){hideLoading();showAuthMessage(friendlyAuthError(error));}
}
function forgotPassword(){
  openModal('نسيت كلمة المرور؟',`
    <p>تواصل مع المستر ليعيد تعيين كلمة مرورك، وأرسل له رقم هاتفك المسجل.</p>
    <a href="https://wa.me/201008111752" target="_blank" rel="noopener" class="btn" style="display:block;text-align:center;text-decoration:none">💬 واتساب المستر</a>`);
}
async function logout(){
  try{showLoading('جاري تسجيل الخروج...');await ensureCloud().auth.signOut();}
  catch(error){console.error(error);}
  currentUser=null;remoteDB=emptyRemoteDB();remoteSnapshot=null;hideLoading();showAuthView();
}
function isTeacher(){ return !!(currentUser && ['teacher','admin','owner'].includes(currentUser.role)); }

// Keep configuration accessible from the login screen before anyone is authenticated.
async function saveSupabaseConfig(){
  const url=document.getElementById('supabaseUrl')?.value.trim()||'';
  const key=document.getElementById('supabaseKey')?.value.trim()||'';
  const button=document.querySelector('#supabaseConnectBox button');
  const oldText=button?.textContent;
  try{
    hideAuthMessage();
    setSupabaseConnectionStatus('جارٍ اختبار الاتصال بخدمة Auth وواجهة Data API...',true);
    if(button){button.disabled=true;button.textContent='جارٍ الاختبار...';}
    if(typeof window.testSupabaseConnection!=='function')throw new Error('أداة اختبار الاتصال غير محمّلة. أعد فتح ملفات النسخة الجديدة.');
    await window.testSupabaseConnection(url,key);
    if(!window.configureSupabase)throw new Error('مكتبة Supabase غير محمّلة. تحقق من الإنترنت ثم أعد المحاولة.');
    window.configureSupabase(url,key);
    document.getElementById('supabaseKey').value='';
    if(button)button.textContent='تم الاتصال ✓';
    await initializeDeepPlatform();
  }catch(error){
    console.error('Supabase connection test failed:',error);
    setSupabaseConnectionStatus(`✕ لم ينجح الاتصال: ${error.message||'خطأ غير معروف'}`,false);
    showAuthMessage(error.message||'تعذر الاتصال بمشروع Supabase');
  }finally{
    if(button){button.disabled=false;button.textContent=oldText||'حفظ إعدادات الاتصال';}
  }
}

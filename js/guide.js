// guide.js - جولة شرح: بالونة تفكير فوق كل زر تشرح وظيفته. تظهر مرة واحدة لكل مستخدم، ويمكن إعادتها من "حسابي"
const GUIDE_STUDENT=[
  [null,'👋 أهلاً بيك','هشرح لك كل زرار في ثواني. اضغط "التالي".'],
  ['home','🏠 الرئيسية','الاستريك 🔥، آخر الدروس، كمّل من حيث وقفت، ومتوسط درجاتك.'],
  ['#homeNoticesWrap','📢 إشعارات المستر','آخر إشعارات المستر بتظهر هنا في الرئيسية. اضغط "عرض الكل" لو عايز كلها.','home'],
  ['lessons','📚 الدروس','افتح أي درس وشوف شرحه. الملفات (PDF) بتفتح جوه الموقع.'],
  ['training','✍️ التدريبات','أسئلة بعد كل درس. ترتيب الاختيارات بيتغير كل مرة. إكمالها بيزوّد XP ويحسب في الاستريك.'],
  ['exams','📝 الامتحانات','اضغط ابدأ وجاوب. النتيجة بتظهر فورًا. لو أعدته وحسّنت درجتك بتاخد الفرق في XP.'],
  ['resources','📂 الملازم','ملفات المستر: PDF أو ملزمة من Drive، بتتفتح جوه الموقع.'],
  ['leaderboard','🏆 الترتيب','ترتيبك وسط زمايلك في الصف حسب النقاط.'],
  ['#xpInfoHome','⭐ المستوى و XP','كل 100 XP = مستوى جديد. بتاخد XP من التدريبات والامتحانات.','home'],
  ['#streakCard','🔥 الاستريك','كل درس أو امتحان ليه مهلة بيحددها المستر. أثناء المهلة الاستريك بارد ❄️ ومحفوظ. حل المطلوب قبل ميعاد المهلة المكتوب عشان ما يضيعش. ولما يزيد بتسمع صوت 🎵.','home'],
  ['messages','💬 الرسائل','ابعت للمستر واقرأ ردّه وكل إشعاراته.'],
  ['profile','👤 حسابي','بياناتك + زر 📖 شرح الموقع تاني.'],
  ['#soundBtn','🔊 الصوت','كتم أو تشغيل أصوات الموقع.'],
  ['#themeBtn','☀️ الوضع','يغيّر الموقع بين الفاتح والداكن.']
];
const GUIDE_TEACHER=[
  [null,'👋 أهلاً يا مستر','هشرح لك كل زرار في ثواني. اضغط "التالي".'],
  ['dashboard','📊 الرئيسية','أزرار سريعة: درس جديد، امتحان جديد، إرسال إشعار، وتحتها أرقام المنصة.'],
  ['students','👥 الطلاب','اضغط الطالب تشوف نتايجه. زر "تعديل" يغيّر بياناته أو يعيّن له كلمة مرور جديدة لو نسي 🔑.'],
  ['lessons','📚 الدروس','➕ إضافة درس بملفاته وتحديد الصف. فيه خانة "مهلة الاستريك": المدة اللي لو الطالب ما حلّش فيها التدريب يضيع استريكه.'],
  ['exams','📝 الامتحانات','➕ إنشاء امتحان بأسئلة وصور ومدة، وبرضه "مهلة الاستريك". الأسئلة والاختيارات بتتخلط تلقائيًا للطالب.'],
  ['training','✍️ التدريبات','أسئلة التدريب المرتبطة بالدروس.'],
  ['resources','📂 الملازم','ارفع PDF (حتى 50 ميجا) أو حط رابط Google Drive. الاتنين بيتفتحوا جوه الموقع. الرابط لازم "أي شخص لديه الرابط".'],
  ['results','📈 النتائج','كل محاولات الطلاب مع فلتر وتصدير CSV.'],
  ['grades-classes','🏫 الصفوف','ملخص كل صف: الطلاب والدروس والمتوسط.'],
  ['messages','💬 الرسائل','📢 إشعار لكل الطلاب أو صف معين، و🗑️ لحذفه، وردّ على رسائل الطلاب.'],
  ['profile','👤 حسابي','بياناتك + زر 📖 شرح الموقع تاني.'],
  ['#soundBtn','🔊 الصوت','كتم أو تشغيل أصوات الموقع.'],
  ['#themeBtn','☀️ الوضع','يغيّر الموقع بين الفاتح والداكن.']
];
let guideIdx=0;
function guidePages(){return isTeacher()?GUIDE_TEACHER:GUIDE_STUDENT;}
function guideKey(){return 'deep_guide_seen_v2_'+(currentUser&&currentUser.id);}
function visibleEl(el){return el&&el.getClientRects().length>0?el:null;}
function guideTarget(sel){
  if(!sel)return {el:null,more:false};
  if(sel[0]==='#')return {el:visibleEl(document.querySelector(sel)),more:false};
  const side=visibleEl(document.querySelector(`#nav button[data-page="${sel}"]`));
  if(side)return {el:side,more:false};
  const mob=visibleEl(document.querySelector(`#mobileNav button[data-page="${sel}"]`));
  if(mob)return {el:mob,more:false};
  return {el:visibleEl(document.querySelector('#mobileNav button[data-page="__more"]')),more:true};
}
function closeGuide(){document.getElementById('guideSpot')?.remove();document.getElementById('guideBubble')?.remove();window.removeEventListener('resize',guideResize);}
function guideResize(){openGuide(guideIdx);}
function openGuide(i=0){
  const pages=guidePages();
  i=Math.max(0,Math.min(pages.length-1,i));guideIdx=i;
  try{localStorage.setItem(guideKey(),'1');}catch(e){}
  closeModal();
  const [sel,title,body,page]=pages[i];
  if(page&&typeof showPage==='function')showPage(page);
  const first=!document.getElementById('guideBubble');
  closeGuide();window.addEventListener('resize',guideResize);
  const last=i===pages.length-1;
  const {el,more}=guideTarget(sel);
  const bubble=document.createElement('div');bubble.id='guideBubble';
  bubble.innerHTML=`<b>${title}</b><p>${body}${more?'<br><small class="muted">(الزر ده جوه ☰ المزيد)</small>':''}</p>
    <div class="gb-row">${i>0?`<button class="btn sec small" onclick="openGuide(${i-1})">→ السابق</button>`:''}<button class="btn small" onclick="${last?'closeGuide()':`openGuide(${i+1})`}">${last?'تمام ✅':'التالي ←'}</button></div>
    ${last?'':'<button class="gb-skip" onclick="closeGuide()">تخطّي الشرح</button>'}<span class="dot d1"></span><span class="dot d2"></span>`;
  document.body.appendChild(bubble);
  const bw=bubble.offsetWidth,bh=bubble.offsetHeight,vw=innerWidth,vh=innerHeight;
  if(!el){
    bubble.style.left=(vw-bw)/2+'px';bubble.style.top=(vh-bh)/2+'px';
    bubble.querySelectorAll('.dot').forEach(d=>d.remove());
    const spot=document.createElement('div');spot.id='guideSpot';spot.style.cssText=`left:${vw/2}px;top:${vh/2}px;width:0;height:0;box-shadow:0 0 0 9999px rgba(3,6,14,.62)`;document.body.appendChild(spot);
    return;
  }
  el.scrollIntoView({block:'center',inline:'center'});
  const r=el.getBoundingClientRect();
  const spot=document.createElement('div');spot.id='guideSpot';
  spot.style.cssText=`left:${r.left-4}px;top:${r.top-4}px;width:${r.width+8}px;height:${r.height+8}px`;document.body.appendChild(spot);
  const cx=r.left+r.width/2,above=r.top+r.height/2>vh/2;
  let left=Math.max(12,Math.min(vw-bw-12,cx-bw/2));
  let top=above?r.top-bh-34:r.bottom+34;
  top=Math.max(8,Math.min(vh-bh-8,top));
  bubble.style.left=left+'px';bubble.style.top=top+'px';
  const d1=bubble.querySelector('.d1'),d2=bubble.querySelector('.d2'),dx=Math.max(14,Math.min(bw-30,cx-left));
  if(above){d1.style.cssText=`bottom:-22px;left:${dx}px`;d2.style.cssText=`bottom:-34px;left:${dx}px`;}
  else{d1.style.cssText=`top:-22px;left:${dx}px`;d2.style.cssText=`top:-34px;left:${dx}px`;}
}
function maybeShowGuide(){
  let seen=false;try{seen=!!localStorage.getItem(guideKey());}catch(e){}
  if(!seen)setTimeout(()=>openGuide(0),700);
}

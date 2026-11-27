// pointer-glow.js - قطرة مياه تلاحق الماوس بتأخير ناعم (شكل دائري ثابت بتموّج خفيف)، وحلقات مياه بتنتشر وقت الحركة.
// على الموبايل: تظهر مكان اللمس وتفضل واقفة على آخر مكان.
(function(){
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  let el=document.getElementById('pointerGlow');
  if(!el){el=document.createElement('div');el.id='pointerGlow';el.setAttribute('aria-hidden','true');document.body.appendChild(el);}
  let tx=innerWidth/2,ty=innerHeight/2,x=tx,y=ty,hot=0,hotT=0,press=0,visible=false,lastRing=0,rx=0,ry=0;
  function ring(px,py){
    const r=document.createElement('div');r.className='water-ring';r.style.left=px+'px';r.style.top=py+'px';
    document.body.appendChild(r);setTimeout(()=>r.remove(),1450);
  }
  function frame(t){
    const dx=tx-x,dy=ty-y;x+=dx*0.1;y+=dy*0.1;
    hot+=(hotT-hot)*0.12;
    const s=(1+0.05*Math.sin(t/800))*(1+hot*0.3+press*0.22);
    el.style.transform=`translate(${x}px,${y}px) scale(${s})`;
    el.style.opacity=visible?1:0;
    // حلقة مياه كل مسافة معينة أثناء الحركة
    if(visible&&Math.hypot(x-rx,y-ry)>90&&t-lastRing>260){ring(x,y);rx=x;ry=y;lastRing=t;}
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  const show=(px,py)=>{tx=px;ty=py;visible=true;};
  function ripple(px,py){
    const r=document.createElement('div');r.className='tap-ripple';r.style.left=px+'px';r.style.top=py+'px';
    document.body.appendChild(r);setTimeout(()=>r.remove(),900);
  }
  const HOT='button,a,.btn,.card,.list-item,summary,input,select,textarea,.lesson';
  addEventListener('mousemove',e=>show(e.clientX,e.clientY),{passive:true});
  document.addEventListener('mouseover',e=>{hotT=e.target.closest&&e.target.closest(HOT)?1:0;});
  document.addEventListener('mouseleave',()=>{visible=false;});
  addEventListener('mousedown',e=>{press=1;ripple(e.clientX,e.clientY);ring(e.clientX,e.clientY);setTimeout(()=>press=0,180);});
  addEventListener('touchstart',e=>{const t=e.touches[0];x=tx=rx=t.clientX;y=ty=ry=t.clientY;show(x,y);press=1;ripple(x,y);ring(x,y);},{passive:true});
  addEventListener('touchmove',e=>{const t=e.touches[0];show(t.clientX,t.clientY);},{passive:true});
  const end=()=>{press=0;};   // الدائرة تفضل واقفة على آخر مكان لمسته
  addEventListener('touchend',end,{passive:true});addEventListener('touchcancel',end,{passive:true});
})();

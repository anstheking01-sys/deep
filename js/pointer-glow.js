// pointer-glow.js - دائرة مائية حيّة: تلاحق الماوس بتأخير، تتمطط مع السرعة، تتنفس، لها ذيل، وتتفاعل مع الأزرار واللمس
(function(){
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const mk=(cls,id)=>{const d=document.createElement('div');if(id)d.id=id;d.className=cls;d.setAttribute('aria-hidden','true');document.body.appendChild(d);return d;};
  const el=document.getElementById('pointerGlow')||mk('', 'pointerGlow');
  let ang=0,str=1,tx=innerWidth/2,ty=innerHeight/2,x=tx,y=ty,hot=0,hotT=0,press=0,visible=false,last=0;
  function frame(t){
    const dx=tx-x,dy=ty-y;
    x+=dx*0.11;y+=dy*0.11;
    const speed=Math.hypot(dx,dy);
    // تمطّط خفيف وناعم: الاتجاه والمقدار بيتغيّروا تدريجيًا فمفيش شكل "سمكة" عند تغيير الاتجاه
    const wantStr=1+Math.min(speed/500,.28);
    str+=(wantStr-str)*0.12;
    if(speed>4){const want=Math.atan2(dy,dx);let d=want-ang;d=Math.atan2(Math.sin(d),Math.cos(d));ang+=d*0.15;}
    const squash=1/Math.sqrt(str);
    hot+=(hotT-hot)*0.12;
    const breathe=1+0.07*Math.sin(t/650);
    const s=breathe*(1+hot*0.35+press*0.25);
    el.style.transform=`translate(${x}px,${y}px) rotate(${ang}rad) scale(${s*str},${s*squash})`;
    el.style.opacity=visible?(0.8+hot*0.2):0;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  const show=(px,py)=>{tx=px;ty=py;visible=true;el.classList.toggle('on',true);};
  function ripple(px,py){
    const r=document.createElement('div');r.className='tap-ripple';r.style.left=px+'px';r.style.top=py+'px';
    document.body.appendChild(r);setTimeout(()=>r.remove(),800);
  }
  const HOT='button,a,.btn,.card,.list-item,summary,input,select,textarea,.lesson';
  addEventListener('mousemove',e=>show(e.clientX,e.clientY),{passive:true});
  document.addEventListener('mouseover',e=>{hotT=e.target.closest&&e.target.closest(HOT)?1:0;});
  document.addEventListener('mouseleave',()=>{visible=false;});
  let lastTouch=0;
  addEventListener('mousedown',e=>{press=1;ripple(e.clientX,e.clientY);setTimeout(()=>press=0,180);});
  addEventListener('touchstart',e=>{const t=e.touches[0];x=tx=t.clientX;y=ty=t.clientY;show(x,y);press=1;ripple(x,y);},{passive:true});
  addEventListener('touchmove',e=>{const t=e.touches[0];show(t.clientX,t.clientY);},{passive:true});
  const end=()=>{press=0;}; // الدائرة تفضل واقفة على آخر مكان لمسته
  addEventListener('touchend',end,{passive:true});addEventListener('touchcancel',end,{passive:true});
})();

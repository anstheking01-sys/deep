// pointer-glow.js - هالة زرقاء ناعمة صغيرة تتأخر قليلًا وراء الماوس. على الموبايل تظهر مكان اللمس وتفضل واقفة على آخر مكان.
(function(){
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  let el=document.getElementById('pointerGlow');
  if(!el){el=document.createElement('div');el.id='pointerGlow';el.setAttribute('aria-hidden','true');document.body.appendChild(el);}
  let tx=innerWidth/2,ty=innerHeight/2,x=tx,y=ty,visible=false;
  function frame(){
    x+=(tx-x)*0.17;y+=(ty-y)*0.17;                 // تأخير بسيط
    el.style.transform=`translate(${x}px,${y}px)`;
    el.style.opacity=visible?1:0;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  const show=(px,py)=>{tx=px;ty=py;visible=true;};
  function ripple(px,py){
    const r=document.createElement('div');r.className='tap-ripple';r.style.left=px+'px';r.style.top=py+'px';
    document.body.appendChild(r);setTimeout(()=>r.remove(),900);
  }
  addEventListener('mousemove',e=>show(e.clientX,e.clientY),{passive:true});
  document.addEventListener('mouseleave',()=>{visible=false;});
  addEventListener('mousedown',e=>ripple(e.clientX,e.clientY));
  addEventListener('touchstart',e=>{const t=e.touches[0];x=tx=t.clientX;y=ty=t.clientY;show(x,y);ripple(x,y);},{passive:true});
  addEventListener('touchmove',e=>{const t=e.touches[0];show(t.clientX,t.clientY);},{passive:true});
})();

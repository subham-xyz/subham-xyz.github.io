const lesson = document.querySelector<HTMLElement>('[data-lesson]');
if (lesson) {
 const tabs = [...lesson.querySelectorAll<HTMLButtonElement>('[data-lesson-tab]')];
 const panels = [...lesson.querySelectorAll<HTMLElement>('[data-lesson-panel]')];
 const previous = lesson.querySelector<HTMLButtonElement>('[data-lesson-prev]')!;
 const next = lesson.querySelector<HTMLButtonElement>('[data-lesson-next]')!;
 const tryTool = lesson.querySelector<HTMLAnchorElement>('[data-lesson-try]')!;
 let active = 0;
 function show(index:number, focus=false) {
  active = Math.max(0,Math.min(index,tabs.length-1));
  tabs.forEach((tab,i) => {tab.setAttribute('aria-selected',String(i===active));tab.tabIndex=i===active?0:-1;});
  panels.forEach((panel,i) => {panel.hidden=i!==active;panel.classList.toggle('state-enter',i===active);});
  previous.disabled=active===0;next.hidden=active===tabs.length-1;tryTool.hidden=active!==tabs.length-1;
  lesson!.querySelector('[data-lesson-status]')!.textContent=`Step ${active+1} of ${tabs.length}`;
  if(focus) tabs[active].focus({preventScroll:true});
 }
 lesson.querySelector<HTMLElement>('.lesson-tabs')!.hidden=false;
 lesson.querySelector<HTMLElement>('.lesson-controls')!.hidden=false;
 tabs.forEach((tab,i) => { tab.addEventListener('click',()=>show(i));tab.addEventListener('keydown',event=>{const key=event.key; if(!['ArrowLeft','ArrowRight','Home','End'].includes(key))return;event.preventDefault();show(key==='Home'?0:key==='End'?tabs.length-1:(i+(key==='ArrowRight'?1:-1)+tabs.length)%tabs.length,true);}); });
 previous.addEventListener('click',()=>show(active-1,true));next.addEventListener('click',()=>show(active+1,true));show(0);
}

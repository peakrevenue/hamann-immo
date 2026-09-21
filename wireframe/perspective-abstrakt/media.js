(() => {
 for(const video of document.querySelectorAll('video')){
  const stage=video.closest('.testimonial-left,.video-stage');
  const message=stage?.querySelector('.testimonial-error,.video-error');
  const showError=()=>{if(message)message.hidden=false;};
  video.addEventListener('error',showError);video.querySelector('source')?.addEventListener('error',showError);
  video.addEventListener('play',()=>document.querySelectorAll('video').forEach(other=>{if(other!==video)other.pause();}));
 }
 const video=document.getElementById('video1'),button=document.getElementById('toggleSound1');
 if(!video||!button)return;
 const update=()=>{const audible=!video.muted&&video.volume>0;const label=audible?'Ton ausschalten':'Ton anschalten';button.querySelector('span').textContent=label;button.setAttribute('aria-label',label);button.setAttribute('aria-pressed',String(audible));};
 button.addEventListener('click',()=>{const audible=!video.muted&&video.volume>0;video.muted=audible;if(!audible&&video.volume===0)video.volume=1;if(video.paused)video.play().catch(()=>{});update();});
 video.addEventListener('volumechange',update);video.addEventListener('error',()=>button.hidden=true);update();
})();

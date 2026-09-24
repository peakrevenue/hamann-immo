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
 video.controls=false;
 let starting=false;
 button.addEventListener('click',async()=>{
  if(starting)return;
  starting=true;button.disabled=true;
  try{
   video.pause();
   video.currentTime=0;
   video.muted=false;
   video.volume=1;
   video.loop=false;
   await video.play();
   video.controls=true;
   button.hidden=true;
  }catch{
   video.muted=true;
   video.controls=true;
   button.querySelector('span').textContent='Erneut für Ton klicken';
  }finally{
   starting=false;button.disabled=false;
  }
 });
 video.addEventListener('error',()=>{button.hidden=true;video.controls=true;});
})();

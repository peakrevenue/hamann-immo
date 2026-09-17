(() => {
  if (!window.lottie) return;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const animations = [];
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      const item = animations.find(item => item.element === entry.target);
      if (!item || !item.loaded) continue;
      item.visible = entry.isIntersecting;
      if (reducedMotion.matches) item.animation.goToAndStop(Math.round(item.animation.totalFrames * .65), true);
      else if (entry.isIntersecting) item.animation.play();
      else item.animation.pause();
    }
  }, { rootMargin: '100px' });
  document.querySelectorAll('[data-animation]').forEach(element => {
    const item = {element, visible:false, loaded:false, animation:lottie.loadAnimation({container:element,renderer:'svg',loop:true,autoplay:false,path:element.dataset.animation,rendererSettings:{preserveAspectRatio:'xMidYMid meet'}})};
    animations.push(item);
    item.animation.addEventListener('DOMLoaded', () => {
      item.loaded = true;
      item.animation.goToAndStop(Math.round(item.animation.totalFrames * .65), true);
      observer.observe(element);
    });
  });
  reducedMotion.addEventListener('change', () => animations.forEach(item => {
    if (!item.loaded) return;
    if (reducedMotion.matches) item.animation.goToAndStop(Math.round(item.animation.totalFrames * .65), true);
    else if (item.visible) item.animation.play();
  }));
})();

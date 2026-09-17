(() => {
 if(matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window))return;
 const observer=new IntersectionObserver(entries=>{for(const entry of entries){if(entry.isIntersecting){entry.target.classList.add('is-visible');observer.unobserve(entry.target);}}},{threshold:0.08});
 document.querySelectorAll('.system article,.benefits article,.bundle,.blue,.host-copy').forEach(element=>{element.classList.add('soft-reveal');observer.observe(element);});
})();

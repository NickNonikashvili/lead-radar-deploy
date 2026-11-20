/* Discover Georgia: the timeline fills as you scroll, and "Write your name in Georgian". */
(function(){
  var tl=document.querySelector('.tl'); if(!tl) return;
  var fill=tl.querySelector('.tl-fill'), eras=[].slice.call(tl.querySelectorAll('.era'));
  var reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(!reduce && 'IntersectionObserver' in window){
    document.documentElement.classList.add('js-anim');
    var io=new IntersectionObserver(function(es){ es.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('seen'); io.unobserve(e.target); } }) },{rootMargin:'0px 0px -12% 0px'});
    eras.forEach(function(e){ io.observe(e) });
  }
  var t=false;
  function upd(){ t=false; var r=tl.getBoundingClientRect(), mid=innerHeight*0.55;
    var p=Math.max(0,Math.min(1,(mid-r.top)/r.height)); fill.style.setProperty('--p',p.toFixed(4));
    eras.forEach(function(e){ var d=e.querySelector('.era-dot').getBoundingClientRect(); e.classList.toggle('on', d.top+d.height/2 < mid); });
  }
  addEventListener('scroll',function(){ if(!t){ t=true; requestAnimationFrame(upd) } },{passive:true}); addEventListener('resize',upd); upd();
  // write your name in Georgian
  var inp=document.getElementById('abc-in'), out=document.getElementById('abc-out'); if(!inp) return;
  var M=[["ts'","წ"],["ch'","ჭ"],["k'","კ"],["p'","პ"],["t'","ტ"],["q'","ყ"],["zh","ჟ"],["gh","ღ"],["sh","შ"],["ch","ჩ"],["ts","ც"],["dz","ძ"],["kh","ხ"],["th","თ"],["ph","ფ"],
    ["a","ა"],["b","ბ"],["c","ქ"],["d","დ"],["e","ე"],["f","ფ"],["g","გ"],["h","ჰ"],["i","ი"],["j","ჯ"],["k","ქ"],["l","ლ"],["m","მ"],["n","ნ"],["o","ო"],["p","პ"],["q","ყ"],["r","რ"],["s","ს"],["t","ტ"],["u","უ"],["v","ვ"],["w","ვ"],["x","ქს"],["y","ი"],["z","ზ"]];
  var lis=[].slice.call(document.querySelectorAll('.abc-grid li'));
  function tr(s){ s=s.toLowerCase(); var o='', i=0; while(i<s.length){ var hit=null; for(var k=0;k<M.length;k++){ if(s.substr(i,M[k][0].length)===M[k][0]){ hit=M[k]; break; } } if(hit){ o+=hit[1]; i+=hit[0].length; } else { o+=s[i]; i++; } } return o; }
  inp.addEventListener('input',function(){ var g=inp.value.trim()?tr(inp.value):'მოგზაური'; out.textContent=g; lis.forEach(function(li){ li.classList.toggle('lit', inp.value.trim()!=='' && g.indexOf(li.dataset.k)>-1); }); });
})();

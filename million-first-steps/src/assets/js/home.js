/* Home page. Built from the design's scripts; visible text goes through T() so it can be translated. */

/* ---- Map, places and the hero request form ---- */
(function () {
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var IMG = (window.MFS && MFS.root || '') + 'assets/img/';
  var W = 987, H = 565;
  var places = [
    { id: 'tbilisi', reg: 'tbilisi', name: T('Tbilisi'), region: T('The capital'), x: 706.0, y: 419.0, major: true, img: IMG + 'tbilisi-trinity.webp', alt: T('Holy Trinity Cathedral above the old town and a stone bridge over the Mtkvari') },
    { id: 'mtskheta', reg: 'mm', name: T('Mtskheta'), region: T('The ancient capital'), x: 690.5, y: 393.9, img: IMG + 'mtskheta.webp', alt: T('Svetitskhoveli Cathedral and Mtskheta old town beside the river, mountains behind') },
    { id: 'ananuri', reg: 'mm', name: T('Ananuri'), region: T('Fortress on the Military Road'), x: 688.3, y: 332.4, img: IMG + 'ananuri.webp', alt: T('Ananuri fortress and church above the turquoise Zhinvali reservoir') },
    { id: 'gudauri', reg: 'mm', name: T('Gudauri'), region: T('Ski & paragliding'), x: 656.0, y: 272.0, img: IMG + 'gudauri.webp', alt: T('Skiers and red gondolas on a sunny slope in Gudauri, snowy ridges behind') },
    { id: 'kazbegi', reg: 'mm', name: T('Kazbegi'), region: T('Stepantsminda · Gergeti church'), x: 679.7, y: 237.3, major: true, img: IMG + 'kazbegi-gergeti.webp', alt: T('Gergeti Trinity Church on a green hill below a snowy mountain') },
    { id: 'abudelauri', reg: 'mm', name: T('Abudelauri Lakes'), region: T('Khevsureti · alpine lakes'), x: 709.3, y: 252.2, img: IMG + 'abudelauri.webp', alt: T('Turquoise Blue Lake of Abudelauri among rocks and green slopes, hikers on the trail') },
    { id: 'telavi', reg: 'kakheti', name: T('Telavi'), region: T('Kakheti'), x: 798.4, y: 379.6, img: IMG + 'telavi.webp', alt: T('Ripe dark grape bunches on the vine in the evening sun') },
    { id: 'sighnaghi', reg: 'kakheti', name: T('Sighnaghi'), region: T('Kakheti'), x: 862.5, y: 437.4, major: true, img: IMG + 'sighnaghi.webp', alt: T('A painted vintage car outside the Sighnaghi wine museum on a cobbled street') },
    { id: 'gori', reg: 'shida', name: T('Uplistsikhe'), region: T('The rock-cut town'), x: 617.4, y: 370.4, img: IMG + 'uplistsikhe.webp', alt: T('Uplistsikhe rock-cut town with its brick church on top') },
    { id: 'borjomi', reg: 'samtskhe', name: T('Borjomi'), region: T('Forests & mineral springs'), x: 500.5, y: 395.1, img: IMG + 'borjomi.webp', alt: T('Pine forest and rocky ridges in Borjomi-Kharagauli park') },
    { id: 'vardzia', reg: 'samtskhe', name: T('Vardzia'), region: T('Cave monastery'), x: 485.4, y: 483.5, img: IMG + 'vardzia.webp', alt: T('Vardzia cave monastery carved into the cliff above the valley') },
    { id: 'kutaisi', reg: 'imereti', name: T('Kutaisi'), region: T('Imereti'), x: 401.2, y: 312.4, major: true, img: IMG + 'kutaisi.webp', alt: T('A historic colonnaded palace in a leafy park with autumn leaves on the lawn') },
    { id: 'martvili', reg: 'samegrelo', name: T('Martvili Canyon'), region: T('Samegrelo'), x: 355.8, y: 275.9, img: IMG + 'martvili.webp', alt: T('Turquoise river rushing through the mossy Martvili Canyon') },
    { id: 'mestia', reg: 'samegrelo', name: T('Mestia'), region: T('Svaneti'), x: 406.1, y: 162.4, major: true, img: IMG + 'mestia.webp', alt: T('Medieval Svan towers in Mestia at golden hour, autumn forest around them') },
    { id: 'ushguli', reg: 'samegrelo', name: T('Ushguli'), region: T('Svaneti · tower village'), x: 447.0, y: 187.3, img: IMG + 'ushguli.webp', alt: T('Stone Svan towers among houses, an autumn forest slope behind') },
    { id: 'gomismta', reg: 'guria', name: T('Gomis Mta'), region: T('Guria · above the clouds'), x: 324.6, y: 398.1, img: IMG + 'gomismta.webp', alt: T('Pink clouds rolling over a forested ridge at Gomis Mta') },
    { id: 'kobuleti', reg: 'adjara', name: T('Kobuleti'), region: T('Adjara · Black Sea beaches'), x: 269.9, y: 398.6, img: IMG + 'kobuleti.webp', alt: T('Sunset over the Black Sea from the pebble beach at Kobuleti') },
    { id: 'batumi', reg: 'adjara', name: T('Batumi'), region: T('Adjara · Black Sea'), x: 250.0, y: 438.0, major: true, img: IMG + 'batumi.webp', alt: T('Batumi seafront with the Alphabet Tower and high-rises above the beach') },
    { id: 'poti', reg: 'samegrelo', name: T('Poti'), region: T('Samegrelo · Black Sea port'), x: 255.6, y: 337.4, img: IMG + 'poti.webp', alt: T('Sunbeams breaking through storm clouds over the Black Sea') },
    { id: 'zugdidi', reg: 'samegrelo', name: T('Zugdidi'), region: T('Samegrelo · Dadiani Palace'), x: 283.8, y: 267.0, img: IMG + 'zugdidi.webp', alt: T('The Dadiani Palace in Zugdidi behind a green park') },
    { id: 'tskaltubo', reg: 'imereti', name: T('Tskaltubo'), region: T('Imereti · spa town & caves'), x: 388.2, y: 302.1, img: IMG + 'tskaltubo.webp', alt: T('A domed iron gazebo in the autumn spa park of Tskaltubo') },
    { id: 'ambrolauri', reg: 'racha', name: T('Ambrolauri'), region: T('Racha · mountain valleys'), x: 466.6, y: 264.1, img: IMG + 'ambrolauri.webp', alt: T('A mountain road under green cliffs in Racha') },
    { id: 'bakhmaro', reg: 'guria', name: T('Bakhmaro'), region: T('Guria · mountain resort'), x: 349.7, y: 394.8, img: IMG + 'bakhmaro.webp', alt: T('A snow-covered wooden cabin among fir trees in Bakhmaro') },
    { id: 'ozurgeti', reg: 'guria', name: T('Ozurgeti'), region: T('Guria · tea hills'), x: 303.7, y: 380.2, img: IMG + 'ozurgeti.webp', alt: T('Ripe tangerines on a citrus tree in Guria') },
    { id: 'goricity', reg: 'shida', name: T('Gori'), region: T('Shida Kartli · hilltop fortress'), x: 603.8, y: 367.5, img: IMG + 'gori.webp', alt: T('A long stone arcade with arches in Gori') },
    { id: 'rustavi', reg: 'kvemo', name: T('Rustavi'), region: T('Kvemo Kartli'), x: 737.9, y: 451.2, img: IMG + 'rustavi.webp', alt: T('The open-air amphitheatre and hilltop monument in Rustavi city park') }
  ];
  // order of the automatic tour around the map
  window.mfsPlaces = places;
  var route = ['tbilisi', 'mtskheta', 'ananuri', 'gudauri', 'kazbegi', 'abudelauri', 'telavi', 'sighnaghi', 'gori', 'borjomi', 'vardzia', 'kutaisi', 'martvili', 'ushguli', 'mestia', 'gomismta', 'kobuleti', 'batumi'];
  route = ['tbilisi', 'rustavi', 'mtskheta', 'ananuri', 'gudauri', 'kazbegi', 'abudelauri', 'telavi', 'sighnaghi', 'goricity', 'gori', 'borjomi', 'vardzia', 'ambrolauri', 'tskaltubo', 'kutaisi', 'martvili', 'zugdidi', 'ushguli', 'mestia', 'poti', 'ozurgeti', 'bakhmaro', 'gomismta', 'kobuleti', 'batumi'];
  // Map
  var active = 'tbilisi';
  function byId(id) { return places.filter(function (p) { return p.id === id; })[0]; }
  function renderDots() {
    $('#cities').innerHTML = places.map(function (p) {
      var isOn = p.id === active, size = (p.major ? 14 : 10) + (isOn ? 6 : 0);
      return '<button type="button" class="city" data-id="' + p.id + '" aria-label="' + esc(p.name + ' — ' + p.region) + '" aria-expanded="' + isOn + '" style="left:' + (p.x / W * 100).toFixed(2) + '%;top:' + (p.y / H * 100).toFixed(2) + '%">' +
        (isOn ? '<span class="pulse" aria-hidden="true"></span>' : '') +
        '<span aria-hidden="true" style="width:' + size + 'px;height:' + size + 'px;border-radius:999px;background:' + (isOn ? '#6E1530' : (p.major ? '#F2B33D' : '#FFFFFF')) + ';border:2px solid #2B2320;box-shadow:0 0 0 1px ' + (isOn ? '#6E1530' : '#FBF6EE') + ';position:relative;transition:all .25s"></span>' +
        ((p.major || isOn) ? '<span class="lbl" aria-hidden="true" style="position:absolute;left:30px;top:50%;transform:translateY(-50%);white-space:nowrap;font-size:' + (p.major ? 14 : 13) + 'px;font-weight:700;color:' + (isOn ? '#6E1530' : '#2B2320') + ';pointer-events:none;text-shadow:0 0 3px #F7EDE0,0 0 6px #F7EDE0">' + esc(p.name) + '</span>' : '') +
        '</button>';
    }).join('');
  }
  function renderCard() {
    if (window.mfsMapPanel) window.mfsMapPanel(byId(active));
    var a = byId(active), pop = $('#pop');
    var px = a.x / W * 100, py = a.y / H * 100;
    var tx = px > 80 ? '-90%' : (px < 20 ? '-10%' : '-50%');
    var ty = py < 45 ? '22px' : 'calc(-100% - 22px)';
    pop.hidden = false;
    pop.style.left = px.toFixed(2) + '%'; pop.style.top = py.toFixed(2) + '%';
    pop.style.setProperty('--t', 'translate(' + tx + ',' + ty + ')');
    pop.style.transform = 'translate(' + tx + ',' + ty + ')';
    var media = a.video && !reduce ? '<video src="' + a.video + '"' + (a.img ? ' poster="' + a.img + '"' : '') + ' muted autoplay playsinline aria-label="' + esc(a.alt || a.name) + '" style="display:block;width:100%;height:165px;object-fit:cover"></video>'
      : (a.img ? '<img src="' + a.img + '" alt="' + esc(a.alt) + '">' : '<div class="ph">' + T('Photo coming') + '</div>');
    pop.innerHTML = media +
      '<div class="cap"><span>' + esc(a.region) + '</span><b>' + esc(a.name) + '</b></div><div class="bar" aria-hidden="true"></div>';
    var v = pop.querySelector('video'); if (v) v.addEventListener('ended', function () { tick(true); });
    pop.classList.remove('swap'); void pop.offsetWidth; pop.classList.add('swap');
  }
  function show(id) { if (id === active) return; active = id; renderDots(); renderCard(); }

  // Automatic tour: steps through the route like a carousel; pauses while the visitor is on the map
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var playing = !reduce, hovering = false, timer = null, holdUntil = 0;
  var toggle = $('#tour-toggle');
  var icoPause = '<svg width="12" height="14" viewBox="0 0 12 14" aria-hidden="true"><rect x="1" y="1" width="3.5" height="12" rx="1" fill="currentColor"/><rect x="7.5" y="1" width="3.5" height="12" rx="1" fill="currentColor"/></svg>';
  var icoPlay = '<svg width="12" height="14" viewBox="0 0 12 14" aria-hidden="true"><path d="M2 1.5v11l9-5.5z" fill="currentColor"/></svg>';
  function syncToggle() { toggle.innerHTML = playing ? icoPause + '<span>' + T('Pause') + '</span>' : icoPlay + '<span>' + T('Play') + '</span>'; toggle.setAttribute('aria-label', playing ? T('Pause the map tour') : T('Play the map tour')); toggle.setAttribute('aria-pressed', String(!playing)); }
  function tick(fromVideo) {
    if (!playing || hovering || document.hidden || Date.now() < holdUntil) return;
    if (!fromVideo && $('#pop video')) return; // a real clip decides when to move on
    var k = route.indexOf(active);
    show(route[(k + 1) % route.length]);
  }
  function start() { clearInterval(timer); timer = setInterval(function () { tick(false); }, 4000); }
  toggle.addEventListener('click', function () { playing = !playing; syncToggle(); });
  window.mfsStopTour = function () { playing = false; syncToggle(); };
  window.mfsTourOn = function () { return playing && !hovering && Date.now() >= holdUntil; };
  window.mfsTourPlaying = function () { return playing; };
  var mapBox = $('.px-map');
  mapBox.addEventListener('mouseenter', function () { hovering = true; });
  mapBox.addEventListener('mouseleave', function () { hovering = false; holdUntil = Date.now() + 1500; start(); });
  mapBox.addEventListener('focusin', function (e) { if (e.target !== toggle) hovering = true; });
  mapBox.addEventListener('focusout', function () { hovering = false; });
  function pick(e) {
    var b = e.target.closest('.city'); if (!b) return;
    holdUntil = Date.now() + 6000; // after a tap or hover the visitor gets time to look, then the tour continues
    show(b.dataset.id);
    if (e.type === 'focusin') { var nb = document.querySelector('.city[data-id="' + active + '"]'); if (nb) nb.focus(); }
  }
  $('#cities').addEventListener('mouseover', pick);
  $('#cities').addEventListener('click', pick);
  $('#cities').addEventListener('focusin', pick);
  renderDots(); renderCard(); syncToggle(); start();

  // Yellow line starts under the middle of "on" in "million" (wide screens; phones keep it centred)

  // Request form: validated here, emailed by send.php (see site.js MFS.send)
  var form = $('#req-form');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var name = $('#rq-name'), email = $('#rq-email'), phone = $('#rq-phone'), ok = $('#rq-consent');
    var bad = [];
    if (!name.value.trim()) bad.push(name);
    if (!/^\S+@\S+\.\S+$/.test(email.value)) bad.push(email);
    if (phone.value.replace(/\D/g, '').length < 6) bad.push(phone);
    if (!ok.checked) bad.push(ok);
    [name, email, phone, ok].forEach(function (f) { f.setAttribute('aria-invalid', String(bad.indexOf(f) > -1)); });
    var err = $('#rq-err'); err.textContent = T('Please add your name, a valid email, your phone number and tick the box.');
    err.hidden = !bad.length;
    if (bad.length) { bad[0].focus(); return; }
    var btn = form.querySelector('button[type="submit"]'), label = btn.textContent;
    btn.disabled = true; btn.textContent = T('Sending…');
    MFS.send(form, 'Trip request (home)', 'MFS').then(function (r) {
      $('#rq-id').textContent = r.ref;
      $('#req-fields').hidden = true; $('#req-done').hidden = false;
    }, function () {
      err.textContent = T('Sorry, that didn’t send. Please try again in a minute, or email us.'); err.hidden = false;
    }).then(function () { btn.disabled = false; btn.textContent = label; });
  });
  $('#rq-again').addEventListener('click', function () { form.reset(); $('#req-done').hidden = true; $('#req-fields').hidden = false; $('#rq-name').focus(); });
})();

/* ---- Background video ---- */
(function(){
  var v=document.getElementById('hero-vid'); if(!v) return;
  var mob=window.matchMedia('(max-width: 760px)').matches || !!v.closest('.hero-b');
  v.muted=true;
  var V=(window.MFS&&MFS.root||'')+'assets/video/';
  v.poster=V+(mob?'hero-poster-m.webp':'hero-poster.webp');
  v.src=V+(mob?'hero-mobile.mp4':'hero-desktop.mp4');
  // Visitors who ask their device for less motion see the still poster instead of the video
  var reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var btn=document.getElementById('vid-toggle'), userPaused=reduce;
  function sync(){ var p=v.paused; btn.setAttribute('aria-pressed',String(p)); btn.setAttribute('aria-label',p?T('Play background video'):T('Pause background video')); }
  function play(){ if(userPaused) return sync(); var pr=v.play(); if(pr&&pr.catch) pr.catch(function(){ sync() }); }
  v.addEventListener('play',sync); v.addEventListener('pause',sync);
  btn.addEventListener('click',function(){ userPaused=!v.paused; if(userPaused) v.pause(); else play(); });
  play(); sync();
  document.addEventListener('visibilitychange',function(){ if(document.hidden) v.pause(); else play(); });
})();

/* ---- Moods, places and tours collected into the request ---- */
(function(){
  var likes=document.getElementById('rq-likes'), form=document.getElementById('req-form'); if(!likes) return;
  var mini=document.getElementById('mini'), chips=document.getElementById('mini-chips'), empty=document.getElementById('mini-empty'), live=document.getElementById('likes-live');
  var pace=document.querySelector('.pace'), cards=[].slice.call(document.querySelectorAll('.pace-card'));
  var reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var engaged=false, dismissed=false, paceIn=false, mapIn=false, jrIn=false, formIn=false;
  function items(){ return likes.value.split(',').map(function(x){return x.trim()}).filter(Boolean) }
  function has(v){ return items().some(function(x){return x.toLowerCase()===v.toLowerCase()}) }
  function write(list){ likes.value=list.join(', '); sync() }
  function add(v){ if(!has(v)) write(items().concat(v)) }
  function remove(v){ write(items().filter(function(x){return x.toLowerCase()!==v.toLowerCase()})) }
  function esc(t){ return t.replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]}) }
  function sync(){
    var list=items();
    cards.forEach(function(c){ var on=has(c.dataset.like); c.setAttribute('aria-pressed',String(on)); c.classList.toggle('is-on',on) });
    chips.innerHTML=list.map(function(x){ return '<li><span>'+esc(x)+'</span><button type="button" data-v="'+esc(x)+'" aria-label="'+esc(T('Remove {x}').replace('{x}',x))+'"><svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 2l6 6M8 2L2 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button></li>' }).join('');
    empty.hidden=list.length>0;
    (window.mfsLikesListeners||[]).forEach(function(f){ f() });
  }
  function place(){ var show=engaged && !dismissed && (paceIn||mapIn||jrIn) && !formIn;
    if(show && mini.hidden){ mini.hidden=false; if(!reduce){ mini.classList.remove('mini-in'); void mini.offsetWidth; mini.classList.add('mini-in') } }
    else if(!show) mini.hidden=true; }
  function toPace(){ engaged=true; dismissed=false; var t=document.getElementById('pace-h'); t.scrollIntoView({behavior:reduce?'auto':'smooth',block:'start'}); setTimeout(function(){ cards[0].focus({preventScroll:true}) }, reduce?0:700) }
  function toForm(){ form.scrollIntoView({behavior:reduce?'auto':'smooth',block:'center'}); setTimeout(function(){ likes.focus({preventScroll:true}) }, reduce?0:700) }

  cards.forEach(function(c){ c.addEventListener('click',function(){
    var v=c.dataset.like, was=has(v); was?remove(v):add(v); engaged=true; dismissed=false; place();
    live.textContent=(was?T('Removed “{x}” from your request.'):T('Added “{x}” to your request.')).replace('{x}',v);
    if(!was && mini && !reduce){ mini.classList.remove('mini-bump'); void mini.offsetWidth; mini.classList.add('mini-bump') }
  }) });
  chips.addEventListener('click',function(e){ var b=e.target.closest('button[data-v]'); if(!b) return; var v=b.dataset.v; remove(v); live.textContent=T('Removed “{x}” from your request.').replace('{x}',v); var f=chips.querySelector('button'); (f||document.getElementById('mini-back')).focus() });
  document.getElementById('rq-ideas').addEventListener('click',toPace);
  document.getElementById('mini-back').addEventListener('click',toForm);
  document.getElementById('mini-x').addEventListener('click',function(){ dismissed=true; place() });
  likes.addEventListener('input',sync);
  form.addEventListener('reset',function(){ setTimeout(sync,0) });
  document.querySelectorAll('.jr[data-like] .jr-add').forEach(function(b){ var v=b.closest('.jr').dataset.like; b.setAttribute('aria-label',T('Add {x} to “Would like to see”').replace('{x}',v));
    b.addEventListener('click',function(){ window.mfsLikes.toggle(v); syncJr(); }) });
  function syncJr(){ document.querySelectorAll('.jr[data-like]').forEach(function(c){ var on=has(c.dataset.like); var b=c.querySelector('.jr-add'); if(b) b.setAttribute('aria-pressed',String(on)); c.classList.toggle('is-on',on); }) }
  new MutationObserver(syncJr).observe(chips,{childList:true,subtree:true});
  if('IntersectionObserver' in window){
    new IntersectionObserver(function(es){ paceIn=es[0].isIntersecting; place() },{threshold:0.15}).observe(pace);
    new IntersectionObserver(function(es){ mapIn=es[0].isIntersecting; place() },{threshold:0.15}).observe(document.querySelector('.map-sec'));
    new IntersectionObserver(function(es){ jrIn=es[0].isIntersecting; place() },{threshold:0.05}).observe(document.querySelector('.journeys'));
    new IntersectionObserver(function(es){ formIn=es[0].isIntersecting; place() },{threshold:0.35}).observe(form);
  }
  window.mfsLikes={ has:has, toggle:function(v){ var was=has(v); was?remove(v):add(v); engaged=true; dismissed=false; place(); live.textContent=(was?T('Removed “{x}” from your request.'):T('Added “{x}” to your request.')).replace('{x}',v); if(!was && !reduce){ mini.classList.remove('mini-bump'); void mini.offsetWidth; mini.classList.add('mini-bump') } return !was } };
  sync();
})();

/* ---- How it works: scroll scene ---- */
(function(){
  var s=document.querySelector('.hw'); if(!s) return;
  var rm=window.matchMedia('(prefers-reduced-motion: reduce)'), mq=window.matchMedia('(min-width: 900px)');
  var layers=[].slice.call(s.querySelectorAll('[data-depth]')), steps=[].slice.call(s.querySelectorAll('.hw-step'));
  var fill=s.querySelector('.hw-route-fill'), bar=s.querySelector('.hw-meter-bar i'), num=s.querySelector('.hw-meter-n');
  var prints=[].slice.call(s.querySelectorAll('.hw-print')), pTh=[.12,.18,.42,.48], ticking=false;
  function c(v){ return v<0?0:v>1?1:v }
  function frame(){
    ticking=false; if(!s.classList.contains('is-live')) return;
    var r=s.getBoundingClientRect(), span=r.height-window.innerHeight, p=c(-r.top/span);
    layers.forEach(function(l){ var d=l.dataset.depth;
      l.style.transform = d==='sun' ? 'translate3d(0,'+((1-p)*150-30).toFixed(1)+'px,0)' : 'translate3d(0,'+((1-p)*(+d)*220).toFixed(1)+'px,0)'; });
    var n=0;
    steps.forEach(function(st,i){ var o=i===0?1:c((p-(.04+i*.28))/.14); st.style.setProperty('--o',o.toFixed(3)); var on=o>.6; st.classList.toggle('on',on); if(on) n=i+1; });
    var f=c(p/.7); fill.style.setProperty('--p',f.toFixed(3)); bar.style.setProperty('--p',Math.max(f,.02).toFixed(3));
    num.textContent='0'+Math.max(n,1);
    prints.forEach(function(e,i){ e.style.setProperty('--o',(c((p-pTh[i])/.06)*.55).toFixed(3)); });
  }
  function setup(){
    var live=!rm.matches && mq.matches; s.classList.toggle('is-live',live);
    if(live){ frame(); return }
    layers.forEach(function(l){ l.style.transform='' });
    steps.forEach(function(st){ st.style.removeProperty('--o'); st.classList.add('on') });
    prints.forEach(function(e){ e.style.removeProperty('--o') });
    fill.style.setProperty('--p',1); bar.style.setProperty('--p',1); num.textContent='03';
  }
  window.addEventListener('scroll',function(){ if(!ticking){ ticking=true; requestAnimationFrame(frame) } },{passive:true});
  window.addEventListener('resize',setup);
  [rm,mq].forEach(function(m){ if(m.addEventListener) m.addEventListener('change',setup); else if(m.addListener) m.addListener(setup) });
  setup();
})();

/* ---- Moods carousel ---- */
(function(){
  var tr=document.getElementById('pace-track'); if(!tr) return;
  var prev=document.getElementById('pace-prev'), next=document.getElementById('pace-next');
  function step(){ var c=tr.querySelector('.pace-card'); return c ? (c.getBoundingClientRect().width+16) * Math.max(1, Math.floor(tr.clientWidth/(c.getBoundingClientRect().width+16)) - 0) : tr.clientWidth }
  function sync(){ var max=tr.scrollWidth-tr.clientWidth-2; prev.disabled=tr.scrollLeft<=2; next.disabled=tr.scrollLeft>=max; }
  prev.addEventListener('click',function(){ tr.scrollBy({left:-step()}) });
  next.addEventListener('click',function(){ tr.scrollBy({left:step()}) });
  tr.addEventListener('scroll',function(){ window.requestAnimationFrame(sync) },{passive:true});
  window.addEventListener('resize',sync); sync();
})();

/* ---- Place panel and route builder ---- */
(function(){
  var panel=document.getElementById('place-panel'); if(!panel) return;
  var INFO={
    tbilisi:[T('The capital: old-town balconies, sulphur baths and a lively café scene.'),0],
    mtskheta:[T('The ancient capital, with Svetitskhoveli Cathedral and Jvari monastery above two rivers.'),30],
    ananuri:[T('A fortress and churches above the turquoise Zhinvali reservoir, on the road north.'),75],
    gudauri:[T('Ski slopes in winter, paragliding over the valley in summer.'),120],
    kazbegi:[T('Gergeti Trinity Church under Mount Kazbek — the classic Caucasus view.'),180],
    abudelauri:[T('Three glacial lakes — blue, green and white — on a hike in Khevsureti.'),210],
    telavi:[T('The heart of Kakheti wine country, with family cellars all around.'),105],
    sighnaghi:[T('A hilltop town of balconies and cobbled lanes above the Alazani valley.'),105],
    gori:[T('An ancient town carved into the rock above the Mtkvari river.'),75],
    borjomi:[T('Pine forests, mineral springs and an easy, green pace.'),150],
    vardzia:[T('A 12th-century cave monastery cut into the cliff above the Mtkvari.'),240],
    kutaisi:[T('One of Georgia’s oldest cities, with Bagrati Cathedral and a busy market.'),180],
    martvili:[T('Boat rides through a turquoise canyon in Samegrelo.'),270],
    mestia:[T('The capital of Svaneti: medieval stone towers and mountain trails.'),480],
    ushguli:[T('One of Europe’s highest villages, under Mount Shkhara.'),600],
    gomismta:[T('A summer village above the clouds in the Guria mountains.'),360],
    kobuleti:[T('Pebble beaches and quiet Black Sea sunsets.'),240],
    batumi:[T('A seafront boulevard, a modern skyline and the Black Sea.'),270],
    poti:[T('Georgia’s Black Sea port, close to the lakes and wetlands of Kolkheti National Park.'),270],
    zugdidi:[T('The main town of Samegrelo, with the Dadiani Palace and its botanical garden.'),300],
    tskaltubo:[T('A spa town near Kutaisi, close to the Prometheus and Sataplia caves.'),210],
    ambrolauri:[T('The heart of Racha: mountain villages, quiet valleys and Khvanchkara wine.'),225],
    bakhmaro:[T('A summer mountain resort among the pine forests of Guria.'),360],
    ozurgeti:[T('The main town of Guria, among tea hills and citrus gardens.'),270],
    goricity:[T('A town in Shida Kartli under its hilltop fortress, on the main road west.'),60],
    rustavi:[T('A city just south-east of Tbilisi, on the road to Kvemo Kartli.'),30]
  };
  // known drive times between places (minutes); anything else is estimated from the map
  var PAIR={'kutaisi|mestia':270,'mestia|ushguli':120,'batumi|kutaisi':150,'batumi|kobuleti':30,'kobuleti|kutaisi':120,'kutaisi|martvili':60,'borjomi|vardzia':120,'borjomi|kutaisi':150,'telavi|sighnaghi':60,'gudauri|kazbegi':45,'ananuri|gudauri':45,'ananuri|mtskheta':45,'gori|mtskheta':60,'batumi|gomismta':150,'batumi|mestia':360,'martvili|mestia':240};
  // public transport from Tbilisi (approximate; checked Nov 2026)
  var MODES={
    batumi:[['train',T('Train ≈ 4–5 h')],['bus',T('Bus ≈ 5–7 h')],['plane',T('Flight ≈ 45 min')]],
    kobuleti:[['train',T('Train ≈ 4 h')],['bus',T('Bus ≈ 5 h')]],
    kutaisi:[['train',T('Train ≈ 5 h')],['bus',T('Bus ≈ 3.5–4 h')]],
    borjomi:[['train',T('Scenic train ≈ 4 h')],['bus',T('Bus ≈ 3 h')]],
    kazbegi:[['bus',T('Bus ≈ 3–3.5 h')]],
    gudauri:[['bus',T('Kazbegi bus ≈ 2 h')]],
    ananuri:[['bus',T('Kazbegi bus ≈ 1 h')]],
    mtskheta:[['bus',T('Bus ≈ 25 min')]],
    goricity:[['train',T('Train ≈ 1–1.5 h')],['bus',T('Bus ≈ 1–1.5 h')]],
    rustavi:[['bus',T('Bus ≈ 40 min')]],
    sighnaghi:[['bus',T('Bus ≈ 2 h')]],
    telavi:[['bus',T('Bus ≈ 2 h')]],
    mestia:[['plane',T('Flight < 1 h, weather permitting')],['bus',T('Bus ≈ 9–10 h')]]
  };
  var ICON={
    train:'<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h10a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3z" fill="currentColor"/><path d="M6.5 7h11v4h-11z" fill="#FFF" fill-opacity=".85"/><circle cx="8.5" cy="14.5" r="1.3" fill="#FFF"/><circle cx="15.5" cy="14.5" r="1.3" fill="#FFF"/><path d="M8 18l-2 3M16 18l2 3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    bus:'<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 15.5V8a3 3 0 0 1 3-3h10.5c1 0 1.9.5 2.4 1.3L21 10v5.5a1.5 1.5 0 0 1-1.5 1.5H4.5A1.5 1.5 0 0 1 3 15.5z" fill="currentColor"/><path d="M5 7.5h4v3.5H5zM10.5 7.5h4v3.5h-4zM16 7.5h1.7l1.8 3.5H16z" fill="#FFF" fill-opacity=".85"/><circle cx="7.5" cy="17.5" r="2" fill="currentColor" stroke="#FFF" stroke-width="1.2"/><circle cx="16.5" cy="17.5" r="2" fill="currentColor" stroke="#FFF" stroke-width="1.2"/></svg>',
    plane:'<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15.5v-2L13.5 9V4a1.5 1.5 0 0 0-3 0v5L3 13.5v2l7.5-2.3V18l-2 1.5V21l3.5-1 3.5 1v-1.5l-2-1.5v-4.8z" fill="currentColor"/></svg>'
  };
  var AIR={tbilisi:T('Tbilisi has an international airport'),kutaisi:T('Kutaisi has an international airport'),batumi:T('Batumi has an international airport'),mestia:T('Mestia has a small domestic airport')};
  var MOUNT={bakhmaro:1,ambrolauri:1,mestia:1,ushguli:1,kazbegi:1,gudauri:1,abudelauri:1,gomismta:1,vardzia:1};
  var W=987,H=565;
  var places=window.mfsPlaces||[], byId=function(id){ return places.filter(function(x){return x.id===id})[0] };
  var img=document.getElementById('pp-img'), reg=document.getElementById('pp-region'), nm=document.getElementById('pp-name'), bl=document.getElementById('pp-blurb'), tm=document.getElementById('pp-time-t'), btn=document.getElementById('pp-add'), bt=document.getElementById('pp-add-t');
  var g=document.getElementById('map-route'), times=document.getElementById('route-times'), cities=document.getElementById('cities');
  var stopsEl=document.getElementById('rb-stops'), totalEl=document.getElementById('rb-total'), rbAdd=document.getElementById('rb-add'), rbClear=document.getElementById('rb-clear'), rbHint=document.getElementById('rb-hint'), bar=document.getElementById('route-bar');
  var reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches, cur=null, sel=['tbilisi'], touched=false;
  function mins(a,b){
    if(a===b) return 0;
    if(a==='tbilisi') return INFO[b][1]; if(b==='tbilisi') return INFO[a][1];
    var k=[a,b].sort().join('|'); if(PAIR[k]) return PAIR[k];
    var A=byId(a), B=byId(b), dx=A.x-B.x, dy=A.y-B.y, km=Math.sqrt(dx*dx+dy*dy)*.56*1.4;
    return Math.round(km/((MOUNT[a]||MOUNT[b])?38:60)*60/15)*15;
  }
  function fmt(m){ if(!m) return ''; var h=Math.floor(m/60), r=m%60; return '≈ '+(h?T('{n} h').replace('{n}',h):'')+(h&&r?' ':'')+(r?T('{n} min').replace('{n}',r):''); }
  function routeName(){ return T('Route: {stops}').replace('{stops}',sel.map(function(id){return byId(id).name}).join(' → ')); }
  function drawLegs(list){
    g.innerHTML=''; times.innerHTML='';
    for(var i=1;i<list.length;i++){
      var A=byId(list[i-1]), B=byId(list[i]), dx=B.x-A.x, dy=B.y-A.y, len=Math.sqrt(dx*dx+dy*dy)||1, nx=-dy/len, ny=dx/len, bend=Math.min(50,len*.16);
      var cx=(A.x+B.x)/2+nx*bend, cy=(A.y+B.y)/2+ny*bend;
      var path=document.createElementNS('http://www.w3.org/2000/svg','path');
      path.setAttribute('d','M'+A.x+' '+A.y+' Q'+cx.toFixed(1)+' '+cy.toFixed(1)+' '+B.x+' '+B.y);
      path.setAttribute('class','route-leg'+(reduce?'':' draw')); path.style.animationDelay=(i-1)*.12+'s'; g.appendChild(path);
      var mx=.25*A.x+.5*cx+.25*B.x, my=.25*A.y+.5*cy+.25*B.y, t=document.createElement('span');
      t.className='route-time'+(reduce?'':' pop-in'); t.textContent=fmt(mins(A.id,B.id)); t.style.left=(mx/W*100).toFixed(2)+'%'; t.style.top=(my/H*100).toFixed(2)+'%'; t.style.animationDelay=(.2+(i-1)*.12)+'s';
      times.appendChild(t);
    }
  }
  function markDots(){
    [].slice.call(cities.querySelectorAll('.city')).forEach(function(b){ var n=sel.indexOf(b.dataset.id); b.classList.toggle('sel',n>-1); b.setAttribute('aria-pressed',String(n>-1)); if(n>-1) b.setAttribute('data-n',n+1); else b.removeAttribute('data-n'); });
  }
  function syncBtn(){ if(cur){ var on=window.mfsLikes && window.mfsLikes.has(cur.name); btn.setAttribute('aria-pressed',String(!!on)); btn.classList.toggle('is-on',!!on); bt.textContent=on?T('Added to your request'):T('Add {x} to my request').replace('{x}',cur.name); }
    var r=sel.length>1 && window.mfsLikes && window.mfsLikes.has(routeName()); rbAdd.setAttribute('aria-pressed',String(!!r)); rbAdd.classList.toggle('is-on',!!r); rbAdd.textContent=r?T('Route added ✓'):T('Add route to my request'); }
  window.mfsLikesListeners=(window.mfsLikesListeners||[]).concat(syncBtn);
  function renderBar(){
    stopsEl.innerHTML=sel.map(function(id){ return '<li>'+byId(id).name+'</li>' }).join('');
    var tot=0; for(var i=1;i<sel.length;i++) tot+=mins(sel[i-1],sel[i]);
    totalEl.textContent=sel.length>1?T('{time} on the road').replace('{time}',fmt(tot)):'';
    var ready=sel.length>1; rbAdd.hidden=!ready; rbClear.hidden=!sel.length; rbHint.hidden=touched&&ready; bar.classList.toggle('is-empty',!sel.length);
    syncBtn();
  }
  function renderRoute(){ drawLegs(touched?sel:(cur&&cur.id!=='tbilisi'?['tbilisi',cur.id]:[])); markDots(); if(touched) renderBar(); }
  window.mfsMapPanel=function(p){
    if(!p) return; cur=p; var info=INFO[p.id]||['',0];
    if(!reduce){ panel.classList.remove('swap'); void panel.offsetWidth; panel.classList.add('swap'); }
    if(p.img){ img.src=p.img; img.alt=p.alt||''; } else { img.src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 260'%3E%3Crect width='400' height='260' fill='%23DCEBF0'/%3E%3Ccircle cx='310' cy='70' r='30' fill='%23F2B33D'/%3E%3Cpath d='M0 170L70 120L120 140L190 80L250 125L320 95L400 130V260H0Z' fill='%23E8D2BE'/%3E%3Cpath d='M0 205C90 180 180 192 270 175C330 165 370 170 400 168V260H0Z' fill='%23D3BF92'/%3E%3Cpath d='M0 235C120 222 260 230 400 224V260H0Z' fill='%23AFA66C'/%3E%3C/svg%3E"; img.alt=''; }
    panel.classList.toggle('no-photo',!p.img);
    reg.textContent=p.region; nm.textContent=p.name; bl.textContent=info[0]; tm.textContent=T('Car {time}').replace('{time}',fmt(info[1])); document.getElementById('pp-go').hidden=(p.id==='tbilisi'); var air=document.getElementById('pp-air'); air.hidden=!AIR[p.id]; air.innerHTML=AIR[p.id]?ICON.plane+'<span>'+AIR[p.id]+'</span>':''; var om=MODES[p.id]||[]; document.getElementById('pp-other').innerHTML=om.map(function(m){ return '<span class="pp-mode">'+ICON[m[0]]+'<span>'+m[1]+'</span></span>' }).join('');
    syncBtn(); renderRoute();
    var pb=document.getElementById('pp-bar'); pb.classList.remove('run'); void pb.offsetWidth; if(!touched && window.mfsTourPlaying && window.mfsTourPlaying()) pb.classList.add('run');
  };
  setInterval(function(){ var pb=document.getElementById('pp-bar'), on=!touched && window.mfsTourPlaying && window.mfsTourPlaying(); pb.hidden=!on; pb.classList.toggle('hold',!!(on && window.mfsTourOn && !window.mfsTourOn())); },250);
  cities.addEventListener('click',function(e){
    var b=e.target.closest('.city'); if(!b) return;
    if(!touched){ touched=true; if(window.mfsStopTour) window.mfsStopTour(); }
    var id=b.dataset.id, n=sel.indexOf(id); if(n>-1) sel.splice(n,1); else sel.push(id);
    if(cur && cur.id!==id && window.mfsPlaces) window.mfsMapPanel(byId(id)); else renderRoute();
    renderBar(); var nb=cities.querySelector('.city[data-id="'+id+'"]'); if(nb && document.activeElement!==nb && e.detail===0) nb.focus();
  });
  btn.addEventListener('click',function(){ if(cur && window.mfsLikes) window.mfsLikes.toggle(cur.name); });
  rbAdd.addEventListener('click',function(){ if(sel.length>1 && window.mfsLikes) window.mfsLikes.toggle(routeName()); });
  rbClear.addEventListener('click',function(){ touched=true; if(window.mfsStopTour) window.mfsStopTour(); sel=[]; renderRoute(); renderBar(); });
  renderBar(); rbHint.hidden=false;
  var a=document.querySelector('.city[aria-expanded="true"]'); window.mfsMapPanel(byId(a?a.dataset.id:'tbilisi'));
})();

/* ---- Regions on the map ---- */
(function(){
  var regs=document.getElementById('regions'), cities=document.getElementById('cities'); if(!regs||!cities) return;
  var byId=function(id){ return (window.mfsPlaces||[]).filter(function(p){return p.id===id})[0] };
  var tip=document.createElement('div'); tip.className='rg-tip'; tip.hidden=true; tip.setAttribute('role','status'); document.querySelector('.px-map').appendChild(tip);
  function on(reg){ [].forEach.call(regs.querySelectorAll('.rg'),function(p){ p.classList.toggle('on',p.dataset.reg===reg) }); [].forEach.call(document.querySelectorAll('.rg-lbl'),function(t){ t.classList.toggle('on',t.dataset.reg===reg) }); }
  cities.addEventListener('mouseover',function(e){ var b=e.target.closest('.city'); if(!b) return; var p=byId(b.dataset.id); on(p&&p.reg); });
  cities.addEventListener('focusin',function(e){ var b=e.target.closest('.city'); if(!b) return; var p=byId(b.dataset.id); on(p&&p.reg); });
  cities.addEventListener('mouseout',function(e){ if(!e.relatedTarget||!e.relatedTarget.closest||!e.relatedTarget.closest('.city')) on(null); });
  cities.addEventListener('focusout',function(){ on(null); });
  // Abkhazia and Samachablo: outline + colour on hover; a click marks them, but they can't be added to a route
  var NAMES={abkhazia:T('Abkhazia'),samachablo:T('Samachablo')};
  function showTip(p,ev){ var box=document.querySelector('.px-map').getBoundingClientRect(); tip.innerHTML='<b>'+NAMES[p.dataset.reg]+'</b>'; tip.hidden=false;
    var lbl=document.querySelector('.rg-lbl[data-reg="'+p.dataset.reg+'"]'), r=lbl.getBoundingClientRect(); tip.style.left=(r.left+r.width/2-box.left)+'px'; tip.style.top=(r.bottom-box.top+8)+'px'; }
  [].forEach.call(regs.querySelectorAll('.rg-occ'),function(p){
    p.addEventListener('mouseenter',function(e){ p.classList.add('hov'); showTip(p,e); });
    p.addEventListener('mouseleave',function(){ p.classList.remove('hov'); if(!p.classList.contains('marked')) tip.hidden=true; });
    p.addEventListener('click',function(e){ var was=p.classList.contains('marked'); [].forEach.call(regs.querySelectorAll('.rg-occ'),function(q){q.classList.remove('marked')}); if(!was){ p.classList.add('marked'); showTip(p,e);} else tip.hidden=true; });
  });
})();

/* ---- Sample journeys: the road and the van ---- */
(function(){
  var sec=document.querySelector('.journeys'); if(!sec) return;
  // Tours the owners take off the website are hidden (site.js, mfs:live): the road only visits the cards on show.
  var scene=sec.querySelector('.jr-scene'), pin=sec.querySelector('.jr-pin'), move=sec.querySelector('.jr-move'), grid=sec.querySelector('.jr-grid'), all=[].slice.call(sec.querySelectorAll('.jr')), cards=all, road=sec.querySelector('.jr-road');
  var track=sec.querySelector('.jr-track'), fill=sec.querySelector('.jr-fill'), pinsG=sec.querySelector('.jr-pins'), van=sec.querySelector('.jr-van');
  var rm=window.matchMedia('(prefers-reduced-motion: reduce)'), mq=window.matchMedia('(min-width: 1001px)');
  var xs=[], midX=0, L=0, ticking=false, pins=[], stops=[], viewW=0, endX=0, maxShift=0, lastLen=null;
  function c(v){ return v<0?0:v>1?1:v }
  function layout(){
    cards=all.filter(function(el){ return !el.hidden });
    move.style.transform=''; cards.forEach(function(el){ el.style.setProperty('--o',1) });
    viewW=grid.parentNode.clientWidth;
    xs=cards.map(function(el){ return el.offsetLeft+el.offsetWidth/2 });
    var y=26, d='M'+xs[0]+' '+y;
    for(var i=1;i<xs.length;i++){ var a=xs[i-1], b=xs[i], w=b-a; d+=' C'+(a+w/3).toFixed(1)+' '+(y+20)+' '+(a+2*w/3).toFixed(1)+' '+(y-20)+' '+b+' '+y; }
    var last=xs[xs.length-1]; endX=last; // the road ends at the last card
    track.setAttribute('d',d); fill.setAttribute('d',d); L=track.getTotalLength();
    pinsG.innerHTML=xs.map(function(x){ return '<circle cx="'+x+'" cy="'+y+'" r="7"/>' }).join(''); pins=[].slice.call(pinsG.querySelectorAll('circle'));
    // where each card sits along the road
    stops=[]; var n=400, k=0; for(var i2=0;i2<=n;i2++){ var pt=track.getPointAtLength(L*i2/n); while(k<xs.length && pt.x>=xs[k]-.5){ stops[k]=L*i2/n; k++ } } while(stops.length<xs.length) stops.push(L);
    // the camera keeps the van at the middle of the screen and stops when the last card (See all tours) is centred under the cursor
    midX=window.innerWidth/2-grid.parentNode.getBoundingClientRect().left;
    maxShift=Math.max(0,xs[xs.length-1]-midX);
  }
  function frame(){
    ticking=false; if(!sec.classList.contains('is-live')) return;
    var r=scene.getBoundingClientRect(), span=r.height-window.innerHeight, p=c(-r.top/span), v=c(p/.96);
    var endLen=stops.length?stops[stops.length-1]:L, len=endLen*v, pt=track.getPointAtLength(len), pt2=track.getPointAtLength(Math.min(L,len+2)), ang=Math.atan2(pt2.y-pt.y,pt2.x-pt.x)*180/Math.PI;
    // the camera follows the van once it passes the middle card of the view; the van stops at the last card
    var shift=Math.min(maxShift,Math.max(0,pt.x-midX));
    move.style.transform='translate3d('+(-shift).toFixed(1)+'px,0,0)';
    van.style.transform='translate('+(pt.x-22)+'px,'+(pt.y-20)+'px) rotate('+ang.toFixed(1)+'deg)';
    if(lastLen!==null && Math.abs(len-lastLen)>.5) van.classList.toggle('van-back',len<lastLen); lastLen=len;
    fill.style.setProperty('--d',(1-len/L).toFixed(4));
    var gap=stops.length>1?stops[1]-stops[0]:L;
    cards.forEach(function(el,i){ var o=i===0?1:c((len-(stops[i]-gap*.55))/(gap*.45)); el.style.setProperty('--o',o.toFixed(3)); if(pins[i]) pins[i].classList.toggle('on',len>=stops[i]-2); });
  }
  function setup(){
    var live=!rm.matches && mq.matches; sec.classList.toggle('is-live',live);
    if(!live){ move.style.transform=''; all.forEach(function(el){ el.style.removeProperty('--o') }); return }
    layout(); frame();
  }
  window.addEventListener('scroll',function(){ if(!ticking){ ticking=true; requestAnimationFrame(frame) } },{passive:true});
  window.addEventListener('resize',setup);
  document.addEventListener('mfs:live',setup);
  [rm,mq].forEach(function(m){ if(m.addEventListener) m.addEventListener('change',setup) });
  if(document.fonts && document.fonts.ready) document.fonts.ready.then(setup);
  setup();
})();

/* ---- Garland bulbs ---- */
(function(){ var box=document.querySelector('.mo-bulbs'); if(!box) return; var h='';
  // bulbs hang along the garland curve: y = cubic through the same points as the svg path
  function y(t){ var p0=18,p1=90,p2=90,p3=40, q0=40,q1=-6,q2=70,q3=30; if(t<.5){ var u=t*2; return Math.pow(1-u,3)*p0+3*Math.pow(1-u,2)*u*p1+3*(1-u)*u*u*p2+u*u*u*p3 } var v=(t-.5)*2; return Math.pow(1-v,3)*q0+3*Math.pow(1-v,2)*v*q1+3*(1-v)*v*v*q2+v*v*v*q3 }
  for(var i=1;i<24;i++){ var t=i/24; h+='<i style="left:'+(t*100).toFixed(2)+'%;top:'+(y(t)/120*100+4).toFixed(2)+'%"></i>' } box.innerHTML=h; })();

/* Infinity Fitness Gym — interactions */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ---- split hero title into characters ---- */
  $$('.split').forEach(el => {
    const txt = el.textContent; el.textContent = ''; el.setAttribute('aria-label', txt);
    [...txt].forEach((ch, i) => {
      const s = document.createElement('span'); s.className = 'ch'; s.setAttribute('aria-hidden', 'true');
      s.textContent = ch === ' ' ? ' ' : ch;
      s.style.transitionDelay = (0.04 * i + (el.classList.contains('outline') ? 0.18 : 0)) + 's';
      el.appendChild(s);
    });
  });


  /* ---- fit hero title so each line stays on one line ---- */
  const title = $('.hero__title');
  function fitTitle() {
    if (!title) return;
    title.style.fontSize = '';
    const avail = title.clientWidth;
    const widest = Math.max(...$$('.split', title).map(s => s.getBoundingClientRect().width));
    if (widest > avail) {
      const cur = parseFloat(getComputedStyle(title).fontSize);
      title.style.fontSize = Math.floor(cur * avail / widest * 0.98) + 'px';
    }
  }
  fitTitle();
  if (document.fonts) document.fonts.ready.then(fitTitle);
  addEventListener('resize', fitTitle);

  /* ---- loader ---- */
  const loader = $('#loader'), pct = $('#loaderPct');
  const imgs = [$('.hero__bg img')].filter(Boolean);
  let shown = 0, target = 0, done = false;
  const bump = () => { target = Math.min(100, target + 100 / (imgs.length + 1)); };
  imgs.forEach(im => im.complete ? bump() : (im.addEventListener('load', bump), im.addEventListener('error', bump)));
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(bump);
  const t0 = performance.now();
  (function tick() {
    const elapsed = performance.now() - t0;
    shown = Math.min(target, shown + Math.max(1, (target - shown) * 0.15));
    pct.textContent = String(Math.min(99, Math.round(shown))).padStart(2, '0');
    if ((target >= 99.9 && elapsed > 1300) || elapsed > 3200) return finish();
    requestAnimationFrame(tick);
  })();
  function finish() {
    if (done) return; done = true;
    pct.textContent = '100';
    loader.classList.add('done');
    document.body.classList.add('ready');
    window.dispatchEvent(new Event('infinity:start'));
    setTimeout(() => $$('.hero [data-reveal]').forEach((el, i) => setTimeout(() => el.classList.add('in'), 150 * i)), 350);
  }

  /* ---- reveal on scroll ---- */
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting && !e.target.closest('.hero')) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { rootMargin: '0px 0px -10% 0px', threshold: 0.12 });
  $$('[data-reveal]').forEach((el) => {
    const sib = el.parentElement ? [...el.parentElement.children].filter(c => c.hasAttribute('data-reveal')) : [];
    el.style.transitionDelay = Math.min(0.4, sib.indexOf(el) * 0.08) + 's';
    io.observe(el);
  });

  /* ---- nav ---- */
  const nav = $('#nav'), wa = $('.wa-float'), heroBg = $('#heroBg');
  let ticking = false;
  function onScroll() {
    const y = scrollY;
    nav.classList.toggle('scrolled', y > 40);
    wa.classList.toggle('show', y > innerHeight * 0.8);
    if (!reduce && heroBg && y < innerHeight * 1.2) heroBg.style.transform = `translate3d(0,${y * 0.25}px,0) scale(${1 + y * 0.0002})`;
    ticking = false;
  }
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();

  const links = $$('.nav__links a');
  const secIO = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) links.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + e.target.id));
  }), { rootMargin: '-45% 0px -50% 0px' });
  ['floor', 'programs', 'tour', 'plans', 'visit'].forEach(id => { const s = document.getElementById(id); s && secIO.observe(s); });

  const burger = $('#burger'), drawer = $('#drawer');
  function setDrawer(open) {
    burger.setAttribute('aria-expanded', open); drawer.classList.toggle('open', open);
    drawer.setAttribute('aria-hidden', !open); document.body.style.overflow = open ? 'hidden' : '';
  }
  burger.addEventListener('click', () => setDrawer(burger.getAttribute('aria-expanded') !== 'true'));
  $$('a', drawer).forEach(a => a.addEventListener('click', () => setDrawer(false)));
  addEventListener('keydown', e => { if (e.key === 'Escape') setDrawer(false); });

  /* ---- counters ---- */
  $$('[data-count]').forEach(el => {
    const end = +el.dataset.count;
    const run = () => { const s = performance.now(); (function f(n) { const p = Math.min(1, (n - s) / 1400); el.textContent = Math.round(end * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(f); })(s); };
    addEventListener('infinity:start', () => setTimeout(run, 900), { once: true });
  });

  /* ---- 3D tilt ---- */
  if (fine && !reduce) {
    $$('.tilt').forEach(el => {
      const max = el.classList.contains('card') ? 9 : 6;
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        el.style.setProperty('--ry', ((x - 0.5) * max * 2).toFixed(2) + 'deg');
        el.style.setProperty('--rx', ((0.5 - y) * max * 2).toFixed(2) + 'deg');
        el.style.setProperty('--mx', (x * 100) + '%'); el.style.setProperty('--my', (y * 100) + '%');
      });
      el.addEventListener('pointerleave', () => { el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); });
    });
  }

  /* ---- 3D ring gallery ---- */
  const ring = $('#ring'), stage = $('#ringStage');
  if (ring && stage) {
    const items = $$('.ring__item', stage), n = items.length, step = 360 / n;
    let radius = 0, rot = 0, vel = reduce ? 0 : -0.06, drag = null, inView = false, idle = !reduce;
    function layout() {
      const w = items[0].offsetWidth;
      radius = Math.round((w / 2) / Math.tan(Math.PI / n) * 1.12);
      items.forEach((it, i) => { it.style.transform = `rotateY(${i * step}deg) translateZ(${radius}px)`; });
    }
    function paint() {
      stage.style.transform = `translateZ(${-radius}px) rotateX(-6deg) rotateY(${rot}deg)`;
      items.forEach((it, i) => {
        let a = ((i * step + rot) % 360 + 540) % 360 - 180; // -180..180, 0 = facing
        const f = Math.cos(a * Math.PI / 180);
        it.style.filter = `brightness(${(0.35 + 0.65 * Math.max(0, f)).toFixed(3)})`;
        it.style.zIndex = Math.round(f * 100) + 100;
      });
    }
    function loop() {
      if (!drag) {
        if (idle) vel += (-0.06 - vel) * 0.02; else vel *= 0.95;
        if (Math.abs(vel) < 0.002 && !idle) vel = 0;
        rot += vel;
      }
      paint();
      if (inView) requestAnimationFrame(loop);
    }
    new IntersectionObserver(es => { const was = inView; inView = es[0].isIntersecting; if (inView && !was) requestAnimationFrame(loop); }).observe(ring);
    ring.addEventListener('pointerdown', e => {
      drag = { x: e.clientX, r: rot, t: performance.now(), lx: e.clientX }; idle = false; ring.setPointerCapture(e.pointerId);
    });
    ring.addEventListener('pointermove', e => {
      if (!drag) return; const dx = e.clientX - drag.x; rot = drag.r + dx * 0.22;
      const now = performance.now(); vel = (e.clientX - drag.lx) * 0.22 / Math.max(1, (now - drag.t) / 16.7); drag.lx = e.clientX; drag.t = now;
    });
    const end = () => { if (!drag) return; drag = null; setTimeout(() => { idle = !reduce; }, 2500); };
    ring.addEventListener('pointerup', end); ring.addEventListener('pointercancel', end);
    ring.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); idle = false; vel = 0;
        const target = Math.round((rot + (e.key === 'ArrowLeft' ? step : -step)) / step) * step;
        const s = rot, st = performance.now();
        (function a(nw) { const p = Math.min(1, (nw - st) / 500); rot = s + (target - s) * (1 - Math.pow(1 - p, 3)); if (p < 1) requestAnimationFrame(a); else setTimeout(() => { idle = !reduce; }, 3000); })(st);
      }
    });
    addEventListener('resize', () => { layout(); paint(); });
    layout(); paint();
  }

  /* ---- videos: play only when visible ---- */
  const vIO = new IntersectionObserver(es => es.forEach(e => {
    const v = e.target;
    if (e.isIntersecting) { if (v.preload === 'none') { v.preload = 'auto'; } if (!reduce) v.play().catch(() => {}); }
    else v.pause();
  }), { threshold: 0.25 });
  $$('video[data-autoplay]').forEach(v => {
    vIO.observe(v);
    if (reduce) { v.controls = true; }
  });

  /* ---- phone card follows pointer a little ---- */
  const phone = $('#phone3d');
  if (phone && fine && !reduce) {
    const card = $('.phone3d__card', phone);
    phone.addEventListener('pointermove', e => {
      const r = phone.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      card.style.transform = `rotateY(${(-4 + x * 14).toFixed(2)}deg) rotateX(${(2 - y * 10).toFixed(2)}deg)`;
    });
    phone.addEventListener('pointerleave', () => { card.style.transform = ''; });
  }

  const yr = $('#yr'); if (yr) yr.textContent = new Date().getFullYear();
})();

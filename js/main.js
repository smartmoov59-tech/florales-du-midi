/* ==========================================================================
   Florales du midi — site statique autonome (aucun back-end, aucun service payant)
   GSAP + ScrollTrigger + Lenis (hébergés dans /js/vendor)
   ========================================================================== */
(() => {
  'use strict';

  /* ------------------------------------------------------------------
     CONFIG : à modifier ici si les infos de la boutique changent
     ------------------------------------------------------------------ */
  const SHOP = {
    name: 'Florales du midi',
    email: 'florales.midi@gmail.com',
    phoneDisplay: '04 42 51 59 57',
    // Le 04 42 51 59 57 est un numéro fixe : il ne reçoit pas de SMS.
    // Si la boutique a un mobile, le mettre ici (ex. '+33612345678') :
    // le bouton « Envoyer par SMS » apparaîtra automatiquement dans la réservation.
    smsNumber: '',
    address: '43-45 boulevard Carnot, 13120 Gardanne',
    tz: 'Europe/Paris',
    // 0 = dimanche … 6 = samedi → [ouverture, fermeture] en heures décimales
    hours: { 0: [8.5, 13], 1: [9, 19], 2: [8.5, 19.5], 3: [8.5, 19.5], 4: [8.5, 19.5], 5: [8.5, 19.5], 6: [8.5, 19.5] }
  };

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

  if (!window.gsap || !window.ScrollTrigger) {
    const l = $('#loader'); if (l) l.remove();
    document.body.classList.remove('is-loading');
    return;
  }

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;

  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });

  /* ------------------------------------------------------------------
     Smooth scroll (Lenis) branché sur GSAP
     ------------------------------------------------------------------ */
  let lenis = null;
  if (!reduce && window.Lenis) {
    lenis = new Lenis({ duration: 1.15, easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(t => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  /* ------------------------------------------------------------------
     Heures de Paris, statut ouvert/fermé, tableau d'horaires
     ------------------------------------------------------------------ */
  const DOW = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  function parisNow() {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: SHOP.tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23' }).formatToParts(new Date());
    const g = t => parts.find(p => p.type === t).value;
    return { y: +g('year'), m: +g('month'), d: +g('day'), h: +g('hour') % 24, min: +g('minute'), dow: DOW[g('weekday').slice(0, 3)] };
  }
  const fmtH = h => { const hh = Math.floor(h + 1e-9), mm = Math.round((h - hh) * 60); return hh + 'h' + String(mm).padStart(2, '0'); };

  function statusInfo() {
    const n = parisNow(), t = n.h + n.min / 60, [o, c] = SHOP.hours[n.dow];
    if (t >= o && t < c) return { open: true, text: 'Ouvert · jusqu\u2019à ' + fmtH(c) };
    if (t < o) return { open: false, text: 'Fermé · ouvre à ' + fmtH(o) };
    const next = SHOP.hours[(n.dow + 1) % 7][0];
    return { open: false, text: 'Fermé · ouvre demain à ' + fmtH(next) };
  }
  function updateStatus() {
    const s = statusInfo(), n = parisNow();
    $$('[data-status]').forEach(el => {
      el.classList.toggle('is-closed', !s.open);
      const t = $('[data-status-text]', el); if (t) t.textContent = s.text;
    });
    $$('#hours tr').forEach(tr => tr.classList.toggle('is-today', +tr.dataset.dow === n.dow));
  }
  updateStatus();
  setInterval(updateStatus, 60000);

  /* ------------------------------------------------------------------
     Découpage de texte (mots masqués, mots simples, lettres)
     ------------------------------------------------------------------ */
  function splitNode(node, wrapWord) {
    const frag = document.createDocumentFragment();
    node.childNodes.forEach(n => {
      if (n.nodeType === 3) {
        n.textContent.split(/(\s+)/).forEach(tok => {
          if (!tok) return;
          if (/^\s+$/.test(tok)) { frag.appendChild(document.createTextNode(' ')); return; }
          frag.appendChild(wrapWord(tok));
        });
      } else if (n.nodeType === 1) {
        if (n.tagName === 'BR') { frag.appendChild(n.cloneNode()); return; }
        const c = n.cloneNode(false);
        c.appendChild(splitNode(n, wrapWord));
        frag.appendChild(c);
      }
    });
    return frag;
  }
  function splitWords(el) {
    el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
    const frag = splitNode(el, tok => {
      const w = document.createElement('span'); w.className = 'w'; w.setAttribute('aria-hidden', 'true');
      const i = document.createElement('span'); i.className = 'wi'; i.textContent = tok; w.appendChild(i); return w;
    });
    el.textContent = ''; el.appendChild(frag);
    return $$('.wi', el);
  }
  function splitSimple(el) {
    const frag = splitNode(el, tok => { const s = document.createElement('span'); s.className = 'mw'; s.textContent = tok; return s; });
    el.textContent = ''; el.appendChild(frag);
    return $$('.mw', el);
  }
  function splitChars(el, cls) {
    cls = cls || 'ch';
    const frag = splitNode(el, tok => {
      const w = document.createElement('span'); w.style.cssText = 'display:inline-block;white-space:nowrap';
      Array.from(tok).forEach(ch => { const s = document.createElement('span'); s.className = cls; s.textContent = ch; w.appendChild(s); });
      return w;
    });
    el.textContent = ''; el.appendChild(frag);
    const chars = $$('.' + cls, el); chars.forEach((c, i) => c.style.setProperty('--i', i));
    return chars;
  }

  /* ------------------------------------------------------------------
     Branche d'olivier (premier plan du hero), dessinée à la volée
     ------------------------------------------------------------------ */
  function buildBranch(svg, seed, mirror) {
    const NS = 'http://www.w3.org/2000/svg';
    let s = seed; const rnd = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
    const P = [[150, 565], [118, 390], [196, 230], [128, 16]];
    const bez = t => { const u = 1 - t; return [0, 1].map(k => u * u * u * P[0][k] + 3 * u * u * t * P[1][k] + 3 * u * t * t * P[2][k] + t * t * t * P[3][k]); };
    const mk = (tag, attrs) => { const e = document.createElementNS(NS, tag); Object.keys(attrs).forEach(k => e.setAttribute(k, attrs[k])); svg.appendChild(e); return e; };
    mk('path', { d: `M${P[0]} C${P[1]} ${P[2]} ${P[3]}`, fill: 'none', stroke: '#0c1a12', 'stroke-width': 4.5, 'stroke-linecap': 'round' });
    for (let i = 0; i < 15; i++) {
      const t = 0.1 + i * 0.058, [x, y] = bez(t), [x2, y2] = bez(t + 0.012);
      const ang = Math.atan2(y2 - y, x2 - x) * 180 / Math.PI, side = i % 2 ? 1 : -1;
      const len = 46 + rnd() * 28 + (1 - t) * 18, w = len * 0.3;
      const rot = ang + side * (46 + rnd() * 22);
      mk('path', { d: `M0 0Q${len / 2} ${-w} ${len} 0Q${len / 2} ${w} 0 0Z`, fill: i % 3 ? '#10261a' : '#173424', transform: `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rot.toFixed(1)})` });
      if (i % 4 === 1) mk('ellipse', { cx: x + side * 14, cy: y + 18, rx: 6, ry: 8.5, fill: '#2d3a22', transform: `rotate(${side * 12} ${x} ${y})` });
    }
    const [tx, ty] = bez(1);
    mk('path', { d: 'M0 0Q34 -14 76 0Q34 14 0 0Z', fill: '#173424', transform: `translate(${tx} ${ty}) rotate(-96)` });
    if (mirror) gsap.set(svg, { scaleX: -1 });
  }
  $$('[data-branch]').forEach((svg, i) => buildBranch(svg, 11 + i * 37, i === 1));

  /* ------------------------------------------------------------------
     Menu mobile plein écran
     ------------------------------------------------------------------ */
  const burger = $('#burger'), menu = $('#menu');
  let menuOpen = false;
  function openMenu() {
    if (menuOpen) return; menuOpen = true;
    menu.classList.add('is-open'); menu.setAttribute('aria-hidden', 'false');
    burger.setAttribute('aria-expanded', 'true'); burger.setAttribute('aria-label', 'Fermer le menu');
    if (lenis) lenis.stop(); else document.body.style.overflow = 'hidden';
    $('#nav').classList.remove('is-hidden');
    gsap.timeline()
      .to(menu, { clipPath: 'circle(150% at calc(100% - 44px) 44px)', duration: .9, ease: 'power3.inOut' })
      .fromTo('.menu__nav .wi', { yPercent: 115 }, { yPercent: 0, duration: .9, ease: 'expo.out', stagger: .06 }, '-=.45')
      .fromTo('.menu__foot', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: .6, ease: 'power3.out' }, '-=.5');
  }
  function closeMenu(instant) {
    if (!menuOpen) return; menuOpen = false;
    burger.setAttribute('aria-expanded', 'false'); burger.setAttribute('aria-label', 'Ouvrir le menu');
    menu.setAttribute('aria-hidden', 'true');
    if (lenis) lenis.start(); else document.body.style.overflow = '';
    gsap.to(menu, { clipPath: 'circle(0% at calc(100% - 44px) 44px)', duration: instant ? 0 : .7, ease: 'power3.inOut', onComplete: () => menu.classList.remove('is-open') });
  }
  if (burger && menu) {
    burger.addEventListener('click', () => (menuOpen ? closeMenu() : openMenu()));
    addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
  }

  /* ------------------------------------------------------------------
     Ancres : défilement fluide + pré-sélection de l'occasion
     ------------------------------------------------------------------ */
  let wiz = null;
  $$('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const id = a.getAttribute('href');
      if (id.length < 2) return;
      const target = id === '#top' ? document.body : $(id);
      if (!target) return;
      e.preventDefault();
      const wasOpen = menuOpen; closeMenu(true);
      if (a.dataset.occasion && wiz) wiz.preselect(a.dataset.occasion);
      const go = () => {
        if (lenis) lenis.scrollTo(id === '#top' ? 0 : target, { duration: 1.8, easing: t => 1 - Math.pow(1 - t, 4), immediate: false });
        else target.scrollIntoView({ behavior: 'auto' });
      };
      wasOpen ? setTimeout(go, 60) : go();
    });
  });

  /* ------------------------------------------------------------------
     Nav : se cache en descendant, revient en remontant
     ------------------------------------------------------------------ */
  const nav = $('#nav');
  let lastY = 0;
  function onScrollNav(y) {
    nav.classList.toggle('is-solid', y > 40);
    if (menuOpen) { lastY = y; return; }
    if (y > lastY + 2 && y > 160) nav.classList.add('is-hidden');
    else if (y < lastY - 2) nav.classList.remove('is-hidden');
    lastY = y;
  }
  if (lenis) lenis.on('scroll', ({ scroll }) => onScrollNav(scroll));
  else addEventListener('scroll', () => onScrollNav(scrollY), { passive: true });

  /* ------------------------------------------------------------------
     Barre de lecture + tige qui pousse (fil rouge)
     ------------------------------------------------------------------ */
  const pbar = $('#progress-bar'), sline = $('#stem-line'), sflower = $('#stem-flower');
  ScrollTrigger.create({
    start: 0, end: 'max',
    onUpdate: self => {
      const p = self.progress;
      pbar.style.transform = 'scaleX(' + p + ')';
      sline.style.transform = 'scaleY(' + p + ')';
      sflower.style.transform = 'translate3d(0,' + (p * sline.parentElement.clientHeight) + 'px,0) rotate(' + (p * 900) + 'deg)';
    }
  });

  /* ------------------------------------------------------------------
     Hero : vidéo, état initial, intro, parallax multicouche
     ------------------------------------------------------------------ */
  const hero = $('.hero');
  const video = $('#hero-video');
  function setupVideo() {
    if (reduce || !video) return;
    const saver = navigator.connection && navigator.connection.saveData;
    if (saver) return;
    video.muted = true; video.defaultMuted = true;
    video.src = innerWidth < 900 ? 'media/hero-720.mp4' : 'media/hero.mp4';
    video.addEventListener('canplay', () => { video.play().then(() => video.classList.add('is-on')).catch(() => {}); }, { once: true });
    video.load();
    new IntersectionObserver(([e]) => { if (!video.classList.contains('is-on')) return; e.isIntersecting ? video.play().catch(() => {}) : video.pause(); }).observe(hero);
  }
  setupVideo();

  const heroChars = $$('.hero__title [data-chars]').flatMap(el => splitChars(el, 'ch'));
  const petals = $$('.petal');
  petals.forEach((p, i) => {
    const rot = parseFloat(getComputedStyle(p).getPropertyValue('--r')) || 0;
    p.style.transform = 'none'; gsap.set(p, { rotation: rot });
    if (!reduce) gsap.to(p, { x: '+=' + gsap.utils.random(-34, 34), rotation: '+=' + gsap.utils.random(-38, 38), duration: gsap.utils.random(4, 8), ease: 'sine.inOut', yoyo: true, repeat: -1, delay: -i });
  });

  if (!reduce) {
    gsap.set(heroChars, { yPercent: 118, rotate: 7 });
    gsap.set('[data-hero-in]', { opacity: 0, y: 36 });
    gsap.set(petals, { scale: 0, opacity: 0 });
    gsap.set('[data-hero-media]', { scale: 1.22 });
    gsap.set('[data-branch]', { yPercent: 28 });
  }
  function heroIntro() {
    if (reduce) return;
    gsap.to(heroChars, { yPercent: 0, rotate: 0, duration: 1.6, ease: 'expo.out', stagger: .05 });
    gsap.to('[data-hero-in]', { opacity: 1, y: 0, duration: 1.3, ease: 'power3.out', stagger: .12, delay: .55 });
    gsap.to('[data-hero-media]', { scale: 1, duration: 2.8, ease: 'power3.out' });
    gsap.to(petals, { scale: 1, opacity: .92, duration: 1.5, ease: 'back.out(1.7)', stagger: .08, delay: .45 });
    gsap.to('[data-branch]', { yPercent: 0, duration: 1.8, ease: 'power3.out', delay: .3 });
    const mb = $('#mobilebar'); if (mb) setTimeout(() => mb.classList.add('is-on'), 1400);
  }
  if (reduce) { const mb = $('#mobilebar'); if (mb) mb.classList.add('is-on'); }

  if (!reduce) {
    gsap.to('[data-hero-media]', { yPercent: 8, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });
    $$('.hero__ring').forEach((r, i) => gsap.to(r, { y: (i ? -1 : 1) * 90, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } }));
    $$('[data-speed]').forEach(el => {
      const sp = parseFloat(el.dataset.speed);
      gsap.to(el, { y: () => -sp * (el.hasAttribute('data-branch') ? 110 : 150), ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true, invalidateOnRefresh: true } });
    });
    gsap.to('.hero__inner', { yPercent: -14, opacity: .1, ease: 'none', scrollTrigger: { trigger: hero, start: '35% top', end: 'bottom top', scrub: true } });
  }

  /* ------------------------------------------------------------------
     Loader : la porte de la boutique s'ouvre
     ------------------------------------------------------------------ */
  function runLoader() {
    const loader = $('#loader');
    if (!loader) return Promise.resolve();
    if (reduce) { loader.remove(); return Promise.resolve(); }
    return new Promise(resolve => {
      document.body.classList.add('is-loading');
      if (lenis) lenis.stop();
      const count = $('#loader-count'), bar = $('.loader__bar', loader), center = $('.loader__center', loader), disc = $('.disc', loader);
      const st = { v: 0 };
      const paint = () => { count.textContent = Math.round(st.v); bar.style.strokeDashoffset = (590.6 * (1 - st.v / 100)).toFixed(1); };
      gsap.set(center, { opacity: 0, scale: .9 });
      const poster = $('.hero__poster');
      const posterReady = new Promise(r => { if (!poster || poster.complete) r(); else { poster.addEventListener('load', r); poster.addEventListener('error', r); } });
      const minWait = new Promise(r => setTimeout(r, 1700));
      const ready = Promise.race([Promise.all([document.fonts ? document.fonts.ready : Promise.resolve(), posterReady, minWait]), new Promise(r => setTimeout(r, 5000))]);

      gsap.to(center, { opacity: 1, scale: 1, duration: .9, ease: 'power3.out' });
      gsap.to(disc, { rotation: 360, duration: 2.6, ease: 'power2.inOut' });
      gsap.to(st, { v: 88, duration: 1.9, ease: 'power2.out', onUpdate: paint });

      ready.then(() => {
        gsap.to(st, {
          v: 100, duration: .6, ease: 'power1.out', onUpdate: paint,
          onComplete: () => {
            const exit = gsap.timeline({ onComplete: () => { loader.remove(); document.body.classList.remove('is-loading'); if (lenis) lenis.start(); ScrollTrigger.refresh(); } });
            exit.to(center, { opacity: 0, scale: 1.18, duration: .6, ease: 'power2.in' })
              .to('.loader__door--l', { xPercent: -101, duration: 1.5, ease: 'expo.inOut' }, '-=.15')
              .to('.loader__door--r', { xPercent: 101, duration: 1.5, ease: 'expo.inOut' }, '<')
              .add(() => resolve(), '-=1.05');
          }
        });
      });
    });
  }

  /* ------------------------------------------------------------------
     Titres, textes et révélations au scroll
     ------------------------------------------------------------------ */
  if (!reduce) {
    $$('[data-split]').forEach(el => {
      const words = splitWords(el);
      gsap.set(words, { yPercent: 115 });
      ScrollTrigger.create({ trigger: el, start: 'top 87%', once: true, onEnter: () => gsap.to(words, { yPercent: 0, duration: 1.3, ease: 'expo.out', stagger: .06 }) });
    });
    const man = $('[data-manifesto]');
    if (man) {
      const words = splitSimple(man);
      gsap.set(words, { opacity: .13 });
      gsap.to(words, { opacity: 1, duration: .3, stagger: .1, ease: 'none', scrollTrigger: { trigger: man, start: 'top 84%', end: 'bottom 48%', scrub: true } });
    }
    $$('[data-reveal]').forEach(el => {
      gsap.set(el, { opacity: 0, y: 30 });
      ScrollTrigger.create({ trigger: el, start: 'top 91%', once: true, onEnter: () => gsap.to(el, { opacity: 1, y: 0, duration: 1.1, ease: 'power3.out' }) });
    });
    $$('[data-reveal-group]').forEach(g => {
      const kids = Array.from(g.children);
      gsap.set(kids, { opacity: 0, y: 30 });
      ScrollTrigger.create({ trigger: g, start: 'top 89%', once: true, onEnter: () => gsap.to(kids, { opacity: 1, y: 0, duration: 1, ease: 'power3.out', stagger: .12 }) });
    });
    $$('[data-circle-reveal]').forEach(el => {
      gsap.set(el, { clipPath: 'circle(0% at 50% 62%)' });
      ScrollTrigger.create({ trigger: el, start: 'top 82%', once: true, onEnter: () => gsap.to(el, { clipPath: 'circle(142% at 50% 62%)', duration: 1.9, ease: 'expo.out', onComplete: () => gsap.set(el, { clearProps: 'clipPath' }) }) });
    });
    $$('[data-curtain-reveal]').forEach(el => {
      gsap.set(el, { clipPath: 'inset(100% 0% 0% 0%)' });
      ScrollTrigger.create({ trigger: el, start: 'top 88%', once: true, onEnter: () => gsap.to(el, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.7, ease: 'expo.inOut', onComplete: () => gsap.set(el, { clearProps: 'clipPath' }) }) });
    });
    // images qui bougent dans leur cadre
    $$('.pimg').forEach(img => {
      gsap.fromTo(img, { yPercent: -5 }, { yPercent: 5, ease: 'none', scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } });
    });
    // badge rotatif
    const badge = $('#badge');
    if (badge) gsap.to(badge, { rotation: 360, ease: 'none', scrollTrigger: { trigger: '.intro', start: 'top bottom', end: 'bottom top', scrub: true } });
    // galerie : entrée en cascade
    $$('.g').forEach(g => gsap.from(g, { y: 90, opacity: 0, duration: 1.3, ease: 'power3.out', scrollTrigger: { trigger: g, start: 'top 94%', once: true } }));
    // CTA : fond en parallaxe
    gsap.fromTo('[data-cta-bg]', { yPercent: -8 }, { yPercent: 8, ease: 'none', scrollTrigger: { trigger: '.cta', start: 'top bottom', end: 'bottom top', scrub: true } });
    gsap.to('.cta__flower', { rotation: 200, y: -120, ease: 'none', scrollTrigger: { trigger: '.cta', start: 'top bottom', end: 'bottom top', scrub: true } });
    // pied de page : lettres géantes
    const fg = $('[data-footer-chars]');
    if (fg) {
      const chars = splitChars(fg, 'ch'); gsap.set(chars, { yPercent: 112 });
      ScrollTrigger.create({ trigger: '.footer__giant', start: 'top 96%', once: true, onEnter: () => gsap.to(chars, { yPercent: 0, duration: 1.5, ease: 'expo.out', stagger: .045 }) });
    }
    // pastilles des avis
    gsap.from('.topics__list li', { scale: .4, opacity: 0, y: 24, duration: .9, ease: 'back.out(1.8)', stagger: .07, scrollTrigger: { trigger: '.topics', start: 'top 86%', once: true } });
  }
  // téléphone du CTA : lettres qui se soulèvent au survol
  const telIn = $('[data-chars-hover]'); if (telIn) splitChars(telIn, 'c');

  /* ------------------------------------------------------------------
     Chiffres clés : compteurs
     ------------------------------------------------------------------ */
  $$('[data-count]').forEach(b => {
    const end = parseFloat(b.dataset.count), dec = +b.dataset.dec || 0;
    const fmt = v => v.toFixed(dec).replace('.', ',');
    if (reduce) { b.textContent = fmt(end); return; }
    const o = { v: 0 }; b.textContent = fmt(0);
    ScrollTrigger.create({ trigger: b, start: 'top 90%', once: true, onEnter: () => gsap.to(o, { v: end, duration: 2.6, ease: 'power3.out', onUpdate: () => { b.textContent = fmt(o.v); } }) });
  });

  /* ------------------------------------------------------------------
     Marquee : vitesse et direction pilotées par le scroll
     ------------------------------------------------------------------ */
  (function marquee() {
    const rows = $$('[data-marquee]');
    if (!rows.length || reduce) return;
    let vel = 0;
    if (lenis) lenis.on('scroll', e => { vel = e.velocity; });
    const S = rows.map(r => {
      const group = r.firstElementChild;
      let guard = 0; while (group.scrollWidth < innerWidth * 1.15 && guard++ < 4) group.innerHTML += group.innerHTML;
      r.appendChild(group.cloneNode(true));
      return { el: r, group, dir: +r.dataset.marquee, base: +r.dataset.base, x: 0, k: 1, w: group.offsetWidth };
    });
    const measure = () => S.forEach(s => { s.w = s.group.offsetWidth; });
    addEventListener('resize', measure);
    if (document.fonts) document.fonts.ready.then(measure);
    gsap.ticker.add((time, dt) => {
      S.forEach(s => {
        if (!s.w) return;
        const target = vel < -0.15 ? -1 : 1;
        s.k += (target - s.k) * .06;
        const speed = s.base + Math.min(Math.abs(vel) * 16, 520);
        s.x += s.dir * s.k * speed * dt / 1000;
        if (s.x <= -s.w) s.x += s.w;
        if (s.x > 0) s.x -= s.w;
        s.el.style.transform = 'translate3d(' + s.x.toFixed(2) + 'px,0,0)';
      });
    });
  })();

  /* ------------------------------------------------------------------
     Sections pinnées (desktop & mobile) / défilement horizontal (desktop)
     ------------------------------------------------------------------ */
  const mm = gsap.matchMedia();
  mm.add('(prefers-reduced-motion: no-preference)', () => {
    const story = $('.story'); if (!story) return;
    const steps = $$('.step', story), frames = $$('.sframe', story), n = steps.length;
    const line = $('#story-line'), num = $('#story-num');
    story.classList.add('is-pinned');
    gsap.set(steps.slice(1), { autoAlpha: 0, y: 50 });
    gsap.set(frames.slice(1), { clipPath: 'inset(100% 0% 0% 0%)' });
    frames.forEach((f, i) => gsap.set($('img', f), { scale: i === 0 ? 1.12 : 1.4 }));
    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: story, start: 'top top', end: () => '+=' + Math.round(innerHeight * (n * .95 + .3)),
        pin: true, scrub: .8, anticipatePin: 1, invalidateOnRefresh: true,
        onUpdate: self => { const i = Math.min(n - 1, Math.round(self.progress * (n - 1))); num.textContent = String(i + 1).padStart(2, '0'); }
      }
    });
    tl.to($('img', frames[0]), { scale: 1, duration: .6 });
    for (let i = 1; i < n; i++) {
      tl.to({}, { duration: .5 })
        .to(steps[i - 1], { autoAlpha: 0, y: -50, duration: .5 })
        .to(frames[i], { clipPath: 'inset(0% 0% 0% 0%)', duration: 1, ease: 'power2.inOut' }, '<')
        .to($('img', frames[i]), { scale: 1, duration: 1.15 }, '<')
        .to(steps[i], { autoAlpha: 1, y: 0, duration: .5 }, '<+=.5')
        .to(line, { scaleX: i / (n - 1), duration: 1 }, '<');
    }
    tl.to({}, { duration: .6 });
    return () => { story.classList.remove('is-pinned'); };
  });

  mm.add('(min-width: 900px) and (prefers-reduced-motion: no-preference)', () => {
    const sec = $('.services'), track = $('#serv-track'), prog = $('#serv-prog');
    if (!sec || !track) return;
    const dist = () => Math.max(0, track.scrollWidth - innerWidth);
    gsap.to(track, {
      x: () => -dist(), ease: 'none',
      scrollTrigger: { trigger: sec, start: 'top top', end: () => '+=' + dist(), pin: true, scrub: 1, anticipatePin: 1, invalidateOnRefresh: true, onUpdate: self => { prog.style.transform = 'scaleX(' + self.progress + ')'; } }
    });
    gsap.from('.services .card', { y: 70, opacity: 0, duration: 1.3, ease: 'power3.out', stagger: .09, scrollTrigger: { trigger: sec, start: 'top 75%', once: true } });
  });

  /* ------------------------------------------------------------------
     Micro-interactions : tilt 3D + reflet, boutons magnétiques, curseur
     ------------------------------------------------------------------ */
  if (fine && !reduce) {
    $$('.tilt').forEach(el => {
      const glare = $('.glare', el), max = el.classList.contains('card') ? 9 : 5;
      gsap.set(el, { transformPerspective: 900 });
      const rx = gsap.quickTo(el, 'rotationX', { duration: .6, ease: 'power3.out' });
      const ry = gsap.quickTo(el, 'rotationY', { duration: .6, ease: 'power3.out' });
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        ry((px - .5) * max * 2); rx(-(py - .5) * max * 2);
        if (glare) gsap.to(glare, { x: (px - .5) * r.width * .9, y: (py - .5) * r.height * .9, duration: .4, overwrite: 'auto' });
      });
      el.addEventListener('pointerleave', () => { rx(0); ry(0); if (glare) gsap.to(glare, { x: 0, y: 0, duration: .7 }); });
    });
    $$('.magnetic').forEach(btn => {
      const xTo = gsap.quickTo(btn, 'x', { duration: .6, ease: 'power3.out' }), yTo = gsap.quickTo(btn, 'y', { duration: .6, ease: 'power3.out' });
      btn.addEventListener('pointermove', e => { const r = btn.getBoundingClientRect(); xTo((e.clientX - r.left - r.width / 2) * .32); yTo((e.clientY - r.top - r.height / 2) * .32); });
      btn.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
    });
    const cur = $('#cursor');
    if (cur) {
      const lab = $('span', cur), xTo = gsap.quickTo(cur, 'x', { duration: .35, ease: 'power3.out' }), yTo = gsap.quickTo(cur, 'y', { duration: .35, ease: 'power3.out' });
      let shown = false;
      addEventListener('pointermove', e => {
        if (!shown) { gsap.set(cur, { x: e.clientX, y: e.clientY }); gsap.to(cur, { opacity: 1, duration: .4 }); shown = true; }
        xTo(e.clientX); yTo(e.clientY);
      });
      document.addEventListener('pointerover', e => {
        const t = e.target.closest && e.target.closest('[data-cursor]');
        if (t) { lab.textContent = t.dataset.cursor; cur.classList.add('is-label'); } else cur.classList.remove('is-label');
      });
      document.addEventListener('pointerleave', () => gsap.to(cur, { opacity: 0, duration: .3 }));
    }
  }

  /* ------------------------------------------------------------------
     Avis : paquet de cartes animé
     ------------------------------------------------------------------ */
  (function deck() {
    const el = $('#deck'); if (!el) return;
    const cards = $$('.rcard', el), n = cards.length, nEl = $('#rev-n');
    let idx = 0, timer = null, visible = false, hovering = false;
    const pose = d => {
      if (d === 0) return { xPercent: 0, y: 0, rotation: 0, scale: 1, opacity: 1, zIndex: 10 };
      if (d === 1) return { xPercent: 7, y: 20, rotation: 3.2, scale: .95, opacity: 1, zIndex: 9 };
      if (d === 2) return { xPercent: 12, y: 38, rotation: 6, scale: .9, opacity: .7, zIndex: 8 };
      if (d === n - 1) return { xPercent: -16, y: 8, rotation: -5, scale: .96, opacity: 0, zIndex: 7 };
      return { xPercent: 14, y: 52, rotation: 8, scale: .85, opacity: 0, zIndex: 1 };
    };
    const layout = animate => {
      cards.forEach((c, i) => {
        const d = (i - idx + n) % n, p = pose(d);
        if (animate && !reduce) gsap.to(c, Object.assign({ duration: 1.05, ease: 'power4.out', overwrite: true }, p)); else gsap.set(c, p);
        c.setAttribute('aria-hidden', d === 0 ? 'false' : 'true');
      });
      nEl.textContent = idx + 1;
    };
    const go = k => { idx = (k + n) % n; layout(true); };
    const start = () => { stop(); if (reduce) return; timer = setInterval(() => { if (visible && !hovering) go(idx + 1); }, 7500); };
    const stop = () => { if (timer) clearInterval(timer); timer = null; };
    layout(false);
    $('#rev-prev').addEventListener('click', () => { go(idx - 1); start(); });
    $('#rev-next').addEventListener('click', () => { go(idx + 1); start(); });
    el.addEventListener('keydown', e => { if (e.key === 'ArrowRight') { go(idx + 1); start(); } if (e.key === 'ArrowLeft') { go(idx - 1); start(); } });
    el.addEventListener('pointerenter', () => { hovering = true; });
    el.addEventListener('pointerleave', () => { hovering = false; });
    el.addEventListener('focusin', () => { hovering = true; });
    el.addEventListener('focusout', () => { hovering = false; });
    let sx = null;
    el.addEventListener('pointerdown', e => { sx = e.clientX; });
    addEventListener('pointerup', e => { if (sx === null) return; const dx = e.clientX - sx; sx = null; if (Math.abs(dx) > 50) { go(dx < 0 ? idx + 1 : idx - 1); start(); } });
    ScrollTrigger.create({ trigger: el, start: 'top 90%', end: 'bottom 10%', onToggle: s => { visible = s.isActive; } });
    start();
  })();

  /* ------------------------------------------------------------------
     Galerie : lightbox
     ------------------------------------------------------------------ */
  (function lightbox() {
    const dlg = $('#lightbox'); if (!dlg || !dlg.showModal) return;
    const btns = $$('.g__btn');
    const items = btns.map(b => { const im = $('img', b); return { src: im.getAttribute('src'), alt: im.alt, cap: $('figcaption', b).textContent }; });
    let i = 0;
    const show = k => { i = (k + items.length) % items.length; const it = items[i]; $('#lb-img').src = it.src; $('#lb-img').alt = it.alt; $('#lb-cap').textContent = it.cap; };
    btns.forEach((b, idx) => b.addEventListener('click', () => { show(idx); dlg.showModal(); if (lenis) lenis.stop(); }));
    $('#lb-close').addEventListener('click', () => dlg.close());
    $('#lb-prev').addEventListener('click', () => show(i - 1));
    $('#lb-next').addEventListener('click', () => show(i + 1));
    dlg.addEventListener('close', () => { if (lenis) lenis.start(); });
    dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener('keydown', e => { if (e.key === 'ArrowRight') show(i + 1); if (e.key === 'ArrowLeft') show(i - 1); });
  })();

  /* ------------------------------------------------------------------
     RÉSERVATION : assistant en 4 étapes → e-mail pré-rempli / .ics
     (aucun serveur : tout se passe dans le navigateur du visiteur)
     ------------------------------------------------------------------ */
  function initWizard() {
    const form = $('#wizard'); if (!form) return null;
    const panes = $$('.pane', form), bars = $$('.wizard__bar i', form);
    const titles = ['Pour quelle occasion\u00a0?', 'Quand et comment\u00a0?', 'Budget et coordonnées', 'Votre demande est prête'];
    const err = $('#w-error'), prev = $('#w-prev'), next = $('#w-next'), nEl = $('#w-n'), tEl = $('#w-title');
    const daysEl = $('#days'), slotsEl = $('#slots'), slotHint = $('#slot-hint');
    const state = { step: 1, date: null, time: null };
    const val = name => { const c = form.querySelector('[name="' + name + '"]:checked'); return c ? c.value : ''; };
    const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

    function buildDays() {
      const n = parisNow(); daysEl.innerHTML = '';
      for (let i = 0; i < 21; i++) {
        const d = new Date(Date.UTC(n.y, n.m - 1, n.d + i)), dow = d.getUTCDay(), c = SHOP.hours[dow][1];
        const lastStart = c - .5;
        const disabled = i === 0 && (n.h + n.min / 60 + 1 > lastStart);
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'day'; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', 'false');
        b.dataset.date = d.toISOString().slice(0, 10); b.dataset.dow = dow; b.dataset.today = i === 0 ? '1' : '';
        if (disabled) b.disabled = true;
        const wd = d.toLocaleDateString('fr-FR', { weekday: 'short', timeZone: 'UTC' }).replace('.', '');
        const mo = d.toLocaleDateString('fr-FR', { month: 'short', timeZone: 'UTC' }).replace('.', '');
        b.setAttribute('aria-label', d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }) + (dow === 0 ? ', le matin uniquement' : ''));
        b.innerHTML = '<small>' + (i === 0 ? 'auj.' : wd) + '</small><b>' + d.getUTCDate() + '</b><small>' + mo + '</small>' + (dow === 0 ? '<em>matin</em>' : '');
        daysEl.appendChild(b);
      }
    }
    function buildSlots(btn) {
      const dow = +btn.dataset.dow, today = btn.dataset.today === '1', n = parisNow(), nowT = n.h + n.min / 60;
      const [o, c] = SHOP.hours[dow]; slotsEl.innerHTML = '';
      const list = []; for (let t = o; t <= c - .5 + 1e-9; t += .5) { if (today && t < nowT + 1) continue; list.push(t); }
      if (!list.length) { slotsEl.innerHTML = '<p class="slots__empty">Plus de créneau ce jour-là : choisissez un autre jour.</p>'; return; }
      list.forEach(t => {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'slot'; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', 'false');
        const hh = Math.floor(t + 1e-9), mm = Math.round((t - hh) * 60); b.dataset.time = String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0'); b.textContent = fmtH(t);
        slotsEl.appendChild(b);
      });
    }
    buildDays();

    daysEl.addEventListener('click', e => {
      const b = e.target.closest('.day'); if (!b || b.disabled) return;
      $$('.day', daysEl).forEach(x => x.setAttribute('aria-checked', String(x === b)));
      state.date = b.dataset.date; state.time = null; buildSlots(b);
      slotHint.textContent = 'horaires de la boutique ce jour-là';
      clearError();
    });
    slotsEl.addEventListener('click', e => {
      const b = e.target.closest('.slot'); if (!b) return;
      $$('.slot', slotsEl).forEach(x => x.setAttribute('aria-checked', String(x === b)));
      state.time = b.dataset.time; clearError();
    });
    form.addEventListener('change', e => {
      if (e.target.name === 'mode') {
        const liv = val('mode') === 'livraison';
        $('#addr-field').hidden = !liv;
        $('#day-label').textContent = liv ? 'Quel jour de livraison\u00a0?' : 'Quel jour\u00a0?';
      }
      clearError();
    });

    function clearError() { err.textContent = ''; $$('[aria-invalid]', form).forEach(x => x.removeAttribute('aria-invalid')); }
    function fail(msg, focusEl) {
      err.textContent = msg;
      if (focusEl) { focusEl.setAttribute('aria-invalid', 'true'); focusEl.focus({ preventScroll: true }); }
      if (!reduce) { form.classList.remove('shake'); void form.offsetWidth; form.classList.add('shake'); }
    }
    function validate(step) {
      if (step === 1 && !val('occasion')) { fail('Choisissez une occasion pour continuer.'); return false; }
      if (step === 2) {
        if (val('mode') === 'livraison' && $('#addr').value.trim().length < 6) { fail('Indiquez l\u2019adresse de livraison.', $('#addr')); return false; }
        if (!state.date) { fail('Choisissez un jour.'); return false; }
        if (!state.time) { fail('Choisissez un créneau.'); return false; }
      }
      if (step === 3) {
        const name = $('#name'), tel = $('#tel'), mail = $('#mail');
        if (name.value.trim().length < 2) { fail('Indiquez votre nom pour que la boutique puisse vous répondre.', name); return false; }
        if (tel.value.replace(/\D/g, '').length < 10) { fail('Indiquez un numéro de téléphone valide (10 chiffres).', tel); return false; }
        if (mail.value.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail.value.trim())) { fail('Cette adresse e-mail ne semble pas valide.', mail); return false; }
      }
      return true;
    }

    const dateLabel = iso => { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }); };
    const timeLabel = t => t.replace(':', 'h');
    const read = () => ({
      occasion: val('occasion'), mode: val('mode') || 'retrait', addr: $('#addr').value.trim(), date: state.date, time: state.time,
      budget: val('budget'), styles: $$('[name="style"]:checked', form).map(x => x.value), note: $('#note').value.trim(),
      name: $('#name').value.trim(), tel: $('#tel').value.trim(), mail: $('#mail').value.trim()
    });
    function message(v) {
      const when = v.mode === 'livraison'
        ? '\u2022 Livraison souhaitée le ' + dateLabel(v.date) + ' vers ' + timeLabel(v.time)
        : '\u2022 Retrait en boutique le ' + dateLabel(v.date) + ' à ' + timeLabel(v.time);
      return [
        'Bonjour ' + SHOP.name + ',', '', 'Je souhaite réserver :',
        '\u2022 Occasion : ' + v.occasion, when,
        v.mode === 'livraison' ? '\u2022 Adresse de livraison : ' + v.addr : null,
        '\u2022 Budget : ' + v.budget,
        v.styles.length ? '\u2022 Style / couleurs : ' + v.styles.join(', ') : null,
        v.note ? '\u2022 Précisions : ' + v.note : null,
        '', 'Mes coordonnées : ' + v.name + ' \u00b7 ' + v.tel + (v.mail ? ' \u00b7 ' + v.mail : ''),
        '', 'Merci de me confirmer la disponibilité. Bonne journée\u00a0!'
      ].filter(l => l !== null).join('\n');
    }
    const subject = v => 'Demande de réservation \u2013 ' + v.occasion + ' \u2013 ' + dateLabel(v.date) + ' ' + timeLabel(v.time);
    function ics(v) {
      const [y, m, d] = v.date.split('-'), [hh, mm] = v.time.split(':'), pad = x => String(x).padStart(2, '0');
      const endMin = (+hh) * 60 + (+mm) + 30;
      const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
      const e = s => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
      return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Florales du midi//Reservation//FR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
        'UID:' + Date.now() + '@florales-du-midi', 'DTSTAMP:' + stamp, 'DTSTART:' + y + m + d + 'T' + hh + mm + '00', 'DTEND:' + y + m + d + 'T' + pad(Math.floor(endMin / 60)) + pad(endMin % 60) + '00',
        'SUMMARY:' + e(SHOP.name + ' \u00b7 ' + (v.mode === 'livraison' ? 'livraison' : 'retrait') + ' (' + v.occasion + ')'), 'LOCATION:' + e(SHOP.address),
        'DESCRIPTION:' + e(message(v) + '\n\nDemande à confirmer par la boutique : ' + SHOP.phoneDisplay),
        'BEGIN:VALARM', 'TRIGGER:-PT1H', 'ACTION:DISPLAY', 'DESCRIPTION:Rappel ' + e(SHOP.name), 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    }
    async function copyText(t) {
      try { await navigator.clipboard.writeText(t); return true; } catch (_) {
        const ta = document.createElement('textarea'); ta.value = t; ta.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(ta); ta.select();
        let ok = false; try { ok = document.execCommand('copy'); } catch (__) {} ta.remove(); return ok;
      }
    }

    function fillRecap() {
      const v = read(), msg = message(v);
      const rows = [
        ['Occasion', v.occasion],
        [v.mode === 'livraison' ? 'Livraison' : 'Retrait', dateLabel(v.date) + ' \u00b7 ' + timeLabel(v.time)],
        v.mode === 'livraison' ? ['Adresse', v.addr] : ['Lieu', SHOP.address],
        ['Budget', v.budget],
        v.styles.length ? ['Style', v.styles.join(', ')] : null,
        v.note ? ['Précisions', v.note] : null,
        ['Contact', v.name + ' \u00b7 ' + v.tel + (v.mail ? ' \u00b7 ' + v.mail : '')]
      ].filter(Boolean);
      $('#recap').innerHTML = '<dl>' + rows.map(r => '<div><dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd></div>').join('') + '</dl>';
      const sub = encodeURIComponent(subject(v)), body = encodeURIComponent(msg.replace(/\n/g, '\r\n'));
      $('#send-mail').href = 'mailto:' + SHOP.email + '?subject=' + sub + '&body=' + body;
      $('#send-gmail').href = 'https://mail.google.com/mail/?view=cm&fs=1&to=' + encodeURIComponent(SHOP.email) + '&su=' + sub + '&body=' + encodeURIComponent(msg);
      const sms = $('#send-sms');
      if (SHOP.smsNumber) { sms.hidden = false; sms.href = 'sms:' + SHOP.smsNumber + '?&body=' + encodeURIComponent(msg); } else sms.hidden = true;
      $('#send-ics').onclick = () => {
        const blob = new Blob([ics(v)], { type: 'text/calendar;charset=utf-8' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'florales-du-midi-reservation.ics';
        document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      };
      const cp = $('#send-copy');
      cp.onclick = async () => {
        const ok = await copyText(msg), old = cp.innerHTML;
        cp.textContent = ok ? 'Message copié \u2713' : 'Copie impossible'; setTimeout(() => { cp.innerHTML = old; }, 2200);
      };
    }

    function render() {
      panes.forEach((p, i) => { p.hidden = i !== state.step - 1; });
      bars.forEach((b, i) => b.classList.toggle('is-done', i < state.step));
      nEl.textContent = state.step; tEl.textContent = titles[state.step - 1];
      prev.hidden = state.step === 1; next.hidden = state.step === 4;
      next.firstChild.textContent = state.step === 3 ? 'Voir le récapitulatif ' : 'Continuer ';
      prev.textContent = state.step === 4 ? '\u2190 Modifier ma demande' : '\u2190 Retour';
      if (state.step === 4) fillRecap();
    }
    function go(to) {
      if (to === state.step) return;
      const from = panes[state.step - 1], dir = to > state.step ? 1 : -1;
      const swap = () => {
        state.step = to; render();
        const dest = panes[to - 1];
        if (!reduce) gsap.fromTo(dest, { x: 40 * dir, opacity: 0 }, { x: 0, opacity: 1, duration: .65, ease: 'power3.out', clearProps: 'transform,opacity' });
        tEl.focus({ preventScroll: true });
        requestAnimationFrame(() => ScrollTrigger.refresh());
      };
      if (reduce) swap(); else gsap.to(from, { x: -40 * dir, opacity: 0, duration: .28, ease: 'power2.in', onComplete: () => { gsap.set(from, { clearProps: 'transform,opacity' }); swap(); } });
    }
    next.addEventListener('click', () => { clearError(); if (validate(state.step)) go(state.step + 1); });
    prev.addEventListener('click', () => { clearError(); go(state.step - 1); });
    form.addEventListener('submit', e => e.preventDefault());
    form.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'radio' && e.target.type !== 'checkbox') { e.preventDefault(); next.click(); } });
    render();

    return {
      preselect(key) {
        const map = { bouquet: 'Bouquet du jour', composition: 'Composition sur mesure', plante: 'Plante ou orchidée', mariage: 'Mariage' };
        if (key === 'livraison') {
          const r = form.querySelector('[name="mode"][value="livraison"]'); r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true }));
          if (state.step !== 1 && state.step !== 2) go(1);
          return;
        }
        const r = Array.from(form.querySelectorAll('[name="occasion"]')).find(x => x.value === map[key]);
        if (r) { r.checked = true; if (state.step === 1) go(2); }
      }
    };
  }
  wiz = initWizard();

  /* ------------------------------------------------------------------
     Barre d'action mobile : se range devant la réservation et le pied de page
     ------------------------------------------------------------------ */
  (function mobilebar() {
    const mb = $('#mobilebar'); if (!mb) return;
    const io = new IntersectionObserver(es => {
      const any = es.some(e => e.isIntersecting) || mb.dataset.hid === '1';
      es.forEach(e => { e.target.dataset.vis = e.isIntersecting ? '1' : ''; });
      const hide = $$('#reserver,.footer,#trouver').some(t => t.dataset.vis === '1');
      mb.classList.toggle('is-off', hide);
    }, { threshold: .12 });
    $$('#reserver,.footer,#trouver').forEach(t => io.observe(t));
  })();

  /* ------------------------------------------------------------------
     Démarrage
     ------------------------------------------------------------------ */
  addEventListener('load', () => ScrollTrigger.refresh());
  if (document.fonts) document.fonts.ready.then(() => ScrollTrigger.refresh());
  runLoader().then(heroIntro);
})();

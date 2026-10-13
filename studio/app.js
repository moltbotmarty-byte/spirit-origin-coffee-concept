/* Local, independent concept. No checkout, tracking, or store mutations. */
(() => {
  'use strict';
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const catalog = {
    catuai: { name: 'Catuai', detail: 'Medium roast', image: 'catuai.webp' },
    espresso: { name: 'Espresso Blend', detail: 'Medium-dark roast', image: 'espresso.webp' },
    samples: { name: 'The Tasting Set', detail: 'Single-serve pour-over', image: 'samples.webp' }
  };
  let bag = {};
  try {
    const saved = JSON.parse(sessionStorage.getItem('spirit-demo-bag') || '{}');
    for (const key of Object.keys(catalog)) {
      if (Number.isInteger(saved[key]) && saved[key] > 0) bag[key] = Math.min(saved[key], 20);
    }
  } catch { /* Storage may be disabled. The in-memory bag still works. */ }
  const dialog = $('#bag');
  let toastTimer;
  function announce(message) {
    const toast = $('#toast');
    toast.textContent = message;
    toast.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('visible'), 2500);
  }
  function renderBag() {
    const count = Object.values(bag).reduce((a, b) => a + b, 0);
    $('.bag-count').textContent = count;
    $('.bag-trigger').setAttribute('aria-label', `Open demo bag, ${count} ${count === 1 ? 'item' : 'items'}`);
    $('#bag-items').innerHTML = Object.keys(bag).map(key => {
      const item = catalog[key];
      return `<article class="bag-item"><img src="assets/${item.image}" width="105" height="130" alt="${item.name} packaging"><div><h3>${item.name}</h3><p>${item.detail}</p><div class="quantity"><button data-quantity="${key}" data-delta="-1" aria-label="Decrease ${item.name} quantity">−</button><span aria-label="Quantity">${bag[key]}</span><button data-quantity="${key}" data-delta="1" aria-label="Increase ${item.name} quantity" ${bag[key] >= 20 ? 'disabled' : ''}>+</button><button class="remove" data-remove="${key}" aria-label="Remove ${item.name}">Remove</button></div></div></article>`;
    }).join('') || '<div class="empty-bag">Your next ritual starts here.<p>Explore the coffee, then add a favourite to this demo bag.</p></div>';
    $('#bag-summary').textContent = count ? `${count} ${count === 1 ? 'item' : 'items'} in your demo bag. No order placed.` : 'Your bag is empty.';
    try { sessionStorage.setItem('spirit-demo-bag', JSON.stringify(bag)); } catch { /* Session-only fallback. */ }
  }
  $$('[data-add]').forEach(button => button.addEventListener('click', () => {
    const key = button.dataset.add;
    if ((bag[key] || 0) >= 20) return announce('Demo limit: 20 of each coffee.');
    bag[key] = (bag[key] || 0) + 1;
    renderBag();
    announce(`${catalog[key].name} added to your demo bag`);
  }));
  $('.bag-trigger').addEventListener('click', () => dialog.showModal());
  $('#close-bag').addEventListener('click', () => dialog.close());
  dialog.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const controls = $$('button:not([disabled]),a[href]', dialog).filter(el => el.getClientRects().length);
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  dialog.addEventListener('click', event => {
    if (event.target === dialog && event.clientX < dialog.getBoundingClientRect().left) dialog.close();
    const control = event.target.closest('[data-quantity],[data-remove]');
    if (!control) return;
    const key = control.dataset.quantity || control.dataset.remove;
    const focusSelector = control.dataset.remove ? null : `[data-quantity="${key}"][data-delta="${control.dataset.delta}"]`;
    if (control.dataset.remove) delete bag[key];
    else { bag[key] += Number(control.dataset.delta); if (bag[key] <= 0) delete bag[key]; }
    renderBag();
    (focusSelector && $(focusSelector) || $('#close-bag')).focus();
  });
  renderBag();
  function filterCoffee(category) {
    $$('[data-filter]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.filter === category)));
    let count = 0;
    $$('.product').forEach(product => { product.hidden = category !== 'all' && product.dataset.category !== category; if (!product.hidden) count++; });
    $('.products').classList.toggle('filtered', category !== 'all');
    $('#filter-status').textContent = `Showing ${count} ${count === 1 ? 'coffee' : 'coffees'}`;
    if (window.ScrollTrigger) ScrollTrigger.refresh();
  }
  $$('[data-filter]').forEach(button => button.addEventListener('click', () => filterCoffee(button.dataset.filter)));
  const rituals = {
    filter: ['A little room to slow down.', 'Explore Catuai for your next filter brew. Grind fresh, follow your brewer’s recipe, and make the morning yours.', 'Explore filter coffee'],
    espresso: ['A small cup. Your whole attention.', 'Explore the Espresso Blend for your espresso ritual. Dial in your grind and follow your machine’s recipe.', 'Explore espresso coffee'],
    drip: ['Good coffee goes with you.', 'Explore single-serve pour-over coffee. Open the bag, rest it on your cup, and follow the instructions on the pack.', 'Explore on-the-go coffee']
  };
  let ritual = 'filter';
  $$('[data-brew]').forEach(button => button.addEventListener('click', () => {
    ritual = button.dataset.brew;
    $$('[data-brew]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    $('#brew-result h3').textContent = rituals[ritual][0];
    $('#brew-result p').textContent = rituals[ritual][1];
    $('#brew-shop').firstChild.textContent = rituals[ritual][2] + ' ';
  }));
  $('#brew-shop').addEventListener('click', () => {
    filterCoffee(ritual);
    $('#coffee').scrollIntoView({ behavior: 'instant' });
    $(`[data-filter="${ritual}"]`).focus({ preventScroll: true });
  });

  // Native scrolling; only the photographic timeline follows scroll progress.
  const screen = $('.roast-screen');
  const canvas = $('#roast-canvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  const toggle = $('#motion-toggle');
  const frames = new Map();
  let frame = 0, paused = false, loaded = false, active = false, timeline;
  const total = 114;
  const isMobile = matchMedia('(max-width: 767px)').matches;
  const step = isMobile ? 2 : 1;
  const paths = Array.from({ length: Math.ceil(total / step) }, (_, i) => Math.min(i * step, total - 1));
  const state = { progress: 0 };
  function draw(index) {
    if (!ctx || reduced.matches || paused) return;
    const target = Math.max(0, Math.min(total - 1, Math.round(index / step) * step));
    const image = frames.get(target);
    if (!image) return;
    const box = screen.getBoundingClientRect();
    const width = Math.min(box.width * Math.min(devicePixelRatio, 1.5), 1920);
    const height = width * box.height / box.width;
    if (canvas.width !== Math.round(width) || canvas.height !== Math.round(height)) {
      canvas.width = Math.round(width); canvas.height = Math.round(height);
    }
    const scale = Math.max(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight);
    const w = image.naturalWidth * scale, h = image.naturalHeight * scale;
    ctx.drawImage(image, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
    frame = target;
    canvas.dataset.frame = String(frame);
    screen.classList.add('ready');
  }
  function update() {
    if (paused || reduced.matches) return;
    draw(state.progress * (total - 1));
    $('.film-progress span').style.transform = `scaleX(${state.progress})`;
    const late = state.progress > 0.56;
    const title = late ? 'ROASTED HERE.\nROOTED HERE.' : 'NOT JUST\nFROM HONDURAS.';
    if ($('#roast-title').textContent !== title) $('#roast-title').textContent = title;
    $('.roast-line').textContent = late ? 'The origin stays part of the story.' : 'Roasted in Honduras, too.';
  }
  async function loadFrames() {
    if (loaded || reduced.matches || !ctx) return;
    loaded = true;
    let cursor = 0, failures = 0;
    screen.setAttribute('aria-busy', 'true');
    const worker = async () => {
      while (cursor < paths.length) {
        const index = paths[cursor++];
        const image = new Image();
        image.src = `assets/roast/${String(index + 1).padStart(3, '0')}.webp`;
        try { await image.decode(); frames.set(index, image); if (index === 0 || Math.abs(frame - index) <= step) update(); }
        catch { failures++; }
      }
    };
    await Promise.all(Array.from({ length: 4 }, worker));
    screen.setAttribute('aria-busy', 'false');
    canvas.dataset.loaded = String(frames.size);
    canvas.dataset.failed = String(failures);
    if (!frames.size) {
      $('.film-note').textContent = 'Motion unavailable. A still from the roastery is shown.';
      toggle.disabled = true;
    } else update();
  }
  function configureMotion() {
    if (timeline) { timeline.scrollTrigger?.kill(); timeline.kill(); timeline = undefined; }
    screen.classList.toggle('motion-reduced', reduced.matches);
    if (reduced.matches) {
      toggle.textContent = 'Motion off'; toggle.disabled = true;
      toggle.setAttribute('aria-pressed', 'true');
      $('#roast-title').textContent = 'ROASTED IN\nHONDURAS.';
      return;
    }
    toggle.disabled = false;
    toggle.textContent = paused ? 'Resume motion' : 'Pause motion';
    toggle.setAttribute('aria-pressed', String(paused));
    if (window.gsap && window.ScrollTrigger) {
      gsap.registerPlugin(ScrollTrigger);
      timeline = gsap.to(state, {
        progress: 1, ease: 'none', onUpdate: update,
        scrollTrigger: { trigger: '#roast', start: 'top top', end: 'bottom bottom', scrub: 0.18, invalidateOnRefresh: true }
      });
      if (active) loadFrames();
    } else {
      $('.film-note').textContent = 'A still from the Spirit Origin roastery';
      toggle.hidden = true;
      screen.parentElement.style.height = 'auto';
    }
  }
  toggle.addEventListener('click', () => {
    paused = !paused;
    toggle.textContent = paused ? 'Resume motion' : 'Pause motion';
    toggle.setAttribute('aria-pressed', String(paused));
    if (!paused) update();
  });
  new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) { active = true; loadFrames(); }
  }, { rootMargin: '800px' }).observe(screen.parentElement);
  new ResizeObserver(() => draw(frame)).observe(screen);
  reduced.addEventListener('change', configureMotion);
  configureMotion();
  // A modest, reversible product exit connects the opening to the roastery.
  if (window.gsap) {
    gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
      gsap.to('.hero-product', { yPercent: 12, rotation: 5, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 0.2 } });
    });
  }
})();

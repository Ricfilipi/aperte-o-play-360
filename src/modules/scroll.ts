import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import Lenis from 'lenis';

import { PRODUCTS, productArt } from '../data/products';
import { tierButtons } from './quote';
import type { Background } from '../gl/Background';

gsap.registerPlugin(ScrollTrigger, SplitText);

export function initScroll(bg: Background, repaintHero: () => void) {
  /* ---------- Lenis, driven by GSAP's ticker ---------- */

  const lenis = new Lenis({
    duration: 1.15,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
  });

  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const target = document.querySelector(a.getAttribute('href')!);
      if (!target) return;
      e.preventDefault();
      lenis.scrollTo(target as HTMLElement, { offset: 0 });
    });
  });

  /* ---------- progress rail ---------- */

  gsap.to('#scrollRail', {
    scaleY: 1,
    ease: 'none',
    scrollTrigger: { trigger: document.body, start: 'top top', end: 'bottom bottom', scrub: 0.3 },
  });

  /* ---------- marquee: right-to-left drift + scroll-velocity boost ---------- */

  const track = document.getElementById('marquee');
  const group = track?.firstElementChild as HTMLElement | null;
  if (track && group) {
    const SPEED = 100; // px per second

    let loop: gsap.core.Tween | null = null;

    const build = () => {
      loop?.kill();
      gsap.set(track, { x: 0, skewX: 0 });
      while (track.children.length > 1) track.lastElementChild!.remove();

      /* a group plus the gap that follows it: slide exactly that far and the
         next copy lands where this one started, so the loop never jumps */
      const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
      const step = group.getBoundingClientRect().width + gap;
      const copies = Math.max(2, Math.ceil((window.innerWidth + step) / step) + 1);
      for (let i = 1; i < copies; i++) track.appendChild(group.cloneNode(true));

      loop = gsap.to(track, { x: -step, duration: step / SPEED, ease: 'none', repeat: -1 });
    };

    build();
    /* the strip is sized from the font, so rebuild once the webfont lands
       and whenever the viewport changes width */
    document.fonts?.ready.then(build);
    let resizeTimer = 0;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(build, 200);
    });

    ScrollTrigger.create({
      trigger: '.marquee',
      start: 'top bottom',
      end: 'bottom top',
      onUpdate: (self) => {
        const v = gsap.utils.clamp(-4, 4, self.getVelocity() / 320);
        loop?.timeScale(1 + Math.abs(v));
        /* 'auto' and not true: a blanket overwrite would kill the drift
           tween on this same element the first time the strip scrolls by */
        gsap.to(track, { skewX: -v * 1.6, duration: 0.5, ease: 'power3', overwrite: 'auto' });
      },
    });
  }

  /* ---------- headings split and rise ---------- */

  document.querySelectorAll<HTMLElement>('[data-split]').forEach((el) => {
    if (el.closest('.hero')) return; // the hero headline is owned by the intro
    const split = SplitText.create(el, { type: 'lines,chars', mask: 'lines', linesClass: 'line' });
    gsap.from(split.chars, {
      yPercent: 118,
      rotate: 4,
      duration: 1,
      ease: 'expo.out',
      stagger: 0.016,
      scrollTrigger: { trigger: el, start: 'top 82%' },
    });
  });

  document.querySelectorAll<HTMLElement>('[data-reveal]').forEach((el) => {
    gsap.from(el, {
      y: 26,
      autoAlpha: 0,
      duration: 0.9,
      ease: 'expo.out',
      scrollTrigger: { trigger: el, start: 'top 88%' },
    });
  });

  /* ---------- COMO FUNCIONA: pinned, the product turns as you scroll ---------- */

  const craftArt = document.getElementById('craftArt');
  if (craftArt) {
    const hero = PRODUCTS.find((p) => p.id === 'piscina-de-bolinhas') ?? PRODUCTS[0];
    craftArt.innerHTML = `<div class="product">${productArt(hero)}</div>`;

    if (matchMedia('(min-width: 981px)').matches) {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: '.craft',
          start: 'top top',
          end: '+=140%',
          pin: '.craft-pin',
          scrub: 0.6,
        },
      });

      tl.fromTo(
        craftArt,
        { scale: 0.86, rotate: -8, yPercent: 6 },
        { scale: 1.08, rotate: 6, yPercent: -6, ease: 'none' },
        0,
      );

      /* the copy reveals on its own trigger — scrubbing it would leave the
         list invisible whenever the reader pauses at the top of the pin */
      gsap.from('[data-spec]', {
        y: 40, autoAlpha: 0, duration: 0.9, stagger: 0.12, ease: 'expo.out',
        scrollTrigger: { trigger: '.craft', start: 'top 65%' },
      });
    } else {
      gsap.from('[data-spec]', {
        y: 30, autoAlpha: 0, stagger: 0.12, ease: 'power2.out',
        scrollTrigger: { trigger: '.specs', start: 'top 85%' },
      });
    }
  }

  /* ---------- CATÁLOGO: vertical scroll drives a horizontal track ---------- */

  const cwTrack = document.getElementById('colorwaysTrack');
  if (cwTrack) {
    cwTrack.innerHTML = PRODUCTS.map(
      (p) => `
      <article class="swatch">
        <div class="product">${productArt(p)}</div>
        <p class="swatch-name">${p.name}</p>
        <div class="swatch-tiers">${tierButtons(p)}</div>
      </article>`,
    ).join('');

    if (matchMedia('(min-width: 981px)').matches) {
      const distance = () => cwTrack.scrollWidth - innerWidth + 120;

      gsap.to(cwTrack, {
        x: () => -distance(),
        ease: 'none',
        scrollTrigger: {
          trigger: '.colorways',
          start: 'top top',
          end: () => `+=${distance()}`,
          pin: '.colorways-pin',
          scrub: 0.7,
          invalidateOnRefresh: true,
        },
      });

      gsap.from('.swatch', {
        y: 60, autoAlpha: 0, stagger: 0.1, duration: 0.9, ease: 'expo.out',
        scrollTrigger: { trigger: '.colorways', start: 'top 60%' },
      });
    }
  }

  /* ---------- each section repaints the shader ----------
     Driven by ScrollTrigger's own start/end, which already account for the
     pin spacers that shift every neighbour's position. */

  let painted = '';

  const paint = (id: string) => {
    if (id === painted) return;
    painted = id;
    document.body.dataset.palette = id;

    if (id === 'hero') { repaintHero(); return; }
    const p = PRODUCTS.find((x) => x.id === id);
    if (!p) return;
    gsap.to(bg.core, { r: p.core[0], g: p.core[1], b: p.core[2], duration: 1.2, ease: 'power2.inOut' });
    gsap.to(bg.edge, { r: p.edge[0], g: p.edge[1], b: p.edge[2], duration: 1.2, ease: 'power2.inOut' });
    gsap.to(bg.glow, { r: p.glow[0], g: p.glow[1], b: p.glow[2], duration: 1.2, ease: 'power2.inOut' });
  };

  document.querySelectorAll<HTMLElement>('[data-theme-section]').forEach((section) => {
    const id = section.dataset.theme ?? 'hero';
    ScrollTrigger.create({
      trigger: section,
      start: 'top 60%',
      end: 'bottom 40%',
      onToggle: (self) => { if (self.isActive) paint(id); },
    });
  });

  paint('hero');

  addEventListener('resize', () => ScrollTrigger.refresh());
  return lenis;
}

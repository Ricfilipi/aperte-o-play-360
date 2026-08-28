import gsap from 'gsap';
import { CustomEase } from 'gsap/CustomEase';
import { SplitText } from 'gsap/SplitText';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import './styles/main.css';

import { PRODUCTS } from './data/products';
import { Background } from './gl/Background';
import { Hero } from './modules/hero';
import { initScroll } from './modules/scroll';
import { initCursor, initMagnetic } from './modules/cursor';
import { initQuote } from './modules/quote';

gsap.registerPlugin(CustomEase, SplitText, ScrollTrigger);

/* signature easing: a firm launch with a long settle */
CustomEase.create('hop', 'M0,0 C0.16,0.9 0.2,1 1,1');

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

function boot() {
  const canvas = document.getElementById('gl') as HTMLCanvasElement;
  const bg = new Background(canvas, PRODUCTS[0]);
  initQuote();
  const hero = new Hero(bg);

  initCursor();
  initMagnetic();

  const repaintHero = () => {
    const p = PRODUCTS[hero.currentIndex];
    gsap.to(bg.core, { r: p.core[0], g: p.core[1], b: p.core[2], duration: 1.2, ease: 'power2.inOut' });
    gsap.to(bg.edge, { r: p.edge[0], g: p.edge[1], b: p.edge[2], duration: 1.2, ease: 'power2.inOut' });
    gsap.to(bg.glow, { r: p.glow[0], g: p.glow[1], b: p.glow[2], duration: 1.2, ease: 'power2.inOut' });
  };

  initScroll(bg, repaintHero);

  if (reduced) {
    bg.state.reveal = 1;
    document.body.classList.remove('is-loading');
    gsap.set('#preloader', { display: 'none' });
    hero.restart();
    return;
  }

  playIntro(bg, hero);
}

function playIntro(bg: Background, hero: Hero) {
  const headline = document.querySelector<HTMLElement>('.hero [data-split]')!;
  const lede = document.querySelector<HTMLElement>('[data-split-lines]')!;

  const h = SplitText.create(headline, { type: 'lines,chars', mask: 'lines', linesClass: 'line' });
  const l = SplitText.create(lede, { type: 'lines', mask: 'lines', linesClass: 'line' });

  const product = hero.current;

  gsap.set([h.chars, l.lines], { yPercent: 118 });
  gsap.set('.arrow, .cta, .product-name, .tiers, .price, .price-note, .rail-slot, .socials a, .dots button, .logo, .nav li, .icon-btn, .quote-pill', {
    autoAlpha: 0,
  });
  gsap.set(product, { autoAlpha: 0 });

  const tl = gsap.timeline({
    defaults: { ease: 'hop' },
    onComplete: () => {
      document.body.classList.remove('is-loading');
      hero.restart();
      ScrollTrigger.refresh();
    },
  });

  /* ── preloader ── */
  tl.to('.preloader-bar i', { scaleX: 1, duration: 1.0, ease: 'power2.inOut' })
    .to('.preloader-word', { yPercent: -120, autoAlpha: 0, duration: 0.7 }, '-=0.15')
    .to('.preloader-bar', { autoAlpha: 0, duration: 0.4 }, '<')
    .to('#preloader', { yPercent: -100, duration: 1.0, ease: 'expo.inOut' }, '-=0.3')
    .set('#preloader', { display: 'none' });

  /* ── the world fades up ── */
  tl.to(bg.state, { reveal: 1, duration: 1.4, ease: 'power2.out' }, '-=0.8');

  /* ── the product arrives ── */
  tl.fromTo(
    product,
    { autoAlpha: 0, scale: 0.6, yPercent: 16, rotateX: -26, rotate: -6, filter: 'blur(14px)' },
    { autoAlpha: 1, scale: 1, yPercent: 0, rotateX: 0, rotate: 0, filter: 'blur(0px)', duration: 1.5 },
    '-=1.1',
  );

  /* ── copy ── */
  tl.to(h.chars, { yPercent: 0, duration: 1.1, stagger: 0.022 }, '-=1.25')
    .to(l.lines, { yPercent: 0, duration: 0.9, stagger: 0.08 }, '-=0.85')
    .to('.arrow', { autoAlpha: 1, duration: 0.5, stagger: 0.07 }, '-=0.9')
    .to('.cta', { autoAlpha: 1, duration: 0.6 }, '-=0.6');

  /* ── chrome ── */
  tl.to('.logo', { autoAlpha: 1, duration: 0.5 }, '-=1.3')
    .to('.nav li', { autoAlpha: 1, duration: 0.5, stagger: 0.06 }, '<')
    .to(['.quote-pill', '.icon-btn'], { autoAlpha: 1, duration: 0.5, stagger: 0.06 }, '<+0.1');

  /* ── price column ── */
  tl.to('.product-name', { autoAlpha: 1, duration: 0.5 }, '-=1.0')
    .to(['.tiers', '.price'], { autoAlpha: 1, duration: 0.6, stagger: 0.08 }, '<+0.05')
    .to('.price-note', { autoAlpha: 1, duration: 0.5 }, '<+0.15');

  /* ── the rest of the stage ── */
  tl.to('.rail-slot', { autoAlpha: 1, duration: 0.6, stagger: 0.09 }, '-=0.9')
    .to('.socials a', { autoAlpha: 1, duration: 0.5, stagger: 0.06 }, '<+0.1')
    .to('.dots button', { autoAlpha: 1, duration: 0.4, stagger: 0.05 }, '<');

  return tl;
}

/* wait for webfonts so SplitText measures the real glyphs */
if (document.fonts) {
  document.fonts.ready.then(boot, boot);
} else {
  boot();
}

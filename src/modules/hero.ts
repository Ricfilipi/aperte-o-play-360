import gsap from 'gsap';
import { Flip } from 'gsap/Flip';
import { Observer } from 'gsap/Observer';
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin';

import { PRODUCTS, productArt, priceLabel } from '../data/products';
import { addToQuote } from './quote';
import type { Background } from '../gl/Background';

gsap.registerPlugin(Flip, Observer, ScrambleTextPlugin);

const DWELL = 4200;
/** opacity per rail position — index 0 is the hero slot */
const SLOT_OPACITY = [1, 1, 0.5, 0.24];

export class Hero {
  private cards: HTMLDivElement[] = [];
  private slots: HTMLElement[] = [];
  private dots: HTMLButtonElement[] = [];
  private index = 0;
  private busy = false;
  private timer = 0;
  private paused = false;

  private nameEl = document.getElementById('productName')!;
  private priceEl = document.getElementById('price')!;
  private noteEl = document.getElementById('priceNote')!;
  private tiersEl = document.getElementById('tiers')!;
  private heroSlot = document.getElementById('heroSlot')!;
  /** duração escolhida por produto */
  private tierOf = new Map<string, number>();

  constructor(private bg: Background) {
    const rail = document.getElementById('rail')!;
    this.slots = [this.heroSlot, ...Array.from(rail.querySelectorAll<HTMLElement>('.rail-slot'))];

    /* one element per product, reused forever — that is what lets Flip treat
       the rail thumbnail and the hero product as the same object */
    PRODUCTS.forEach((p) => {
      const el = document.createElement('div');
      el.className = 'product';
      el.dataset.id = p.id;
      el.innerHTML = productArt(p);
      this.cards.push(el);
    });

    this.buildDots();
    this.place();
    this.bindControls();
    this.bindTilt();
    this.bindDrag();
    this.bindBuy();
    this.renderBuy();
  }

  /* ---------- layout ---------- */

  /** puts each product in the slot its position dictates */
  private place() {
    for (let k = 0; k < this.slots.length; k++) {
      const el = this.cards[(this.index + k) % this.cards.length];
      this.slots[k].appendChild(el);
      el.style.opacity = String(SLOT_OPACITY[k]);
    }
  }

  private buildDots() {
    const box = document.getElementById('dots')!;
    PRODUCTS.forEach((p, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', p.name);
      b.addEventListener('click', () => this.to(i));
      box.appendChild(b);
      this.dots.push(b);
    });
    this.markDots();
  }

  private markDots() {
    this.dots.forEach((d, i) => d.classList.toggle('is-active', i === this.index));
  }

  /* ---------- the transition ---------- */

  to(target: number, dir = 1) {
    if (this.busy || target === this.index) return;
    this.busy = true;

    const outgoing = this.cards[this.index];
    const incoming = this.cards[target];
    const p = PRODUCTS[target];

    /* 1 — remember where every product currently sits */
    const state = Flip.getState(this.cards, { props: 'opacity' });

    /* 2 — mutate the DOM into its next arrangement */
    this.index = target;
    this.place();

    /* 3 — let Flip interpolate every element between the two layouts */
    const flip = Flip.from(state, {
      duration: 1.05,
      ease: 'expo.inOut',
      absolute: true,
      scale: true,
      stagger: 0.035,
      onComplete: () => { this.busy = false; },
    });

    /* 4 — flourishes layered on top of the Flip */
    const tl = gsap.timeline();

    tl.fromTo(
      incoming,
      { rotate: dir * 12, filter: 'blur(8px) brightness(1.5)' },
      { rotate: 0, filter: 'blur(0px) brightness(1)', duration: 1.05, ease: 'expo.out' },
      0,
    );

    tl.fromTo(
      outgoing,
      { rotate: 0 },
      { rotate: dir * -16, duration: 1.05, ease: 'expo.inOut' },
      0,
    );

    /* 5 — the backdrop shader morphs to the new palette */
    gsap.to(this.bg.core, { r: p.core[0], g: p.core[1], b: p.core[2], duration: 1.1, ease: 'power2.inOut' });
    gsap.to(this.bg.edge, { r: p.edge[0], g: p.edge[1], b: p.edge[2], duration: 1.1, ease: 'power2.inOut' });
    gsap.to(this.bg.glow, { r: p.glow[0], g: p.glow[1], b: p.glow[2], duration: 1.1, ease: 'power2.inOut' });
    gsap.fromTo(this.bg.state, { pulse: 0 }, { pulse: 1, duration: 0.35, yoyo: true, repeat: 1, ease: 'power2.out' });

    /* 6 — the name scrambles into place, the price counts over */
    gsap.to(this.nameEl, {
      duration: 0.9,
      scrambleText: { text: p.name, chars: 'upperAndLowerCase', speed: 0.5, revealDelay: 0.15 },
    });
    this.renderBuy();
    gsap.fromTo(
      [this.tiersEl, this.priceEl, this.noteEl],
      { yPercent: 40, autoAlpha: 0 },
      { yPercent: 0, autoAlpha: 1, duration: 0.6, stagger: 0.06, ease: 'expo.out' },
    );

    this.markDots();
    this.restart();
    return flip;
  }

  /** coluna de preço: duração escolhida, valor e botão de adicionar */
  private renderBuy() {
    const p = PRODUCTS[this.index];
    const chosen = this.tierOf.get(p.id) ?? 0;

    this.tiersEl.innerHTML =
      p.tiers.length > 1
        ? p.tiers
            .map(
              (t, i) =>
                `<button class="tier${i === chosen ? ' is-active' : ''}" type="button" data-tier-pick="${i}">${t.label}</button>`,
            )
            .join('')
        : '';

    this.priceEl.textContent = priceLabel(p.tiers[chosen]);
    this.noteEl.innerHTML =
      `${p.tiers[chosen].label} · montagem inclusa` +
      `<button class="add-cta" type="button" id="heroAdd">Adicionar ao orçamento</button>`;
  }

  private bindBuy() {
    this.tiersEl.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-tier-pick]');
      if (!btn) return;
      this.tierOf.set(PRODUCTS[this.index].id, Number(btn.dataset.tierPick));
      this.renderBuy();
      gsap.fromTo(this.priceEl, { yPercent: 30, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 0.45, ease: 'expo.out' });
    });

    this.noteEl.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('#heroAdd');
      if (!btn) return;
      const p = PRODUCTS[this.index];
      addToQuote(p, this.tierOf.get(p.id) ?? 0, btn);
    });
  }

  next = () => this.to((this.index + 1) % PRODUCTS.length, 1);
  prev = () => this.to((this.index - 1 + PRODUCTS.length) % PRODUCTS.length, -1);

  /* ---------- input ---------- */

  private bindControls() {
    document.getElementById('next')!.addEventListener('click', this.next);
    document.getElementById('prev')!.addEventListener('click', this.prev);

    this.slots.slice(1).forEach((slot, k) => {
      slot.addEventListener('click', () => this.to((this.index + 1 + k) % PRODUCTS.length, 1));
    });

    addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') this.next();
      if (e.key === 'ArrowLeft') this.prev();
    });

    const hero = document.getElementById('hero')!;
    hero.addEventListener('pointerenter', () => { this.paused = true; });
    hero.addEventListener('pointerleave', () => { this.paused = false; });
    document.addEventListener('visibilitychange', () => { this.paused = document.hidden; });
  }

  /** the product leans toward the pointer in real 3D */
  private bindTilt() {
    if (matchMedia('(pointer: coarse)').matches) return;
    const rotY = gsap.quickTo(this.heroSlot, 'rotationY', { duration: 0.9, ease: 'power3' });
    const rotX = gsap.quickTo(this.heroSlot, 'rotationX', { duration: 0.9, ease: 'power3' });

    addEventListener(
      'pointermove',
      (e) => {
        if (this.busy) return;
        rotY((e.clientX / innerWidth - 0.5) * 20);
        rotX(-(e.clientY / innerHeight - 0.5) * 12);
      },
      { passive: true },
    );
  }

  /** flick the product left or right to change */
  private bindDrag() {
    let startIndex = 0;

    Observer.create({
      target: this.heroSlot,
      type: 'touch,pointer',
      dragMinimum: 6,
      onPress: () => {
        this.paused = true;
        startIndex = this.index;
      },
      onDrag: (self) => {
        if (this.busy) return;
        gsap.set(this.cards[startIndex], { x: ((self.x ?? 0) - (self.startX ?? 0)) * 0.35 });
      },
      onDragEnd: (self) => {
        const dx = (self.x ?? 0) - (self.startX ?? 0);
        gsap.to(this.cards[startIndex], { x: 0, duration: 0.7, ease: 'elastic.out(1, 0.5)' });
        if (dx < -70) this.next();
        else if (dx > 70) this.prev();
        this.paused = false;
      },
    });
  }

  /* ---------- autoplay ---------- */

  restart() {
    clearInterval(this.timer);
    this.timer = window.setInterval(() => {
      if (!this.paused && !this.busy) this.next();
    }, DWELL);
  }

  get current() { return this.cards[this.index]; }
  get currentIndex() { return this.index; }
}

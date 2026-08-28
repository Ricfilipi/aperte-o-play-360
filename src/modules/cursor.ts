import gsap from 'gsap';

/* Custom cursor: a dot that tracks 1:1 and a ring that trails, swelling
   into a labelled disc over anything carrying `data-cursor`. */

export function initCursor() {
  const root = document.getElementById('cursor');
  if (!root || matchMedia('(pointer: coarse)').matches) return;

  const dot = root.querySelector<HTMLElement>('.cursor-dot')!;
  const ring = root.querySelector<HTMLElement>('.cursor-ring')!;
  const label = root.querySelector<HTMLElement>('.cursor-label')!;

  gsap.set(root, { xPercent: 0, yPercent: 0 });

  const dotX = gsap.quickTo(dot, 'x', { duration: 0.12, ease: 'power3' });
  const dotY = gsap.quickTo(dot, 'y', { duration: 0.12, ease: 'power3' });
  const ringX = gsap.quickTo(ring, 'x', { duration: 0.55, ease: 'power3' });
  const ringY = gsap.quickTo(ring, 'y', { duration: 0.55, ease: 'power3' });
  const labX = gsap.quickTo(label, 'x', { duration: 0.55, ease: 'power3' });
  const labY = gsap.quickTo(label, 'y', { duration: 0.55, ease: 'power3' });

  addEventListener(
    'pointermove',
    (e) => {
      dotX(e.clientX); dotY(e.clientY);
      ringX(e.clientX); ringY(e.clientY);
      labX(e.clientX); labY(e.clientY);
    },
    { passive: true },
  );

  const grow = (text: string) => {
    gsap.to(ring, { width: 76, height: 76, borderColor: 'rgba(255,255,255,.9)', duration: 0.4, ease: 'power3' });
    gsap.to(dot, { scale: 0, duration: 0.3, ease: 'power3' });
    label.textContent = text;
    gsap.to(label, { opacity: 1, duration: 0.3 });
  };

  const shrink = () => {
    gsap.to(ring, { width: 38, height: 38, borderColor: 'rgba(255,255,255,.55)', duration: 0.4, ease: 'power3' });
    gsap.to(dot, { scale: 1, duration: 0.3, ease: 'power3' });
    gsap.to(label, { opacity: 0, duration: 0.2 });
  };

  document.querySelectorAll<HTMLElement>('[data-cursor]').forEach((el) => {
    el.addEventListener('pointerenter', () => grow(el.dataset.cursor || ''));
    el.addEventListener('pointerleave', shrink);
  });
}

/* Buttons that lean toward the pointer, then spring back. */
export function initMagnetic() {
  if (matchMedia('(pointer: coarse)').matches) return;

  document.querySelectorAll<HTMLElement>('[data-magnetic]').forEach((el) => {
    const xTo = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'elastic.out(1, 0.4)' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'elastic.out(1, 0.4)' });

    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const strength = Math.min(r.width, r.height) > 120 ? 0.18 : 0.38;
      xTo((e.clientX - (r.left + r.width / 2)) * strength);
      yTo((e.clientY - (r.top + r.height / 2)) * strength);
    });

    el.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
  });

  /* the pill button fills from the bottom on hover */
  document.querySelectorAll<HTMLElement>('.cta').forEach((cta) => {
    const fill = cta.querySelector('.cta-fill');
    if (!fill) return;
    cta.addEventListener('pointerenter', () => {
      cta.classList.add('is-hot');
      gsap.fromTo(fill, { scaleY: 0, transformOrigin: '50% 100%' }, { scaleY: 1, duration: 0.45, ease: 'power3.out' });
    });
    cta.addEventListener('pointerleave', () => {
      cta.classList.remove('is-hot');
      gsap.to(fill, { scaleY: 0, transformOrigin: '50% 0%', duration: 0.4, ease: 'power3.in' });
    });
  });
}

import gsap from 'gsap';
import { PRODUCTS, WHATSAPP, brl, priceLabel } from '../data/products';
import type { Product, Tier } from '../data/products';

/* ------------------------------------------------------------------
   Lista de orçamento.

   Não é carrinho: nada é cobrado aqui. A pessoa escolhe os itens, o site
   monta a lista com o total e manda tudo por WhatsApp. O estado vive em
   localStorage para sobreviver a um refresh.
   ------------------------------------------------------------------ */

interface Line {
  productId: string;
  tierIndex: number;
  qty: number;
}

const STORAGE = 'festa-masters:orcamento';

let lines: Line[] = [];

const el = {
  pill: null as HTMLButtonElement | null,
  count: null as HTMLElement | null,
  drawer: null as HTMLElement | null,
  list: null as HTMLElement | null,
  total: null as HTMLElement | null,
  note: null as HTMLElement | null,
  send: null as HTMLAnchorElement | null,
  empty: null as HTMLElement | null,
};

const find = (id: string) => PRODUCTS.find((p) => p.id === id);

function load() {
  try {
    const raw = localStorage.getItem(STORAGE);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Line[];
    lines = parsed.filter((l) => find(l.productId) && l.qty > 0);
  } catch {
    lines = [];
  }
}

function save() {
  try { localStorage.setItem(STORAGE, JSON.stringify(lines)); } catch { /* modo privado */ }
}

function total() {
  let sum = 0;
  let pending = false;
  for (const l of lines) {
    const p = find(l.productId);
    const t = p?.tiers[l.tierIndex];
    if (!t) continue;
    if (t.price === null) pending = true;
    else sum += t.price * l.qty;
  }
  return { sum, pending };
}

/** texto que vai no WhatsApp */
function message() {
  const rows = lines.map((l) => {
    const p = find(l.productId)!;
    const t = p.tiers[l.tierIndex];
    const qty = l.qty > 1 ? ` (x${l.qty})` : '';
    return t.price === null
      ? `• ${p.name} — sob consulta${qty}`
      : `• ${p.name} — ${t.label} — ${priceLabel(t)}${qty}`;
  });
  const { sum, pending } = total();

  let text = 'Olá! Quero fazer um orçamento:\n\n' + rows.join('\n');
  text += `\n\nTotal: ${brl(sum)}`;
  if (pending) text += '\n(há item sob consulta, ainda não somado)';
  return text;
}

export function waLink(text?: string) {
  const base = `https://wa.me/${WHATSAPP}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

/* ---------- render ---------- */

function render() {
  if (!el.list) return;

  const n = lines.reduce((a, l) => a + l.qty, 0);
  el.count!.textContent = String(n);
  el.pill!.classList.toggle('is-empty', n === 0);
  el.empty!.hidden = n > 0;

  el.list.innerHTML = lines
    .map((l, i) => {
      const p = find(l.productId)!;
      const t = p.tiers[l.tierIndex];
      return `
        <li class="q-line">
          <img src="${p.image}" alt="" class="q-thumb">
          <span class="q-info">
            <b>${p.name}</b>
            <i>${t.label}</i>
          </span>
          <span class="q-qty">
            <button type="button" data-dec="${i}" aria-label="Menos um">−</button>
            <span>${l.qty}</span>
            <button type="button" data-inc="${i}" aria-label="Mais um">+</button>
          </span>
          <span class="q-price">${t.price === null ? '—' : priceLabel(t)}</span>
          <button class="q-del" type="button" data-del="${i}" aria-label="Remover">×</button>
        </li>`;
    })
    .join('');

  const { sum, pending } = total();
  el.total!.textContent = brl(sum);
  el.note!.hidden = !pending;
  el.send!.href = waLink(message());
  el.send!.classList.toggle('is-off', n === 0);
}

function open() {
  el.drawer!.classList.add('is-open');
  gsap.fromTo('.q-line', { x: 24, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 0.5, stagger: 0.05, ease: 'expo.out' });
}
function close() { el.drawer!.classList.remove('is-open'); }

/* ---------- API ---------- */

export function addToQuote(product: Product, tierIndex: number, from?: HTMLElement) {
  const hit = lines.find((l) => l.productId === product.id && l.tierIndex === tierIndex);
  if (hit) hit.qty += 1;
  else lines.push({ productId: product.id, tierIndex, qty: 1 });
  save();
  render();

  gsap.fromTo(el.pill!, { scale: 1 }, { scale: 1.18, duration: 0.2, yoyo: true, repeat: 1, ease: 'power2.out' });
  if (from) gsap.fromTo(from, { scale: 1 }, { scale: 0.94, duration: 0.14, yoyo: true, repeat: 1, ease: 'power2.out' });
  open();
}

export function tierButtons(p: Product): string {
  return p.tiers
    .map(
      (t: Tier, i: number) =>
        `<button class="add-btn" type="button" data-add="${p.id}" data-tier="${i}">
           <span>${t.label}</span><b>${priceLabel(t)}</b>
         </button>`,
    )
    .join('');
}

/** liga qualquer [data-add] presente ou futuro, via delegação */
export function initQuote() {
  el.pill = document.getElementById('quotePill') as HTMLButtonElement;
  el.count = document.getElementById('quoteCount');
  el.drawer = document.getElementById('quoteDrawer');
  el.list = document.getElementById('quoteList');
  el.total = document.getElementById('quoteTotal');
  el.note = document.getElementById('quoteNote');
  el.send = document.getElementById('quoteSend') as HTMLAnchorElement;
  el.empty = document.getElementById('quoteEmpty');

  load();
  render();

  el.pill.addEventListener('click', () => (el.drawer!.classList.contains('is-open') ? close() : open()));
  document.getElementById('quoteClose')!.addEventListener('click', close);
  document.getElementById('quoteScrim')!.addEventListener('click', close);
  addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

  document.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-add]');
    if (!btn) return;
    const p = find(btn.dataset.add!);
    if (!p) return;
    addToQuote(p, Number(btn.dataset.tier ?? 0), btn);
  });

  el.list!.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const del = t.dataset.del, inc = t.dataset.inc, dec = t.dataset.dec;
    if (del !== undefined) lines.splice(Number(del), 1);
    else if (inc !== undefined) lines[Number(inc)].qty += 1;
    else if (dec !== undefined) {
      const l = lines[Number(dec)];
      l.qty -= 1;
      if (l.qty <= 0) lines.splice(Number(dec), 1);
    } else return;
    save();
    render();
  });
}

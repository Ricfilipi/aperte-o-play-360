/** Destino de todos os orçamentos */
export const WHATSAPP = '5561995961143';

export interface Tier {
  /** rótulo curto, ex.: "4 horas" */
  label: string;
  /** null = sob consulta (fica fora do total) */
  price: number | null;
}

export interface Product {
  id: string;
  name: string;
  /** PNG recortado servido de /public/produtos */
  image: string;
  tiers: Tier[];
  /** fundo WebGL, em triplas rgb 0-1 */
  core: [number, number, number];
  edge: [number, number, number];
  glow: [number, number, number];
}

const hex = (h: string): [number, number, number] => [
  parseInt(h.slice(1, 3), 16) / 255,
  parseInt(h.slice(3, 5), 16) / 255,
  parseInt(h.slice(5, 7), 16) / 255,
];

export const PRODUCTS: Product[] = [
  {
    id: 'cabine-360',
    name: 'Plataforma 360',
    image: 'produtos/cabine-360.png',
    tiers: [
      { label: '2 horas', price: 350 },
      { label: '4 horas', price: 450 },
    ],
    core: hex('#3B1046'),
    edge: hex('#0C0313'),
    glow: hex('#B026FF'),
  },
  {
    id: 'piscina-de-bolinhas',
    name: 'Piscina de Bolinhas',
    image: 'produtos/piscina-de-bolinhas.png',
    tiers: [{ label: '4 horas', price: 350 }],
    core: hex('#5A1A12'),
    edge: hex('#190504'),
    glow: hex('#FF6A1F'),
  },
  {
    id: 'cama-elastica',
    name: 'Cama Elástica',
    image: 'produtos/cama-elastica.png',
    tiers: [{ label: '4 horas', price: 350 }],
    core: hex('#0E3A52'),
    edge: hex('#03101A'),
    glow: hex('#16B5C9'),
  },
  {
    id: 'drone',
    name: 'Drone',
    image: 'produtos/drone.png',
    tiers: [{ label: '1 hora', price: 300 }],
    core: hex('#16202B'),
    edge: hex('#04070B'),
    glow: hex('#4A8FD6'),
  },
];

export const brl = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 });

export const priceLabel = (t: Tier) => (t.price === null ? 'Sob consulta' : brl(t.price));

/** markup de uma imagem de produto */
export function productArt(p: Product): string {
  return `<img class="product-img" src="${p.image}" alt="${p.name}" draggable="false" loading="eager">`;
}

# Aperte o Play 360

[![CI](https://github.com/Ricfilipi/aperte-o-play-360/actions/workflows/ci.yml/badge.svg)](https://github.com/Ricfilipi/aperte-o-play-360/actions/workflows/ci.yml)
[![Deploy](https://github.com/Ricfilipi/aperte-o-play-360/actions/workflows/deploy.yml/badge.svg)](https://github.com/Ricfilipi/aperte-o-play-360/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**Site ao vivo:** https://ricfilipi.github.io/aperte-o-play-360/

Site de locação de equipamentos para festas — plataforma 360, cama elástica,
piscina de bolinhas e drone. Vite + Three.js + GSAP + Lenis.

## Stack

| Peça | Papel |
|---|---|
| **Vite 8 + TypeScript** | build, HMR, type-check estrito |
| **Three.js** (WebGL) | fundo em fragment shader — fbm com domain warping |
| **GSAP 3.15** | Flip, SplitText, ScrambleText, Observer, ScrollTrigger, CustomEase |
| **Lenis** | scroll suave, dirigido pelo ticker do GSAP |

## Rodar

```bash
npm install
npm run dev        # http://localhost:5180
npm run build      # tsc --noEmit + vite build
npm run preview    # serve o dist em :4173
```

> É um projeto ESM — precisa de servidor. Abrir o `index.html` por `file://`
> não funciona (CORS bloqueia módulos).

**Pré-requisitos:** Node.js 20+ e npm. Não há banco de dados, backend nem
variáveis de ambiente — é um site estático; tudo que o visitante escolhe vive
em `localStorage` e sai por um link do WhatsApp. As ferramentas de `tools/`
pedem um Google Chrome instalado (veja abaixo).

## Lista de orçamento

Não há carrinho — nada é cobrado no site. Cada produto tem uma ou mais
durações; a pessoa adiciona o que quer, o site monta a lista com o total e
manda tudo para o WhatsApp **+55 61 99596-1143**.

- **Preços** ficam em `src/data/products.ts`, como `tiers` por produto.
  `price: null` vira "Sob consulta" e fica fora do total (com aviso).
- **Estado** em `localStorage`, então a lista sobrevive a um refresh.
- **Envio**: `https://wa.me/5561995961143?text=...` com a lista já escrita.
  O botão *Falar no WhatsApp* do contato abre o mesmo número, sem texto.
- O número está em `WHATSAPP` no topo de `src/data/products.ts`.

Exemplo do que chega no WhatsApp:

```
Olá! Quero fazer um orçamento:

• Plataforma 360 — 4 horas — R$ 450
• Drone — 1 hora — R$ 300

Total: R$ 750
```

## As animações

**Abertura.** Uma timeline única encadeia: barra do preloader → cortina sobe →
o shader revela do centro para fora → o produto chega com overshoot em 3D
(`rotateX`, escala, desfoque saindo) → o título entra caractere a caractere
sob máscara de linha → nav, preço, miniaturas e rodapé escalonados.

**Troca de produto — o ponto central.** Não é fade. É `Flip`: existe **um
único elemento por produto**, reaproveitado para sempre. Quando você troca,
o elemento que era miniatura *vira* o produto principal — o GSAP mede as
duas posições e interpola a real. Medido: `x 1214→507`, largura `117→517`
ao longo de ~950 ms. Em paralelo: o que sai gira e desfoca, o que entra
chega desfocado e superexposto, as três cores do shader fazem tween, o
preço sobe e o nome embaralha com ScrambleText.

**Interação.** Arraste o produto para trocar (Observer, com elástico no
retorno), inclinação 3D seguindo o cursor, botões magnéticos, cursor
customizado que incha e ganha rótulo, preenchimento do botão de baixo
para cima, setas do teclado.

**Scroll.** Lenis + ScrollTrigger. Marquee acelera e enviesa conforme a
velocidade do scroll. Seção *Como Funciona* pinada — o produto gira e
escala conforme você rola. Seção *Catálogo* converte scroll vertical em
trilho horizontal pinado. Cada seção repinta o shader com sua paleta.

## Estrutura

```
src/
  main.ts              bootstrap + timeline de abertura
  data/products.ts     os 4 produtos (imagem, preço, paleta do shader)
  gl/Background.ts     renderer, shader e uniforms tweenáveis
  modules/hero.ts      carrossel com Flip, arraste, tilt, autoplay
  modules/scroll.ts    Lenis, pins, trilho horizontal, tema por seção
  modules/cursor.ts    cursor customizado + botões magnéticos
  modules/quote.ts     lista de orçamento, gaveta e link do WhatsApp
  styles/main.css      layout (cqw dentro do hero), tema, responsivo
public/produtos/       PNGs recortados dos produtos
public/marca/          a logo, recortada em círculo com alfa
tools/                 recorte de fundo + verificação visual via CDP
  chrome.mjs           onde está o Chrome e qual URL verificar
.github/workflows/     CI (type-check + build) e deploy no GitHub Pages
```

## Verificação

`tools/` dirige o Chrome local e checa comportamento, não só aparência.
Rode `npm run preview` antes.

`tools/chrome.mjs` acha o Chrome sozinho no Windows, macOS e Linux. Duas
variáveis ajustam isso quando o padrão não serve:

| Variável | Padrão | Para quê |
|---|---|---|
| `CHROME_PATH` | detectado pelo sistema | apontar outro binário (Chromium, Chrome Beta) |
| `SITE_URL` | `http://localhost:4173/` | mirar outra porta ou um deploy já publicado |

```bash
node tools/shoot.mjs ./shots   # capturas + posições + erros de console
node tools/check.mjs ./shots   # seções + prova que a faixa continua correndo
node tools/probe.mjs           # amostra o Flip quadro a quadro
node tools/mobile.mjs ./shots  # 390x844, checa overflow horizontal
node tools/quote.mjs ./shots   # adiciona itens e lê o link do WhatsApp
node tools/tiers.mjs           # confere as durações de cada produto
node tools/inspect.mjs "../fotos-para-claude"   # bordas e alfa das origens
```

`probe.mjs` existe porque `chrome --headless --screenshot
--virtual-time-budget` congela transições no meio e faz animação
funcionando parecer quebrada — foi o que aconteceu na primeira rodada.
Medir a caixa quadro a quadro resolve a dúvida.

## As imagens dos produtos

As fotos originais estão em `../fotos-para-claude`. A plataforma 360, a
cama elástica e a piscina de bolinhas vêm com o xadrez cinza de
"transparência falsa" gravado no JPG; o drone já é um PNG com alfa de
verdade e o `contato.jpeg` é só recortado em quadrado.

```bash
node tools/dechecker.mjs "../fotos-para-claude" public/produtos  # as três do xadrez
node tools/cutout.mjs    "../fotos-para-claude" public/produtos  # drone e contato
node tools/logo-round.mjs "../fotos-para-claude/logo.png" public/marca/play360.png
```

`dechecker.mjs` substituiu o `mode: 'checker'` do `cutout.mjs`, que
chaveava por cor e por isso comia os corrimãos da escada e a tela de
proteção — eles têm exatamente o cinza do fundo. Ele trabalha em três
passos:

| Passo | O que faz |
|---|---|
| inundação | tudo que é cinza, claro e alcançável pela borda é fundo — quadrados, emendas e o fantasma de um elemento apagado que clareia alguns quadrados |
| resgate | devolve as ilhas de tom único que sobrevivem a uma erosão de 2 px e correm mais de duas células: um corrimão passa, um quadrado é curto demais, uma emenda é fina demais |
| brilho | o halo de LED recebe o alfa que a própria saturação implica, e a lavagem cinza do xadrez é dividida de volta |

Tentativas de chavear por **alternância** (o fundo é a única coisa que
troca de tom a cada célula) falharam: as emendas entre quadrados também
se repetem a cada célula, então o próprio quadriculado é lido como
estrutura e sobra uma treliça de riscos finos. A alternância só é usada
onde é confiável — dentro de uma ilha já resgatada, para separar o
corrimão do quadrado claro grudado nele.

Verificação visual dos recortes:

```bash
node tools/preview-cut.mjs public/produtos ./preview.png   # sobre o fundo do site
node tools/mask.mjs        public/produtos ./mask.png      # só o canal alfa
node tools/zoom.mjs <img> <out> <x> <y> <w> <h> <escala>   # 1:1 numa região
```

## Notas

- O bundle tem ~720 KB (205 KB gzip), quase tudo GSAP + Three. Dá para
  cortar bastante importando só os plugins usados por caminho direto.
- `prefers-reduced-motion` pula a abertura e o cursor, mas mantém o site
  utilizável — não desliga tudo.

## Deploy

Todo push na `main` dispara dois workflows:

| Workflow | O que faz |
|---|---|
| `.github/workflows/ci.yml` | `npm ci` → `npm run build` (que roda `tsc --noEmit` antes do bundle) e guarda o `dist` como artefato |
| `.github/workflows/deploy.yml` | mesmo build, publicado no GitHub Pages |

O Vite está com `base: './'`, então os caminhos são relativos e o site funciona
tanto na raiz de um domínio quanto em um subcaminho de projeto do Pages, sem
mudar configuração.

Para publicar em qualquer outro lugar (Netlify, Vercel, S3, hospedagem
compartilhada): `npm run build` e sirva o conteúdo de `dist/` como arquivos
estáticos. Não há nada a rodar no servidor.

## Melhorias futuras

- **Cortar o bundle.** Os 720 KB são quase todos GSAP + Three importados
  inteiros. Importar só os plugins usados por caminho direto e montar um build
  enxuto do Three derruba isso bastante.
- **Imagens em AVIF/WebP** com `<picture>`. Os PNGs recortados somam 2,4 MB
  porque precisam de alfa; AVIF preserva o alfa por uma fração do peso.
- **Preços fora do código.** Hoje `src/data/products.ts` é a fonte da verdade,
  então mudar um preço exige um deploy. Um JSON servido à parte, ou um CMS
  headless, deixaria isso na mão de quem cuida do negócio.
- **Testes automatizados no CI.** As ferramentas de `tools/` já verificam
  comportamento real, mas dependem de um Chrome local e de um servidor de
  preview de pé. Portá-las para Playwright as tornaria executáveis no CI.
- **Métricas.** Nenhum evento é registrado hoje: não dá para saber quantos
  orçamentos viram conversa no WhatsApp.

## Licença

[MIT](LICENSE) — © 2026 Ricardo.

As fotos dos produtos e a logo em `public/` são material da marca Aperte o
Play 360 e não estão cobertas pela licença MIT do código.

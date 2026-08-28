import {
  Color,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
  WebGLRenderer,
} from 'three';
import type { Product } from '../data/products';

/* ------------------------------------------------------------------
   Full-screen fragment shader standing in for the flat CSS gradient.
   Domain-warped fbm noise keeps the backdrop breathing; the three
   palette colours are plain uniforms so GSAP can tween them directly
   during a colorway change.
   ------------------------------------------------------------------ */

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;

  varying vec2 vUv;

  uniform float uTime;
  uniform float uAspect;
  uniform vec2  uPointer;
  uniform vec3  uCore;
  uniform vec3  uEdge;
  uniform vec3  uGlow;
  uniform float uReveal;   // 0 -> 1 intro wipe
  uniform float uPulse;    // spikes on colorway change

  // -- value noise + fbm ------------------------------------------------
  vec2 hash2(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return fract(sin(p) * 43758.5453) * 2.0 - 1.0;
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(dot(hash2(i + vec2(0.0, 0.0)), f - vec2(0.0, 0.0)),
          dot(hash2(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
      mix(dot(hash2(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)),
          dot(hash2(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x),
      u.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * noise(p);
      p *= 2.02;
      a *= 0.5;
    }
    return v;
  }

  float grain(vec2 uv) {
    return fract(sin(dot(uv, vec2(12.9898, 78.233))) * 43758.5453);
  }

  void main() {
    vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);

    // domain warp so the field drifts rather than scrolls
    float t = uTime * 0.045;
    vec2 q = vec2(fbm(p * 1.6 + t), fbm(p * 1.6 + vec2(3.4, 1.7) - t));
    vec2 r = vec2(fbm(p * 2.1 + q * 1.3 + t * 0.7),
                  fbm(p * 2.1 + q * 1.3 + vec2(8.2, 2.9)));
    float n = fbm(p * 1.8 + r * 0.9);

    // radial falloff, nudged by the warp and the pointer
    vec2 c = p - uPointer * 0.10;
    float d = length(c * vec2(0.92, 1.22));
    d += n * 0.20;

    vec3 col = mix(uCore, uEdge, smoothstep(0.10, 0.82, d));

    // core bloom that leans toward the cursor
    float bloom = exp(-4.2 * length(c)) * (0.30 + uPulse * 0.55);
    col += uGlow * bloom;

    // soft banding lift, keeps large flats from looking dead
    col += uGlow * 0.05 * smoothstep(0.6, 0.0, d) * (0.5 + 0.5 * sin(n * 6.2831 + uTime * 0.4));

    // vignette
    col *= 1.0 - smoothstep(0.55, 1.15, length(p)) * 0.55;

    // film grain
    col += (grain(vUv * 900.0 + fract(uTime)) - 0.5) * 0.035;

    // intro wipe from the centre out
    float reveal = smoothstep(0.0, 1.0, uReveal * 1.6 - length(p) * 0.7);
    col *= reveal;

    gl_FragColor = vec4(col, 1.0);
  }
`;

export class Background {
  readonly canvas: HTMLCanvasElement;
  private renderer: WebGLRenderer;
  private scene = new Scene();
  private camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private material: ShaderMaterial;
  private raf = 0;
  private start = performance.now();

  /** GSAP tweens these directly */
  readonly core = new Color();
  readonly edge = new Color();
  readonly glow = new Color();
  readonly state = { reveal: 0, pulse: 0 };

  private pointer = new Vector2(0, 0);
  private pointerTarget = new Vector2(0, 0);

  constructor(canvas: HTMLCanvasElement, initial: Product) {
    this.canvas = canvas;
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

    this.core.setRGB(initial.core[0], initial.core[1], initial.core[2]);
    this.edge.setRGB(initial.edge[0], initial.edge[1], initial.edge[2]);
    this.glow.setRGB(initial.glow[0], initial.glow[1], initial.glow[2]);

    this.material = new ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uTime: { value: 0 },
        uAspect: { value: 1 },
        uPointer: { value: this.pointer },
        uCore: { value: this.core },
        uEdge: { value: this.edge },
        uGlow: { value: this.glow },
        uReveal: { value: 0 },
        uPulse: { value: 0 },
      },
    });

    this.scene.add(new Mesh(new PlaneGeometry(2, 2), this.material));

    this.resize();
    addEventListener('resize', this.resize, { passive: true });
    addEventListener('pointermove', this.onPointer, { passive: true });

    this.loop();
  }

  private resize = () => {
    const w = innerWidth;
    const h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.material.uniforms.uAspect.value = w / h;
  };

  private onPointer = (e: PointerEvent) => {
    this.pointerTarget.set(
      (e.clientX / innerWidth - 0.5) * 2,
      -(e.clientY / innerHeight - 0.5) * 2,
    );
  };

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    this.pointer.lerp(this.pointerTarget, 0.045);
    this.material.uniforms.uTime.value = (performance.now() - this.start) / 1000;
    this.material.uniforms.uReveal.value = this.state.reveal;
    this.material.uniforms.uPulse.value = this.state.pulse;
    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    cancelAnimationFrame(this.raf);
    removeEventListener('resize', this.resize);
    removeEventListener('pointermove', this.onPointer);
    this.renderer.dispose();
  }
}

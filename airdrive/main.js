/* ═══════════════════════════════════════════════════════════
   AIR DRIFT — one continuous flight, driven by scroll.
   v3: the game's actual Rafale model (GLB), the game's actual
   AirDriveSkybox shader ported HLSL→GLSL with its material
   values, shader-based afterburner flames, judge-driven UI.
   ═══════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (reduced) document.documentElement.classList.add('reduced');

gsap.registerPlugin(ScrollTrigger);

if (!reduced) {
  try {
    const { default: Lenis } = await import('https://unpkg.com/lenis@1.1.13/dist/lenis.mjs');
    const lenis = new Lenis({ lerp: 0.09 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  } catch (e) { /* native scroll is fine */ }
}

/* ═════════════ RENDERER / COMPOSER ═════════════ */
const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); // bloom pass is the real cost — cap DPR so reveals never hitch
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x0a1220, 0.012);
const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.1, 500);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.7, 0.5, 0.85);
composer.addPass(bloom);
composer.addPass(new OutputPass());

/* ═════════════ SKY — the game's AirDriveSkybox, ported ═════════════
   HLSL source: Assets/07.Shaders/AirDriveSkybox.shader
   Values:      Assets/03.Materials/Custom_AirDriveSkybox.mat        */
const cloudTex = new THREE.TextureLoader().load('assets/cloud.png');
cloudTex.wrapS = cloudTex.wrapT = THREE.RepeatWrapping;
cloudTex.colorSpace = THREE.SRGBColorSpace;

/* hero opens on a full sunset — the journey cools down, then returns to dawn */
const SKY = {
  top: new THREE.Color(0x0a1024),
  mid: new THREE.Color(0x463a4a),
  horizon: new THREE.Color(0x8a4526),
  back: new THREE.Color(0x0a0716),
  bottom: new THREE.Color(0x241c30),
  sunColor: new THREE.Color(0.55, 0.17, 0.0),
  sunDir: new THREE.Vector3(-0.2, 0.06, -0.9).normalize(), // low sun inside the hero frame, right of the headline
  sunI: 14, sunSize: 0.0641,
  glowSize: 0.232, glowI: 5.0, glowStretch: 1.63,
  atmI: 1.5, atmExp: 1.56,
  starB: 0.06,
  fog: new THREE.Color(0x171017),
  cloudOpacity: 1.0,
};
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  depthWrite: false,
  uniforms: {
    uTime: { value: 0 },
    uTop: { value: SKY.top }, uMid: { value: SKY.mid },
    uHorizon: { value: SKY.horizon }, uBack: { value: SKY.back }, uBottom: { value: SKY.bottom },
    uSunColor: { value: SKY.sunColor }, uSunDir: { value: SKY.sunDir },
    uSunI: { value: SKY.sunI }, uSunSize: { value: SKY.sunSize },
    uGlowSize: { value: SKY.glowSize }, uGlowI: { value: SKY.glowI }, uGlowStretch: { value: SKY.glowStretch },
    uAtmI: { value: SKY.atmI }, uAtmExp: { value: SKY.atmExp },
    uStarB: { value: SKY.starB },
    uCloudOpacity: { value: SKY.cloudOpacity },
    tCloud: { value: cloudTex },
  },
  vertexShader: /* glsl */`
    varying vec3 vDir;
    void main() {
      vDir = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */`
    varying vec3 vDir;
    uniform float uTime, uSunI, uSunSize, uGlowSize, uGlowI, uGlowStretch, uAtmI, uAtmExp, uStarB, uCloudOpacity;
    uniform vec3 uTop, uMid, uHorizon, uBack, uBottom, uSunColor, uSunDir;
    uniform sampler2D tCloud;

    // shader constants from Custom_AirDriveSkybox.mat
    const float HORIZON_OFFSET = -0.02;
    const float MID_HEIGHT = 0.5;
    const float HORIZON_FALLOFF = 0.58;
    const float STAR_DENSITY = 90.0;
    const float STAR_FADE = 0.483;
    const vec4  CLOUD_STRENGTH = vec4(1.0, 1.0, 0.5, 0.3);
    const float CLOUD_DENSITY = 1.4;

    float hash21(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }
    float starField(vec3 dir) {
      vec3 id = floor(dir * STAR_DENSITY);
      vec3 fd = fract(dir * STAR_DENSITY) - 0.5;
      float rnd = hash21(id.xz + id.y * 17.1);
      float size = smoothstep(0.85, 1.0, rnd);
      float dist = length(fd.xz);
      float star = smoothstep(0.1 * size + 0.05, 0.0, dist) * size;
      float twinkle = sin(uTime * (rnd * 5.0 + 2.0) + rnd * 6.28) * 0.5 + 0.5;
      return star * mix(0.5, 1.0, twinkle);
    }

    void main() {
      vec3 dir = normalize(vDir);
      float y = dir.y + HORIZON_OFFSET;

      // ── sky gradient with sun-facing horizon (ported 1:1) ──
      vec3 sunDir = normalize(uSunDir);
      vec2 dirXZ = normalize(dir.xz + vec2(1e-5));
      vec2 sunXZ = normalize(sunDir.xz + vec2(1e-5));
      float sunFacing = clamp(dot(dirXZ, sunXZ) * 0.5 + 0.5, 0.0, 1.0);
      vec3 horizonCol = mix(uHorizon, mix(uHorizon, uBack, 1.0 - sunFacing), HORIZON_FALLOFF);

      vec3 skyColor;
      if (y > 0.0) {
        float t = clamp(y / MID_HEIGHT, 0.0, 1.0);
        vec3 lowerSky = mix(horizonCol, uMid, t);
        float t2 = clamp((y - MID_HEIGHT) / (1.0 - MID_HEIGHT), 0.0, 1.0);
        skyColor = mix(lowerSky, uTop, t2 * t2);
      } else {
        float t = clamp(-y * 3.0, 0.0, 1.0);
        skyColor = mix(horizonCol, uBottom, t);
      }

      // ── sun disc + stretched glow (ported 1:1) ──
      float sunDot = dot(dir, sunDir);
      float sunDisc = smoothstep(1.0 - uSunSize * 0.01, 1.0, sunDot) * uSunI;
      skyColor += uSunColor * sunDisc;

      vec3 up = vec3(0.0, 1.0, 0.0);
      vec3 sunRight = cross(up, sunDir);
      sunRight = length(sunRight) < 1e-4 ? vec3(1.0, 0.0, 0.0) : normalize(sunRight);
      vec3 sunUp = normalize(cross(sunDir, sunRight));
      vec2 sunPlane = vec2(dot(dir, sunRight), dot(dir, sunUp));
      float radial = sqrt(sunPlane.x * sunPlane.x / (uGlowStretch * uGlowStretch) + sunPlane.y * sunPlane.y);
      float sunGlow = pow(clamp(1.0 - radial / max(1e-3, uGlowSize), 0.0, 1.0), 2.0) * uGlowI;
      sunGlow *= clamp(sunDot, 0.0, 1.0);
      skyColor += uSunColor * sunGlow * 0.3;

      float horizonScatter = pow(clamp(1.0 - abs(y) * 4.0, 0.0, 1.0), 2.0) * pow(clamp(sunDot, 0.0, 1.0), uAtmExp);
      skyColor += uSunColor * horizonScatter * uAtmI;

      // ── stars ──
      float starFade = clamp((y - STAR_FADE) / 0.3, 0.0, 1.0);
      float stars = starField(dir) * uStarB * starFade;
      float sunInfluence = clamp(sunDot * 0.5 + 0.5, 0.0, 1.0);
      stars *= (1.0 - sunGlow * 2.0) * (1.0 - sunInfluence * 0.5);
      skyColor += vec3(4.0) * max(0.0, stars);

      // ── clouds — lat-long panorama of the game's AmbientCloudTex ──
      // upper-hemisphere lat-long, like the game's pano sampling
      vec2 uv = vec2(atan(dir.x, dir.z) * 0.1591 + 0.5,
                     clamp(asin(clamp(dir.y, 0.0, 1.0)) * 0.6366, 0.0, 1.0));
      vec2 scroll = vec2(uTime * 0.0021, 0.0);
      vec4 cA = texture2D(tCloud, uv + scroll);
      vec4 cB = texture2D(tCloud, uv * 1.7 - scroll * 0.6);
      // game shader: opacity from the green channel only
      float cg = mix(cA.g, cB.g, 0.35);
      float cl = dot(mix(cA, cB, 0.35), CLOUD_STRENGTH) * 0.5;
      float cop = pow(max(cg, 0.0), 1.6) * uCloudOpacity * smoothstep(0.02, 0.3, dir.y)
                * (1.0 - smoothstep(0.72, 0.94, dir.y));   // no smeared pole artifact
      float shade = 0.35 + 0.65 * exp(-(1.0 - cl) * CLOUD_DENSITY);
      vec3 cloudCol = (skyColor * 0.7 + uSunColor * 0.22 + vec3(0.28)) * shade;
      skyColor = mix(skyColor, cloudCol, clamp(cop, 0.0, 1.0) * 0.65);

      // grain vs banding
      skyColor += (hash21(dir.xy * 900.0 + uTime) - 0.5) * 0.012;

      gl_FragColor = vec4(skyColor, 1.0);
    }`,
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(240, 48, 32), skyMat);
scene.add(sky);

/* ── lights ── */
scene.add(new THREE.HemisphereLight(0x44648a, 0x1a2434, 0.9));
const moon = new THREE.DirectionalLight(0xcfe0f2, 2.2);
moon.position.set(-7, 11, 5);
scene.add(moon);
const bounce = new THREE.DirectionalLight(0x4a7aa0, 0.8);
bounce.position.set(3, -10, 3);
scene.add(bounce);
// cyan rim opposite the camera so wing/spine edges catch a hard highlight
const rim = new THREE.DirectionalLight(0x7fd4ff, 3.5);
rim.position.set(-3, 6, -7);
scene.add(rim);
const burnerLight = new THREE.PointLight(0xff9838, 0, 40);
scene.add(burnerLight);
const boltLight = new THREE.PointLight(0xbfe2ff, 0, 90);
scene.add(boltLight);

/* ═════════════ THE JET — the game's Rafale ═════════════ */
const jet = new THREE.Group();
const jetInner = new THREE.Group();
jet.add(jetInner);
scene.add(jet);

const HULL = new THREE.MeshStandardMaterial({ color: 0x6d7a8a, metalness: 0.75, roughness: 0.35, envMapIntensity: 0.55 });
const burnerRig = new THREE.Group();
jetInner.add(burnerRig);

/* shader-based afterburner flame */
const flameMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  uniforms: { uTime: { value: 0 }, uPower: { value: 1 } },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    varying float vEdge;
    void main() {
      vUv = uv;
      // soft silhouette: fade where the cylinder wall turns away from the eye
      vec3 nrm = normalize(normalMatrix * normal);
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vEdge = abs(dot(nrm, normalize(-mv.xyz)));
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: /* glsl */`
    varying vec2 vUv;
    varying float vEdge;
    uniform float uTime, uPower;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
                 mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
    }
    void main() {
      float len = vUv.y;                       // 0 = nozzle, 1 = tip
      float t = uTime * 7.0;
      float n = noise(vec2(vUv.x * 6.0, len * 4.0 - t))
              + 0.5 * noise(vec2(vUv.x * 12.0, len * 9.0 - t * 1.7));
      n /= 1.5;
      // flame body erodes toward the tip, noise eats the edge
      float body = smoothstep(1.0, 0.05, len + (n - 0.5) * 0.55);
      // shock-diamond core near the nozzle
      float core = smoothstep(0.5, 0.0, len);
      float diamonds = 0.5 + 0.5 * sin(len * 34.0);
      core *= 0.75 + 0.25 * diamonds;
      float a = (body * 0.5 + core * 0.5) * uPower;
      a *= pow(clamp(vEdge, 0.0, 1.0), 2.1);    // steep spindle falloff — continuous core→halo
      vec3 col = mix(vec3(1.0, 0.42, 0.1), vec3(1.0, 0.92, 0.7), clamp(core * 1.4, 0.0, 1.0));
      gl_FragColor = vec4(col * a, a);
    }`,
});
const burnerFlames = [], burnerCores = [], navLights = [];

function buildBurners(tailZ, sepX, midY) {
  for (const s of [sepX, -sepX]) {
    const flameGeo = new THREE.CylinderGeometry(0.03, 0.17, 2.4, 18, 10, true);
    flameGeo.translate(0, 1.2, 0);         // base (nozzle) at local origin
    flameGeo.rotateX(Math.PI / 2);          // length → +z (aft)
    const flame = new THREE.Mesh(flameGeo, flameMat.clone());
    flame.position.set(s, midY, tailZ - 0.1);
    burnerRig.add(flame);
    burnerFlames.push(flame);

    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 10, 10),
      new THREE.MeshBasicMaterial({ color: 0xffd9a0 })
    );
    core.position.set(s, midY, tailZ);
    burnerRig.add(core);
    burnerCores.push(core);
  }
}
function addNav(color, x, y, z) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), new THREE.MeshBasicMaterial({ color, transparent: true }));
  m.position.set(x, y, z);
  jetInner.add(m);
  navLights.push(m);
}

new GLTFLoader().load('assets/rafale.glb', (gltf) => {
  const model = gltf.scene;
  // strip the ground plane that ships inside the FBX — actually REMOVE it,
  // otherwise it poisons the bounding box and shrinks the jet
  // remove the FBX's ground plane AND the deployed landing gear
  // (mesh indices mapped via Blender: 4,6,7,12,13,14,15,17,18 = gear/pitot)
  const junk = [];
  model.traverse((o) => {
    if (!o.isMesh) return;
    // gear + pitot + underwing tanks/pylon plate — tanks read as broken-off pods
    if (/plane/i.test(o.name) || /(^|[ _])(3|4|6|7|11|12|13|14|15|16|17|18)$/.test(o.name)) junk.push(o);
  });
  junk.forEach((o) => o.removeFromParent());
  // one clean metal — the page's own livery, not the FBX's lost PSD
  model.traverse((o) => {
    if (o.isMesh && o.visible) {
      o.material = HULL;
      o.castShadow = o.receiveShadow = false;
    }
  });
  // normalize: center, nose → -z, length = 6.6 (keeps every camera pose valid)
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  model.position.sub(center);
  const wrap = new THREE.Group();
  wrap.add(model);
  const maxAxis = Math.max(size.x, size.y, size.z);
  if (size.x === maxAxis) wrap.rotation.y = Math.PI / 2;    // length was along x → rotate to z
  else wrap.rotation.y = Math.PI;   // nose exported +z → flip to -z (y+z double-flip = upside down!)
  const scale = 6.6 / maxAxis;
  wrap.scale.setScalar(scale);
  jetInner.add(wrap);

  // measure again in jet space to seat the burners in the actual nozzles.
  // NOTE: the tall vertical fin skews the bbox center upward — the fuselage
  // centerline sits near the lower third, and the nozzles just ahead of max.z
  const box2 = new THREE.Box3().setFromObject(wrap);
  const midY = box2.min.y + (box2.max.y - box2.min.y) * 0.34;
  buildBurners(box2.max.z - 0.78, 0.22, midY);
  // no nav-light dots: bbox placement drifts off the wingtips and the
  // red/green reads as foreign matter against the amber/cyan palette
}, undefined, () => {
  // offline fallback: keep flying with a simple hull
  const stub = new THREE.Mesh(new THREE.ConeGeometry(0.5, 6.6, 4), HULL);
  stub.rotation.x = -Math.PI / 2;
  jetInner.add(stub);
  buildBurners(3.0, 0.32, 0);
});

/* ═════════════ PARTICLES ═════════════ */
function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(16, 16, 1, 16, 16, 15);
  g.addColorStop(0, 'rgba(255,220,160,1)');
  g.addColorStop(0.4, 'rgba(255,180,84,0.5)');
  g.addColorStop(1, 'rgba(255,180,84,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}
const TRAIL_N = 420;
const trailPos = new Float32Array(TRAIL_N * 3);
const trailLife = new Float32Array(TRAIL_N).fill(2);
const trailGeo = new THREE.BufferGeometry();
trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
const trail = new THREE.Points(trailGeo, new THREE.PointsMaterial({
  color: 0xffb454, size: 0.1, map: glowTexture(), transparent: true, opacity: 0.5,
  blending: THREE.AdditiveBlending, depthWrite: false,
}));
scene.add(trail);
let trailHead = 0;

function softTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 6, 64, 64, 62);
  g.addColorStop(0, 'rgba(210,225,240,0.5)');
  g.addColorStop(0.6, 'rgba(160,185,210,0.16)');
  g.addColorStop(1, 'rgba(160,185,210,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
const cloudMat = new THREE.SpriteMaterial({ map: softTexture(), transparent: true, depthWrite: false, opacity: 0.55 });
const clouds = [];
for (let i = 0; i < 8; i++) {
  const s = new THREE.Sprite(cloudMat.clone());
  respawnCloud(s, true);
  scene.add(s);
  clouds.push(s);
}
function respawnCloud(s, anywhere = false) {
  s.position.set(
    (Math.random() - 0.5) * 100,
    -24 + Math.random() * 16,   // deck stays well below the flight path
    anywhere ? (Math.random() * 280 - 240) : (-240 - Math.random() * 40)
  );
  const sc = 16 + Math.random() * 24;  // no small blobs — they read as gray disc bugs
  s.scale.set(sc, sc * 0.5, 1);
}

const STREAK_N = 170;
const streakPos = new Float32Array(STREAK_N * 6);
for (let i = 0; i < STREAK_N; i++) resetStreak(i, true);
function resetStreak(i, anywhere = false) {
  const x = (Math.random() - 0.5) * 64;
  const y = (Math.random() - 0.5) * 36;
  const z = anywhere ? Math.random() * 260 - 240 : -240;
  streakPos.set([x, y, z, x, y, z + 2.4 + Math.random() * 3], i * 6);
}
const streakGeo = new THREE.BufferGeometry();
streakGeo.setAttribute('position', new THREE.BufferAttribute(streakPos, 3));
const streaks = new THREE.LineSegments(streakGeo, new THREE.LineBasicMaterial({
  color: 0x5a8aa8, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending,
}));
scene.add(streaks);

/* lightning */
const bolts = [];
const boltMat = new THREE.LineBasicMaterial({
  color: 0xcfe8ff, transparent: true, opacity: 1,
  blending: THREE.AdditiveBlending,
});
function spawnBolt() {
  // shorter strike, contained in the mid-band — never a full-frame crack
  const from = new THREE.Vector3((Math.random() - 0.5) * 26, 8 + Math.random() * 4, (Math.random() - 0.5) * 36 - 12);
  const to = new THREE.Vector3(from.x + (Math.random() - 0.5) * 10, -6 - Math.random() * 3, from.z + (Math.random() - 0.5) * 10);
  const pts = [];
  const SEG = 9;
  for (let i = 0; i <= SEG; i++) {
    const p = from.clone().lerp(to, i / SEG);
    if (i > 0 && i < SEG) {
      p.x += (Math.random() - 0.5) * 2.4;
      p.z += (Math.random() - 0.5) * 2.4;
    }
    pts.push(p);
  }
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const group = new THREE.Group();
  // bright core
  group.add(new THREE.Line(geo, boltMat.clone()));
  // faux glow: jittered translucent copies around the core
  for (const off of [0.12, -0.12, 0.22]) {
    const glowMat = new THREE.LineBasicMaterial({
      color: 0x6fa8e0, transparent: true, opacity: 0.3,
      blending: THREE.AdditiveBlending,
    });
    glowMat.userData.isGlow = true;
    const glow = new THREE.Line(geo, glowMat);
    glow.position.set(off, 0, -off * 0.6);
    group.add(glow);
  }
  scene.add(group);
  bolts.push({ line: group, life: 0 });
  boltLight.position.copy(pts[Math.floor(SEG / 2)]);
  boltLight.intensity = 60;
}

/* ═════════════ SCROLL CHOREOGRAPHY ═════════════ */
/* hero pose: jet banks in the right third, text owns the left column */
const F = {
  az: 0.55, el: 0.12, dist: 9.5,
  lookX: -2.9, lookY: 0.3,
  jetX: 0, jetY: 0, roll: -0.35, pitch: -0.09, yaw: 0.15,
  burner: 1.0, speed: 1.0,
  storm: 0, lock: 0, grid: 0,
};

const POSES = [
  null,
  { az: -0.94, el: 0.23, dist: 9.6, lookX: -2.6, lookY: 0.2, jetX: 2.2, pitch: -0.18, yaw: 0.25, roll: 0, burner: 1.0, speed: 1.0, storm: 0, lock: 1, grid: 0 },
  { az: 0.9, el: 0.12, dist: 9.7, lookX: 2.6, lookY: 0.3, jetX: -2.2, pitch: 0.1, yaw: -0.3, roll: -0.25, burner: 1.0, speed: 1.2, storm: 0, lock: 1, grid: 0 },
  /* skills — the jet dives out of frame naturally; the storm IS the scene */
  { az: 0.13, el: -0.5, dist: 27.0, lookX: 0, lookY: 6.8, jetX: 0, jetY: -14, pitch: 0.35, yaw: 0, roll: Math.PI * 2 - 0.25, burner: 0.6, speed: 2.2, storm: 1, lock: 0, grid: 0 },
  /* hangar — wider showpiece that fits the band above the (lowered) cards */
  { az: 2.54, el: 0.38, dist: 14.0, lookX: 0, lookY: 0.6, jetX: 0, jetY: 0, pitch: 0, yaw: 0, roll: Math.PI * 2, burner: 0.35, speed: 0.5, storm: 0, lock: 0, grid: 0 },
  /* launch — rear three-quarter so the burners sit in the lower third, not behind the copy */
  /* launch — jet in the lower band under the copy, sunrise rim behind it */
  /* launch — jet exits toward the lower-right corner; copy and CTA own the center */
  { az: Math.PI * 2 - 0.55, el: 0.24, dist: 15.0, lookX: -4.6, lookY: 2.35, jetX: 0, pitch: -0.22, yaw: 0, roll: Math.PI * 2, burner: 2.4, speed: 3.2, storm: 0, lock: 0, grid: 0 },
];

/* sky journey — each preset re-lights the game skybox.
   ONE fixed sun bearing for the whole flight: only its color, height and
   intensity change, so it can never pop in and out of frame mid-transition */
const SUN = [-0.2, 0.06, -0.9];
const SKY_POSES = [
  null,
  { top: 0x02141f, mid: 0x2c3e50, horizon: 0x2e5a6e, back: 0x010812, bottom: 0x1a2a40,
    sunColor: [0.3, 0.32, 0.42], sunDir: [SUN[0], 0.03, SUN[2]], sunI: 4, glowI: 2.2, atmI: 0.7, starB: 0.25, fog: 0x0a1826, cloudOpacity: 0.9 },
  { top: 0x000a14, mid: 0x1c2432, horizon: 0x2a3444, back: 0x01010c, bottom: 0x141c30,
    sunColor: [0.35, 0.12, 0.02], sunDir: [SUN[0], 0.01, SUN[2]], sunI: 2, glowI: 1.4, atmI: 0.6, starB: 0.5, fog: 0x070d18, cloudOpacity: 0.7 },
  { top: 0x060a1c, mid: 0x101a30, horizon: 0x1c2a44, back: 0x030614, bottom: 0x0c1226,
    sunColor: [0.2, 0.35, 0.5], sunDir: [SUN[0], -0.06, SUN[2]], sunI: 0, glowI: 0.5, atmI: 0.4, starB: 0.15, fog: 0x081020, cloudOpacity: 1.3 },
  { top: 0x0a0d20, mid: 0x2a2c48, horizon: 0x4a3c5a, back: 0x060618, bottom: 0x1c2038,
    sunColor: [0.45, 0.2, 0.3], sunDir: [SUN[0], 0.02, SUN[2]], sunI: 3, glowI: 2.2, atmI: 0.9, starB: 0.3, fog: 0x0c1120, cloudOpacity: 0.8 },
  { top: 0x0e1428, mid: 0x54424a, horizon: 0x8a4a2e, back: 0x140f20, bottom: 0x2c2438,
    sunColor: [0.55, 0.17, 0.0], sunDir: [0.05, 0.08, -0.85], sunI: 16, glowI: 5.5, atmI: 1.6, starB: 0.05, fog: 0x171018, cloudOpacity: 1.1 },
];

const sections = gsap.utils.toArray('.sec');
if (!reduced) {
  sections.forEach((sec, i) => {
    if (!POSES[i]) return;
    /* ranges tile edge-to-edge (each ends exactly where the next begins)
       so the camera NEVER freezes between sections — one continuous flight */
    /* scrub:true — no catch-up lag. With lag, a finishing tween and the next
       one write the same F properties simultaneously at every boundary and
       the jet visibly fights itself. Lenis already supplies the smoothing. */
    const next = sections[i + 1];
    const st = () => (next
      ? { trigger: sec, start: 'top bottom', endTrigger: next, end: 'top bottom', scrub: true }
      : { trigger: sec, start: 'top bottom', end: 'top 15%', scrub: true });
    gsap.to(F, { ...POSES[i], ease: 'none', immediateRender: false, scrollTrigger: st() });

    const S = SKY_POSES[i];
    for (const key of ['top', 'mid', 'horizon', 'back', 'bottom', 'fog']) {
      const c = new THREE.Color(S[key]);
      gsap.to(SKY[key], { r: c.r, g: c.g, b: c.b, ease: 'none', immediateRender: false, scrollTrigger: st() });
    }
    gsap.to(SKY.sunColor, { r: S.sunColor[0], g: S.sunColor[1], b: S.sunColor[2], ease: 'none', immediateRender: false, scrollTrigger: st() });
    gsap.to(SKY.sunDir, { x: S.sunDir[0], y: S.sunDir[1], z: S.sunDir[2], ease: 'none', immediateRender: false, scrollTrigger: st() });
    gsap.to(SKY, { sunI: S.sunI, glowI: S.glowI, atmI: S.atmI, starB: S.starB, cloudOpacity: S.cloudOpacity, ease: 'none', immediateRender: false, scrollTrigger: st() });
  });
}

/* content reveals */
if (!reduced) {
  document.documentElement.classList.add('fx');
  document.querySelectorAll('.reveal').forEach((el) => {
    gsap.to(el, {
      opacity: 1, y: 0, duration: 1.1, ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 96%' },
    });
  });
}

/* language toggle — swaps every [data-en] node, caches KR on first flip */
{
  const btn = document.getElementById('lang');
  let lang = 'ko';
  btn.addEventListener('click', () => {
    lang = lang === 'ko' ? 'en' : 'ko';
    document.documentElement.lang = lang;
    btn.textContent = lang === 'ko' ? 'EN' : '한국어';
    btn.setAttribute('aria-label', lang === 'ko' ? 'Switch to English' : '한국어로 보기');
    document.querySelectorAll('[data-en]').forEach((el) => {
      if (!el.dataset.ko) el.dataset.ko = el.innerHTML;
      el.innerHTML = lang === 'en' ? el.dataset.en : el.dataset.ko;
    });
    document.title = lang === 'en'
      ? 'AIRDRIVE — a fighter-jet roguelite flown by hand gestures'
      : 'AIRDRIVE — 손동작으로 조종하는 전투기 로그라이트';
  });
}

/* ═════════════ HUD / RADAR / LOCK-ON / CURSOR ═════════════ */
const spdEl = document.getElementById('hud-spd');
const altEl = document.getElementById('hud-alt');
let lastScroll = scrollY, scrollVel = 0;

const lockEl = document.getElementById('lockon');
const lockDist = document.getElementById('lk-dist');
const projV = new THREE.Vector3();

const radar = document.getElementById('radar');
const rctx = radar ? radar.getContext('2d') : null;
const blips = Array.from({ length: 7 }, () => ({
  a: Math.random() * Math.PI * 2, r: 20 + Math.random() * 78,
}));
function drawRadar(t) {
  if (!rctx) return;
  const S = 220, C = S / 2;
  rctx.clearRect(0, 0, S, S);
  rctx.strokeStyle = 'rgba(111,211,232,0.35)';
  rctx.lineWidth = 1;
  for (const r of [34, 68, 102]) {
    rctx.beginPath(); rctx.arc(C, C, r, 0, Math.PI * 2); rctx.stroke();
  }
  rctx.beginPath(); rctx.moveTo(C, 8); rctx.lineTo(C, S - 8); rctx.moveTo(8, C); rctx.lineTo(S - 8, C); rctx.stroke();
  const sweep = (t * 0.9) % (Math.PI * 2);
  if (rctx.createConicGradient) {
    const grad = rctx.createConicGradient(sweep, C, C);
    grad.addColorStop(0, 'rgba(111,211,232,0.5)');
    grad.addColorStop(0.12, 'rgba(111,211,232,0)');
    grad.addColorStop(1, 'rgba(111,211,232,0)');
    rctx.fillStyle = grad;
    rctx.beginPath(); rctx.moveTo(C, C); rctx.arc(C, C, 102, 0, Math.PI * 2); rctx.fill();
  }
  for (const b of blips) {
    const d = (sweep - b.a + Math.PI * 2) % (Math.PI * 2);
    const glow = Math.max(0, 1 - d * 1.4);
    if (glow <= 0.02) continue;
    rctx.fillStyle = `rgba(255,180,84,${glow})`;
    rctx.beginPath();
    rctx.arc(C + Math.cos(b.a) * b.r, C + Math.sin(b.a) * b.r, 3, 0, Math.PI * 2);
    rctx.fill();
  }
}

const pointer = { x: 0, y: 0 };
const cursor = document.getElementById('cursor');
addEventListener('pointermove', (e) => {
  pointer.x = (e.clientX / innerWidth - 0.5) * 2;
  pointer.y = (e.clientY / innerHeight - 0.5) * 2;
  if (cursor) cursor.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
}, { passive: true });
document.querySelectorAll('a, button').forEach((el) => {
  el.addEventListener('pointerenter', () => cursor && cursor.classList.add('hot'));
  el.addEventListener('pointerleave', () => cursor && cursor.classList.remove('hot'));
});

/* ═════════════ RENDER LOOP ═════════════ */
const look = new THREE.Vector3();
const clock = new THREE.Clock();
const pSmooth = { x: 0, y: 0 };  // eased pointer — raw deltas twitch the airframe

function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  skyMat.uniforms.uTime.value = t;
  skyMat.uniforms.uSunI.value = SKY.sunI;
  skyMat.uniforms.uGlowI.value = SKY.glowI;
  skyMat.uniforms.uAtmI.value = SKY.atmI;
  skyMat.uniforms.uStarB.value = SKY.starB;
  skyMat.uniforms.uCloudOpacity.value = SKY.cloudOpacity;
  scene.fog.color.copy(SKY.fog);

  scrollVel += ((scrollY - lastScroll) - scrollVel) * 0.08;
  lastScroll = scrollY;
  const kt = Math.round(248 + F.speed * 90 + Math.abs(scrollVel) * 2.2);
  if (spdEl) spdEl.textContent = String(Math.min(kt, 9999)).padStart(4, '0');
  const prog = document.documentElement.scrollHeight > innerHeight
    ? scrollY / (document.documentElement.scrollHeight - innerHeight) : 0;
  if (altEl) altEl.textContent = String(Math.round(11200 + prog * 26800)).padStart(5, '0');

  pSmooth.x += (pointer.x - pSmooth.x) * (1 - Math.exp(-dt * 6));
  pSmooth.y += (pointer.y - pSmooth.y) * (1 - Math.exp(-dt * 6));

  jet.position.set(F.jetX, F.jetY, 0);
  jet.rotation.set(F.pitch, F.yaw, F.roll);
  jetInner.position.y = Math.sin(t * 1.3) * 0.18;
  jetInner.rotation.z = Math.sin(t * 0.9) * 0.05 + pSmooth.x * -0.18;
  jetInner.rotation.x = pSmooth.y * 0.07;

  /* afterburner */
  const flick = F.burner * (0.9 + Math.random() * 0.2);
  for (const f of burnerFlames) {
    f.material.uniforms.uTime.value = t;
    f.material.uniforms.uPower.value = Math.min(1.2, 0.25 + F.burner * 0.45);
    f.scale.set(0.75 + flick * 0.25, 0.75 + flick * 0.25, 0.45 + flick * 0.55);
  }
  for (const c of burnerCores) c.scale.setScalar(0.6 + flick * 0.5);
  burnerLight.intensity = F.burner * 9;
  burnerLight.position.set(jet.position.x, jet.position.y, 4);

  // fully dark between strobes — a dim gray dot reads as a render bug
  const blink = (t % 1.2 < 0.07 || (t % 1.2 > 0.16 && t % 1.2 < 0.23)) ? 1 : 0.0;
  for (const n of navLights) n.material.opacity = blink;

  const spawn = F.burner > 0.15 && burnerCores.length ? 3 : 0;
  for (let i = 0; i < spawn; i++) {
    const src = burnerCores[trailHead % burnerCores.length];
    const p = src.getWorldPosition(new THREE.Vector3());
    p.x += (Math.random() - 0.5) * 0.08;
    p.z += 0.3;
    trailPos.set([p.x, p.y, p.z], trailHead * 3);
    trailLife[trailHead] = 0;
    trailHead = (trailHead + 1) % TRAIL_N;
  }
  for (let i = 0; i < TRAIL_N; i++) {
    trailLife[i] += dt;
    trailPos[i * 3 + 2] += (14 + F.speed * 10) * dt;
    if (trailLife[i] > 1.1 || trailPos[i * 3 + 2] > camera.position.z - 2.5) trailPos[i * 3 + 1] = 9999;
  }
  trailGeo.attributes.position.needsUpdate = true;

  /* world flow */
  const flow = (26 + F.speed * 34) * dt;
  for (const c of clouds) {
    c.position.z += flow * 0.9;
    if (c.position.z > 30) respawnCloud(c);
    const dCam = c.position.distanceTo(camera.position);
    const dJet = c.position.length();  // jet lives at the origin
    c.material.opacity = 0.16
      * THREE.MathUtils.clamp((dCam - 30) / 30, 0, 1)   // never near the lens
      * THREE.MathUtils.clamp((dJet - 24) / 20, 0, 1);  // never on top of the jet
    // lit by the scene, not flat gray — tint toward the sky's mid color
    c.material.color.copy(SKY.mid).multiplyScalar(2.2).lerp(new THREE.Color(1, 1, 1), 0.25);
  }
  for (let i = 0; i < STREAK_N; i++) {
    streakPos[i * 6 + 2] += flow * 3.2;
    streakPos[i * 6 + 5] += flow * 3.2;
    if (streakPos[i * 6 + 2] > 20) resetStreak(i);
  }
  streakGeo.attributes.position.needsUpdate = true;
  streaks.material.opacity = 0.1 + F.speed * 0.08;

  /* lightning */
  if (F.storm > 0.25 && Math.random() < dt * F.storm * 3.2) spawnBolt();
  for (let i = bolts.length - 1; i >= 0; i--) {
    const b = bolts[i];
    b.life += dt;
    const fade = Math.max(0, 1 - b.life / 0.3);
    b.line.traverse((o) => { if (o.isLine) o.material.opacity = (o.material.userData.isGlow ? 0.3 : 1) * fade; });
    if (b.life > 0.3) {
      scene.remove(b.line);
      b.line.traverse((o) => { if (o.isLine) o.geometry.dispose(); });
      bolts.splice(i, 1);
    }
  }
  boltLight.intensity = Math.max(0, boltLight.intensity - dt * 380);

  /* camera */
  const ce = Math.cos(F.el);
  camera.position.set(
    F.dist * ce * Math.sin(F.az) + pSmooth.x * 0.6,
    F.dist * Math.sin(F.el) + pSmooth.y * -0.4,
    F.dist * ce * Math.cos(F.az)
  );
  look.set(jet.position.x + F.lookX, jet.position.y + F.lookY, 0);
  camera.lookAt(look);

  /* lock-on */
  if (lockEl) {
    if (F.lock > 0.05) {
      projV.copy(jet.position);
      projV.y += 0.2;
      projV.project(camera);
      const sx = (projV.x * 0.5 + 0.5) * innerWidth;
      const sy = (-projV.y * 0.5 + 0.5) * innerHeight;
      const pulse = 1 + Math.sin(t * 6) * 0.04;
      lockEl.style.opacity = F.lock;
      lockEl.style.transform = `translate(${sx}px, ${sy}px) translate(-50%,-50%) scale(${pulse})`;
      lockDist.textContent = (F.dist * 0.108).toFixed(2) + ' NM';
    } else {
      lockEl.style.opacity = 0;
    }
  }

  drawRadar(t);
  bloom.strength = 0.42 + F.burner * 0.07;   // engines glow; copy stays readable
  composer.render();
  requestAnimationFrame(frame);
}
frame();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
});

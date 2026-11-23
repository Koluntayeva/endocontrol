// The AI analyst's robot: a white-ceramic robot built with three.js, shown in the analyst's header.
// mount(el) returns { setMode('idle' | 'thinking' | 'quote'), destroy() }.
// It blinks, follows the pointer, glances around while the analyst thinks and shows a quote
// mark when an answer arrives. Renders only while visible; respects reduced motion.
import * as THREE from './vendor/three/three.module.js';
import { RoundedBoxGeometry } from './vendor/three/RoundedBoxGeometry.js';
import { RoomEnvironment } from './vendor/three/RoomEnvironment.js';

const RING_STOPS = ['#2f6bff', '#7c4dff', '#ff7a1a', '#ffbf1f', '#ff7a1a', '#7c4dff', '#2f6bff'];

function ringTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const x = c.getContext('2d');
  const g = x.createConicGradient(0, 256, 256);
  RING_STOPS.forEach((col, i) => g.addColorStop(i / (RING_STOPS.length - 1), col));
  x.fillStyle = g; x.fillRect(0, 0, 512, 512);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function roundedRect(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

// A rounded-rect frame (outer minus inner), extruded, with UVs spread over its bounds.
function frameGeometry(ow, oh, or, iw, ih, ir, depth, bevel) {
  const shape = roundedRect(ow, oh, or);
  shape.holes.push(roundedRect(iw, ih, ir));
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 16 });
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + ow / 2) / ow, (pos.getY(i) + oh / 2) / oh);
  uv.needsUpdate = true;
  geo.translate(0, 0, -depth / 2);
  return geo;
}

export function mount(el) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch { return null; }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  el.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.9;

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);

  scene.add(new THREE.HemisphereLight(0xfff6ee, 0xd9d2c8, 0.7));
  const key = new THREE.DirectionalLight(0xfff3e6, 1.7); key.position.set(-3, 5, 4);
  key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.radius = 6; key.shadow.bias = -0.0005;
  Object.assign(key.shadow.camera, { left: -3, right: 3, top: 4, bottom: -4 });
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xfff0e6, 1.2); rim.position.set(4, 2, -4); scene.add(rim);
  const fill = new THREE.PointLight(0xff9a6a, 2.2, 6); fill.position.set(-3.2, 1.2, 0.6); scene.add(fill);

  // ---- materials
  const clear = { clearcoat: 0.45, clearcoatRoughness: 0.3 };
  const M = {
    shell: new THREE.MeshPhysicalMaterial({ color: 0xeeebe6, roughness: 0.38, ...clear }),
    light: new THREE.MeshPhysicalMaterial({ color: 0xf8f6f2, roughness: 0.34, ...clear }),
    dark: new THREE.MeshStandardMaterial({ color: 0x1b1b1f, roughness: 0.55, metalness: 0.3 }),
    deep: new THREE.MeshStandardMaterial({ color: 0x0f0f12, roughness: 0.6, metalness: 0.2 }),
    pedestal: new THREE.MeshStandardMaterial({ color: 0x2a2928, roughness: 0.9 }),
  };
  const rt = ringTexture();
  M.ring = new THREE.MeshPhysicalMaterial({ map: rt, emissive: 0xffffff, emissiveMap: rt, emissiveIntensity: 0.22, roughness: 0.5, clearcoat: 0.35 });

  // ---- face screen
  const face = document.createElement('canvas'); face.width = face.height = 512;
  const fx = face.getContext('2d');
  const faceTex = new THREE.CanvasTexture(face); faceTex.colorSpace = THREE.SRGBColorSpace;
  M.screen = new THREE.MeshPhysicalMaterial({ color: 0x050506, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.05, emissive: 0xffffff, emissiveMap: faceTex, emissiveIntensity: 1.6 });

  const mesh = (geo, mat, parent, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  };
  const box = (w, h, d, r) => new RoundedBoxGeometry(w, h, d, 4, r);

  const robot = new THREE.Group(); scene.add(robot);
  const body = new THREE.Group(); robot.add(body);

  // head
  const head = new THREE.Group(); head.position.y = 0.78; body.add(head);
  const skull = new THREE.Group(); skull.position.y = 0.78; head.add(skull);
  mesh(box(1.5, 1.42, 1.3, 0.2), M.shell, skull);
  mesh(box(1.28, 1.14, 0.9, 0.14), M.dark, skull, 0, 0, -0.28);
  for (let i = 0; i < 26; i++) {
    const top = i % 3 === 0, w = 0.06 + ((i * 37) % 10) / 40;
    const bar = mesh(new THREE.BoxGeometry(top ? w : 0.03, 0.02, top ? 0.03 : w), M.deep, skull);
    if (top) bar.position.set(((i * 53) % 100) / 100 - 0.5, 0.72, ((i * 29) % 60) / 100 - 0.55);
    else { bar.geometry = new THREE.BoxGeometry(w, 0.03, 0.02); bar.position.set(((i * 41) % 100) / 100 - 0.5, ((i * 67) % 100) / 100 - 0.5, -0.74); }
  }
  mesh(frameGeometry(1.5, 1.44, 0.3, 1.08, 1.02, 0.2, 0.1, 0.03), M.ring, skull, 0, 0, 0.6);
  mesh(frameGeometry(1.12, 1.06, 0.22, 0.94, 0.88, 0.16, 0.04, 0.01), M.light, skull, 0, 0, 0.62);
  mesh(new THREE.ShapeGeometry(roundedRect(0.9, 0.84, 0.14), 12), M.screen, skull, 0, 0, 0.66).castShadow = false;
  // the screen's UVs come from the shape's coordinates: spread them over 0..1
  { const g = skull.children[skull.children.length - 1].geometry, p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 0.9 + 0.5, p.getY(i) / 0.84 + 0.5); uv.needsUpdate = true; }
  for (const side of [-1, 1]) {
    const ear = mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.16, 32), M.shell, skull, side * 0.82, 0, 0);
    ear.rotation.z = Math.PI / 2;
    const cap = mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.06, 32), M.dark, skull, side * 0.92, 0, 0);
    cap.rotation.z = Math.PI / 2;
  }
  const cable = mesh(new THREE.TorusGeometry(0.34, 0.035, 12, 32, Math.PI), M.dark, skull, 0.95, -0.36, -0.05);
  cable.rotation.set(0, Math.PI / 2, Math.PI / 2);

  // neck and torso
  mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.3, 24), M.dark, body, 0, 0.66, 0);
  mesh(box(1.22, 1.12, 0.92, 0.24), M.shell, body);
  mesh(box(1.0, 0.2, 0.7, 0.08), M.light, body, 0, 0.5, 0.05);
  [0x2f6bff, 0xff7a1a, 0xffbf1f].forEach((c, i) => {
    mesh(new THREE.SphereGeometry(0.04, 16, 12), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.4 }), body, -0.12 + i * 0.12, 0.22, 0.47);
  });
  for (const side of [-1, 1]) {
    mesh(box(0.1, 0.36, 0.06, 0.03), M.dark, body, side * 0.22, -0.12, 0.45);
    const lip = mesh(new THREE.TorusGeometry(0.06, 0.018, 8, 16, Math.PI), M.dark, body, side * 0.22, 0.07, 0.46);
    lip.rotation.z = 0;
  }
  mesh(box(0.9, 0.24, 0.7, 0.1), M.dark, body, 0, -0.66, 0);

  // arms
  const arms = [];
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Group(); shoulder.position.set(side * 0.72, 0.36, 0); shoulder.rotation.z = side * 0.16; body.add(shoulder);
    mesh(new THREE.SphereGeometry(0.15, 24, 16), M.dark, shoulder);
    mesh(box(0.28, 0.52, 0.3, 0.1), M.shell, shoulder, 0, -0.34, 0);
    mesh(new THREE.SphereGeometry(0.11, 20, 14), M.dark, shoulder, 0, -0.64, 0);
    const fore = new THREE.Group(); fore.position.y = -0.64; fore.rotation.x = -0.35; shoulder.add(fore);
    mesh(box(0.3, 0.42, 0.32, 0.12), M.light, fore, 0, -0.3, 0);
    mesh(box(0.08, 0.16, 0.1, 0.03), M.light, fore, -side * 0.16, -0.26, 0.06);
    arms.push({ shoulder, fore, side });
  }

  // legs and pedestal
  for (const side of [-1, 1]) {
    mesh(new THREE.SphereGeometry(0.13, 20, 14), M.dark, body, side * 0.3, -0.84, 0);
    mesh(box(0.34, 0.42, 0.4, 0.1), M.shell, body, side * 0.3, -1.08, 0);
    mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.08, 16), M.dark, body, side * 0.3, -1.32, 0);
    mesh(box(0.4, 0.14, 0.56, 0.06), M.light, body, side * 0.3, -1.42, 0.06);
  }
  const ped = mesh(new THREE.BoxGeometry(1.7, 1.6, 1.7), M.pedestal, robot, 0, -2.29, 0);
  ped.castShadow = false;

  // ---- face drawing
  let mode = 'idle', faceAlpha = 1, blink = 1, nextBlink = performance.now() + 2500, blinkStart = 0, look = 0;
  function drawFace() {
    fx.globalAlpha = 1; fx.fillStyle = '#000'; fx.fillRect(0, 0, 512, 512);
    fx.globalAlpha = faceAlpha; fx.fillStyle = '#fff'; fx.shadowColor = '#fff'; fx.shadowBlur = 18;
    if (mode === 'quote') {
      // Centre the quote mark by its real ink bounds (fonts place it high in the em box).
      fx.font = '900 520px "Arial Black", Arial, sans-serif'; fx.textAlign = 'left'; fx.textBaseline = 'alphabetic';
      const m = fx.measureText('“');
      const w = m.actualBoundingBoxLeft + m.actualBoundingBoxRight, h = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
      fx.fillText('“', 256 - w / 2 + m.actualBoundingBoxLeft, 262 - h / 2 + m.actualBoundingBoxAscent);
    } else {
      const dx = look * 34;
      fx.beginPath(); fx.ellipse(196 + dx, 262, 30, 38 * blink, 0, 0, Math.PI * 2); fx.fill();
      fx.beginPath(); fx.ellipse(316 + dx, 252, 30, 38 * blink, 0, 0, Math.PI * 2); fx.fill();
    }
    fx.shadowBlur = 0;
    faceTex.needsUpdate = true;
  }

  // ---- sizing, pointer, visibility
  function resize() {
    const w = el.clientWidth || 1, h = el.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Fit the robot (head to the top of the pedestal, about 4.4 units) to the box height;
    // pull back on very narrow boxes so the arms stay inside.
    camera.position.z = 8.6 * (w / h < 0.7 ? 1.2 : 1);
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize); ro.observe(el); resize();
  const ptr = { x: 0, y: 0, sx: 0, sy: 0 };
  const onMove = e => { ptr.x = (e.clientX / innerWidth) * 2 - 1; ptr.y = (e.clientY / innerHeight) * 2 - 1; };
  addEventListener('pointermove', onMove, { passive: true });
  let visible = true;
  const io = new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible) loop(); }, { threshold: 0 });
  io.observe(el);

  let raf = 0, last = performance.now(), t = 0, quoteUntil = 0;
  function loop() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(frame);
  }
  // Idle life: the head glances around (the eyes lead), an occasional nod, a wave now and then.
  const ease = (a, b, k) => a + (b - a) * k;
  const gaze = { yaw: 0, pitch: 0, ty: 0.35, tp: 0.05, next: 0 };
  let nodStart = -1e9, nextNod = performance.now() + 5000, waveStart = -1e9, nextWave = performance.now() + 3500, quoteStart = -1e9;
  function frame(now) {
    if (!visible || document.hidden) { raf = 0; return; }
    const dt = Math.min(0.05, (now - last) / 1000); last = now; t += reduce ? 0 : dt;
    ptr.sx += (ptr.x - ptr.sx) * 0.06; ptr.sy += (ptr.y - ptr.sy) * 0.06;

    if (mode === 'quote' && now > quoteUntil) setMode('idle');
    // blink every 2.5–5.5 s, squashing to 10 % over .18 s
    if (!reduce && mode !== 'quote' && now > nextBlink) { blinkStart = now; nextBlink = now + 2500 + Math.random() * 3000; }
    const bp = (now - blinkStart) / 180;
    blink = bp >= 0 && bp <= 1 ? 1 - 0.9 * Math.sin(bp * Math.PI) : 1;
    if (!reduce && now > gaze.next) {
      gaze.ty = (Math.random() * 2 - 1) * 0.75; gaze.tp = -0.12 + Math.random() * 0.32;
      gaze.next = now + 1800 + Math.random() * 2700;
    }
    gaze.yaw = ease(gaze.yaw, gaze.ty, 0.045); gaze.pitch = ease(gaze.pitch, gaze.tp, 0.045);
    look = mode === 'thinking' ? Math.sin(now / 420) * 0.9 : ease(look, Math.max(-1, Math.min(1, gaze.ty / 0.6)), 0.12);
    if (!reduce && mode === 'idle' && now > nextNod) { nodStart = now; nextNod = now + 6000 + Math.random() * 5000; }
    if (!reduce && mode === 'idle' && now > nextWave) { waveStart = now; nextWave = now + 9000 + Math.random() * 6000; }
    if (faceAlpha < 1) faceAlpha = Math.min(1, faceAlpha + 0.05);
    drawFace();

    // camera and pose: the intro framing, head tilted, looking at the user
    camera.position.x = ptr.sx * 0.25; camera.position.y = 0.9 - ptr.sy * 0.1;
    camera.lookAt(0, 0.35, 0);
    const thinking = mode === 'thinking';
    // a happy hop when an answer arrives
    const qp = (now - quoteStart) / 900, hop = qp >= 0 && qp <= 1 ? Math.abs(Math.sin(qp * Math.PI * 2)) * 0.12 * (1 - qp) : 0;
    robot.rotation.y = -0.42 + ptr.sx * 0.12 + Math.sin(t * 0.35) * 0.14;
    body.position.y = Math.sin(t * 1.6) * 0.035 + hop;
    const np = (now - nodStart) / 700, nod = np >= 0 && np <= 1 ? Math.sin(np * Math.PI * 2) * 0.16 : 0;
    const gy = reduce ? 0 : gaze.yaw, gp = reduce ? 0 : gaze.pitch;
    head.rotation.y = (thinking ? -0.15 : -0.3) + gy + ptr.sx * 0.45;
    head.rotation.x = (thinking ? -0.12 : 0.06) + gp + nod + ptr.sy * 0.18 + Math.sin(t * 0.9) * 0.03;
    head.rotation.z = (thinking ? 0.12 : 0.1) - gy * 0.18 + Math.sin(t * 0.7) * 0.05 + (hop ? 0.12 : 0);
    // wave with the right arm for ~1.8 s; the left arm swings
    const wp = (now - waveStart) / 1800, waving = wp >= 0 && wp <= 1, lift = waving ? Math.sin(Math.min(1, wp * 3) * Math.PI / 2) * (wp > 0.8 ? (1 - wp) / 0.2 : 1) : 0;
    for (const a of arms) {
      a.shoulder.rotation.x = Math.sin(t * 1.4 + a.side) * 0.08;
      a.shoulder.rotation.z = a.side * 0.16 + (a.side > 0 ? lift * 2.3 : 0);
      a.fore.rotation.x = -0.35 + Math.sin(t * 1.4 + a.side) * 0.08 + (a.side > 0 ? lift * 0.35 : 0);
      a.fore.rotation.z = a.side > 0 && waving ? Math.sin((now - waveStart) / 1000 * 14) * 0.45 * lift : 0;
    }
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }
  const onVis = () => { if (!document.hidden) { last = performance.now(); loop(); } };
  document.addEventListener('visibilitychange', onVis);

  function setMode(m) {
    if (m === mode) { if (m === 'quote') quoteUntil = performance.now() + 2600; return; }
    mode = m; faceAlpha = 0;
    if (m === 'quote') { quoteUntil = performance.now() + 2600; quoteStart = performance.now(); }
    loop();
  }
  drawFace(); loop();

  return {
    setMode,
    destroy() {
      cancelAnimationFrame(raf); ro.disconnect(); io.disconnect();
      removeEventListener('pointermove', onMove); document.removeEventListener('visibilitychange', onVis);
      renderer.dispose(); pmrem.dispose(); renderer.domElement.remove();
    },
  };
}

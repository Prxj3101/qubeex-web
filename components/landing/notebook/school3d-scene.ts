import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// A floating-island school in soft "toy" style.
//  - school with wings, clock tower (real time), bell, porch, sign, solar panels
//  - kids playing football, on the swing, slide and see-saw, walking in
//  - school bus driving its lane, stopping at the bus stop
//  - waving flag, swaying trees and palms, 2 paper planes with trails,
//    clouds and birds, a little build-up intro
//  - tap anywhere: bell rings, kids jump, confetti
// Framework-free so it can be previewed outside Next.js too.

export interface SchoolScene { dispose: () => void; poke: () => void }

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

const INK = 0x26294a;

function rng(seed: number) {
    return () => {
        seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

type MatOpts = { flat?: boolean; rough?: number; metal?: number; emissive?: number; ei?: number; opacity?: number; side?: THREE.Side };
const matCache = new Map<string, THREE.MeshStandardMaterial>();
function M(color: number, o: MatOpts = {}) {
    const key = `${color}|${o.flat ? 1 : 0}|${o.rough ?? ''}|${o.metal ?? ''}|${o.emissive ?? ''}|${o.ei ?? ''}|${o.opacity ?? ''}|${o.side ?? ''}`;
    let m = matCache.get(key);
    if (!m) {
        m = new THREE.MeshStandardMaterial({
            color, flatShading: !!o.flat, roughness: o.rough ?? 0.8, metalness: o.metal ?? 0,
            emissive: o.emissive ?? 0x000000, emissiveIntensity: o.ei ?? 1,
            transparent: o.opacity !== undefined, opacity: o.opacity ?? 1, side: o.side ?? THREE.FrontSide,
        });
        matCache.set(key, m);
    }
    return m;
}

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, cast = true) {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = cast; m.receiveShadow = true;
    return m;
}
const rbox = (w: number, h: number, d: number, r: number, mat: THREE.Material) =>
    mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2) * 0.999), mat);
const box = (w: number, h: number, d: number, mat: THREE.Material) => mesh(new THREE.BoxGeometry(w, h, d), mat);

function put<T extends THREE.Object3D>(parent: THREE.Object3D, o: T, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0): T {
    o.position.set(x, y, z); o.rotation.set(rx, ry, rz); parent.add(o);
    return o;
}

/* Performance: everything that never moves on its own is merged into a few
   meshes (one per kind of surface), with each part's colour stored per vertex.
   It looks exactly the same, but the GPU draws ~10x fewer pieces per frame.
   Anything in `keep` (and its children) is left alone so it can still animate. */
const bakedMats = new Map<string, THREE.MeshStandardMaterial>();
function bake(root: THREE.Object3D, keep: THREE.Object3D[] = []) {
    root.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
    const keepSet = new Set(keep);
    const buckets = new Map<string, { mat: THREE.MeshStandardMaterial; cast: boolean; geos: THREE.BufferGeometry[] }>();
    const taken: THREE.Mesh[] = [];
    const rel = new THREE.Matrix4();
    const visit = (o: THREE.Object3D) => {
        for (const c of o.children) {
            if (keepSet.has(c)) continue;
            const m = c as THREE.Mesh;
            const mat = m.material as THREE.MeshStandardMaterial;
            if (m.isMesh && !(m as THREE.InstancedMesh).isInstancedMesh && mat && !Array.isArray(mat) && mat.isMeshStandardMaterial && m.geometry.attributes.uv) {
                const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
                for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
                g.applyMatrix4(rel.multiplyMatrices(inv, m.matrixWorld));
                const n = g.attributes.position.count, col = new Float32Array(n * 3);
                for (let i = 0; i < n; i++) { col[i * 3] = mat.color.r; col[i * 3 + 1] = mat.color.g; col[i * 3 + 2] = mat.color.b; }
                g.setAttribute('color', new THREE.BufferAttribute(col, 3));
                const key = [mat.flatShading, mat.roughness, mat.metalness, mat.emissive.getHex(), mat.emissiveIntensity, mat.transparent, mat.opacity, mat.side, mat.map?.uuid ?? '', m.castShadow].join('|');
                let b = buckets.get(key);
                if (!b) {
                    let bm = bakedMats.get(key);
                    if (!bm) {
                        bm = new THREE.MeshStandardMaterial({
                            vertexColors: true, flatShading: mat.flatShading, roughness: mat.roughness, metalness: mat.metalness,
                            emissive: mat.emissive, emissiveIntensity: mat.emissiveIntensity, transparent: mat.transparent,
                            opacity: mat.opacity, side: mat.side, map: mat.map,
                        });
                        bakedMats.set(key, bm);
                    }
                    b = { mat: bm, cast: m.castShadow, geos: [] };
                    buckets.set(key, b);
                }
                b.geos.push(g);
                taken.push(m);
            }
            visit(c);
        }
    };
    visit(root);
    taken.forEach((m) => m.parent?.remove(m));
    buckets.forEach((b) => {
        const merged = mergeGeometries(b.geos, false);
        b.geos.forEach((g) => g.dispose());
        if (!merged) return;
        const mesh = new THREE.Mesh(merged, b.mat);
        mesh.castShadow = b.cast; mesh.receiveShadow = true;
        root.add(mesh);
    });
}

const textures: THREE.Texture[] = [];
function canvasTex(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void) {
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    draw(cv.getContext('2d')!);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    textures.push(t);
    return t;
}

const easeOutBack = (k: number) => { const c = 1.7; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/* ------------------------------------------------------------------ */
/* textures                                                            */
/* ------------------------------------------------------------------ */

function makeTextures() {
    const clock = canvasTex(256, 256, (c) => {
        c.fillStyle = '#FFFDF7'; c.beginPath(); c.arc(128, 128, 124, 0, Math.PI * 2); c.fill();
        c.strokeStyle = '#26294A'; c.lineWidth = 6;
        for (let i = 0; i < 12; i++) {
            const a = (i / 12) * Math.PI * 2;
            const r1 = i % 3 === 0 ? 86 : 96;
            c.beginPath(); c.moveTo(128 + Math.sin(a) * r1, 128 - Math.cos(a) * r1); c.lineTo(128 + Math.sin(a) * 110, 128 - Math.cos(a) * 110); c.stroke();
        }
        c.fillStyle = '#26294A'; c.font = 'bold 34px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText('12', 128, 58); c.fillText('6', 128, 200); c.fillText('3', 200, 130); c.fillText('9', 56, 130);
    });
    const sign = canvasTex(512, 112, (c) => {
        c.fillStyle = '#26294A'; c.fillRect(0, 0, 512, 112);
        c.strokeStyle = '#F6C453'; c.lineWidth = 6; c.strokeRect(8, 8, 496, 96);
        c.fillStyle = '#FFFFFF'; c.font = 'bold 58px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText('SCHOOL', 256, 60);
    });
    const field = canvasTex(512, 360, (c) => {
        for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#86C266' : '#93CC72'; c.fillRect(i * 64, 0, 64, 360); }
        c.strokeStyle = 'rgba(255,255,255,0.95)'; c.lineWidth = 7;
        c.strokeRect(14, 14, 484, 332);
        c.beginPath(); c.moveTo(256, 14); c.lineTo(256, 346); c.stroke();
        c.beginPath(); c.arc(256, 180, 46, 0, Math.PI * 2); c.stroke();
        c.strokeRect(14, 110, 64, 140); c.strokeRect(434, 110, 64, 140);
    });
    const tiles = (base: string, dark: string) => canvasTex(128, 128, (c) => {
        c.fillStyle = base; c.fillRect(0, 0, 128, 128);
        c.strokeStyle = dark; c.lineWidth = 3;
        for (let row = 0; row < 4; row++) {
            const y = row * 32 + 30, off = row % 2 ? 16 : 0;
            c.fillStyle = row % 2 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'; c.fillRect(0, row * 32, 128, 32);
            for (let x = -32 + off; x < 160; x += 32) { c.beginPath(); c.arc(x + 16, y - 14, 16, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke(); }
        }
    });
    const solar = canvasTex(128, 128, (c) => {
        c.fillStyle = '#2D4A8A'; c.fillRect(0, 0, 128, 128);
        c.strokeStyle = '#A9C3F0'; c.lineWidth = 2;
        for (let i = 0; i <= 128; i += 32) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, 128); c.stroke(); c.beginPath(); c.moveTo(0, i); c.lineTo(128, i); c.stroke(); }
    });
    const busText = canvasTex(512, 80, (c) => {
        c.fillStyle = '#26294A'; c.font = 'bold 54px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText('SCHOOL BUS', 256, 42);
    });
    const flag = canvasTex(160, 100, (c) => {
        c.fillStyle = '#2F6FDB'; c.fillRect(0, 0, 160, 100);
        c.fillStyle = '#FFFFFF'; c.beginPath(); c.roundRect(58, 28, 44, 44, 9); c.fill();
        c.fillStyle = '#F6C453'; c.beginPath(); c.roundRect(70, 40, 20, 20, 4); c.fill();
    });
    const paving = canvasTex(128, 128, (c) => {
        c.fillStyle = '#EDE3D1'; c.fillRect(0, 0, 128, 128);
        c.strokeStyle = '#D6C8B0'; c.lineWidth = 3;
        for (let i = 0; i <= 128; i += 32) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, 128); c.stroke(); c.beginPath(); c.moveTo(0, i); c.lineTo(128, i); c.stroke(); }
    });
    for (const t of [paving, solar]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
    return { clock, sign, field, tiles, solar, busText, flag, paving };
}

/* ------------------------------------------------------------------ */
/* people                                                              */
/* ------------------------------------------------------------------ */

type Look = { skin: number; hair: number; top: number; bottom: number; girl?: boolean; bag?: number; tie?: number; adult?: boolean };
type Person = { g: THREE.Group; body: THREE.Group; legL: THREE.Group; legR: THREE.Group; armL: THREE.Group; armR: THREE.Group; jump: number };

const SKIN = [0xe2ad80, 0xc98c5e, 0xa96b45, 0xf0c39a];
const HAIR = [0x1f1a17, 0x2b211c, 0x3a2a22];

function person(l: Look): Person {
    const g = new THREE.Group();
    const body = new THREE.Group(); g.add(body);
    const skin = M(l.skin, { rough: 0.6 }), top = M(l.top, { rough: 0.7 }), bottom = M(l.bottom, { rough: 0.7 });
    const hair = M(l.hair, { rough: 0.5 }), shoe = M(0x2a2a33, { rough: 0.5 });

    const leg = (x: number) => {
        const p = put(body, new THREE.Group(), x, 0.2, 0);
        put(p, mesh(new THREE.CapsuleGeometry(0.032, 0.12, 4, 8), l.girl && !l.adult ? skin : bottom), 0, -0.09, 0);
        put(p, rbox(0.065, 0.045, 0.1, 0.02, shoe), 0, -0.18, 0.015);
        return p;
    };
    const legL = leg(-0.042), legR = leg(0.042);

    if (l.adult) {
        put(body, mesh(new THREE.CylinderGeometry(0.075, 0.12, 0.24, 16), bottom), 0, 0.12, 0);
    } else if (l.girl) {
        put(body, mesh(new THREE.CylinderGeometry(0.07, 0.11, 0.11, 16), bottom), 0, 0.19, 0);
    } else {
        put(body, mesh(new THREE.CylinderGeometry(0.072, 0.078, 0.08, 16), bottom), 0, 0.21, 0);
    }
    put(body, mesh(new THREE.CapsuleGeometry(0.07, 0.1, 4, 12), top), 0, 0.31, 0);
    if (l.tie) put(body, box(0.022, 0.09, 0.012, M(l.tie)), 0, 0.35, 0.068);
    if (l.bag) put(body, rbox(0.12, 0.14, 0.06, 0.025, M(l.bag)), 0, 0.33, -0.085);

    const arm = (x: number) => {
        const p = put(body, new THREE.Group(), x, 0.405, 0);
        put(p, mesh(new THREE.CapsuleGeometry(0.026, 0.11, 4, 8), top), 0, -0.07, 0);
        put(p, mesh(new THREE.SphereGeometry(0.03, 10, 8), skin), 0, -0.15, 0);
        return p;
    };
    const armL = arm(-0.095), armR = arm(0.095);

    const head = put(body, new THREE.Group(), 0, 0.53, 0);
    put(head, mesh(new THREE.SphereGeometry(0.09, 20, 16), skin), 0, 0, 0);
    put(head, mesh(new THREE.SphereGeometry(0.095, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.52), hair), 0, 0.012, -0.008, -0.35);
    const eye = M(0x1b1b22, { rough: 0.3 });
    put(head, mesh(new THREE.SphereGeometry(0.012, 8, 6), eye, false), -0.032, 0.008, 0.083);
    put(head, mesh(new THREE.SphereGeometry(0.012, 8, 6), eye, false), 0.032, 0.008, 0.083);
    const cheek = M(0xf08c8c, { opacity: 0.55 });
    put(head, mesh(new THREE.SphereGeometry(0.014, 8, 6), cheek, false), -0.052, -0.018, 0.072);
    put(head, mesh(new THREE.SphereGeometry(0.014, 8, 6), cheek, false), 0.052, -0.018, 0.072);
    put(head, mesh(new THREE.TorusGeometry(0.02, 0.005, 4, 10, Math.PI), M(0x7a3b2e), false), 0, -0.03, 0.084, 0, 0, Math.PI);
    if (l.girl) {
        if (l.adult) put(head, mesh(new THREE.SphereGeometry(0.045, 12, 10), hair), 0, 0.02, -0.095);
        else {
            put(head, mesh(new THREE.SphereGeometry(0.036, 12, 10), hair), -0.09, -0.02, -0.03);
            put(head, mesh(new THREE.SphereGeometry(0.036, 12, 10), hair), 0.09, -0.02, -0.03);
        }
    }
    [head, legL, legR, armL, armR].forEach((part) => bake(part));
    bake(body, [head, legL, legR, armL, armR]);
    const s = l.adult ? 0.95 : 0.72;
    g.scale.setScalar(s);
    return { g, body, legL, legR, armL, armR, jump: -10 };
}

function walkPose(p: Person, phase: number, amp: number) {
    const s = Math.sin(phase);
    p.legL.rotation.x = s * amp; p.legR.rotation.x = -s * amp;
    p.armL.rotation.x = -s * amp * 0.9; p.armR.rotation.x = s * amp * 0.9;
    p.armL.rotation.z = 0; p.armR.rotation.z = 0;
    p.body.position.y = Math.abs(Math.cos(phase)) * 0.025 * amp;
}
function sitPose(p: Person) {
    p.legL.rotation.x = p.legR.rotation.x = -1.45;
    p.armL.rotation.x = p.armR.rotation.x = -0.7;
}
function wavePose(p: Person, t: number) {
    p.armR.rotation.x = 0;
    p.armR.rotation.z = 2.6 + Math.sin(t * 11) * 0.35;
    p.armL.rotation.z = -0.1;
}

/* ------------------------------------------------------------------ */
/* props                                                               */
/* ------------------------------------------------------------------ */

function roundTree(scale: number, leaf: number) {
    const t = new THREE.Group();
    put(t, mesh(new THREE.CylinderGeometry(0.06, 0.09, 0.5, 7), M(0x8a5a3c, { flat: true })), 0, 0.25, 0);
    const lm = M(leaf, { flat: true });
    put(t, mesh(new THREE.IcosahedronGeometry(0.42, 1), lm), 0, 0.78, 0);
    put(t, mesh(new THREE.IcosahedronGeometry(0.3, 1), lm), 0.22, 0.98, 0.06);
    put(t, mesh(new THREE.IcosahedronGeometry(0.26, 1), lm), -0.2, 0.95, -0.08);
    t.scale.setScalar(scale);
    return t;
}
function pineTree(scale: number) {
    const t = new THREE.Group();
    put(t, mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.3, 6), M(0x7a4e33, { flat: true })), 0, 0.15, 0);
    const lm = M(0x5fae6a, { flat: true });
    [[0.42, 0.5, 0.42], [0.34, 0.45, 0.72], [0.24, 0.4, 0.98]].forEach(([r, h, y]) => put(t, mesh(new THREE.ConeGeometry(r, h, 8), lm), 0, y, 0));
    t.scale.setScalar(scale);
    return t;
}
function palm(scale: number) {
    const t = new THREE.Group();
    const trunkM = M(0xa77a52, { flat: true });
    let y = 0, x = 0;
    for (let i = 0; i < 7; i++) {
        put(t, mesh(new THREE.CylinderGeometry(0.045 - i * 0.002, 0.055 - i * 0.002, 0.2, 7), trunkM), x, y + 0.1, 0, 0, 0, -0.06 * i);
        y += 0.19; x += 0.012 * i;
    }
    const crown = put(t, new THREE.Group(), x, y, 0);
    const leafM = M(0x5aa857, { flat: true, side: THREE.DoubleSide });
    for (let i = 0; i < 7; i++) {
        const leaf = new THREE.Group();
        const geo = new THREE.ConeGeometry(0.09, 0.7, 4, 1);
        geo.translate(0, 0.35, 0);
        geo.scale(1, 1, 0.25);
        put(leaf, mesh(geo, leafM), 0, 0, 0, 0, 0, -1.9);
        leaf.rotation.y = (i / 7) * Math.PI * 2;
        crown.add(leaf);
    }
    const nut = M(0x6b4a2e);
    [0, 2, 4].forEach((i) => put(crown, mesh(new THREE.SphereGeometry(0.05, 8, 6), nut), Math.cos(i) * 0.06, -0.05, Math.sin(i) * 0.06));
    t.scale.setScalar(scale);
    return { t, crown };
}
function bush(scale: number, c: number) {
    const b = new THREE.Group();
    const m = M(c, { flat: true });
    put(b, mesh(new THREE.IcosahedronGeometry(0.2, 1), m), 0, 0.13, 0);
    put(b, mesh(new THREE.IcosahedronGeometry(0.15, 1), m), 0.17, 0.1, 0.03);
    put(b, mesh(new THREE.IcosahedronGeometry(0.14, 1), m), -0.15, 0.09, -0.02);
    b.scale.setScalar(scale);
    return b;
}
function lamp() {
    const l = new THREE.Group();
    const pole = M(0x3a3d4f, { metal: 0.3, rough: 0.5 });
    put(l, mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.9, 8), pole), 0, 0.45, 0);
    put(l, mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.2, 6), pole), 0.08, 0.9, 0, 0, 0, Math.PI / 2);
    put(l, rbox(0.1, 0.05, 0.08, 0.02, M(0xfff1c2, { emissive: 0xffd27a, ei: 0.6 })), 0.17, 0.87, 0);
    return l;
}

function windowUnit(parent: THREE.Object3D, x: number, y: number, z: number, ry: number, lit: boolean, w = 0.22, h = 0.3) {
    const g = put(parent, new THREE.Group(), x, y, z, 0, ry, 0);
    const white = M(0xffffff, { rough: 0.6 });
    put(g, rbox(w + 0.06, h + 0.06, 0.04, 0.012, white));
    put(g, box(w, h, 0.045, lit ? M(0xffe6a8, { emissive: 0xffc76a, ei: 0.55, rough: 0.3 }) : M(0x8ec5f0, { emissive: 0x3d7fc4, ei: 0.22, rough: 0.15, metal: 0.1 })));
    put(g, box(0.016, h, 0.05, white));
    put(g, box(w, 0.016, 0.05, white), 0, h * 0.12, 0);
    put(g, rbox(w + 0.1, 0.035, 0.08, 0.01, M(0xe9dcc6)), 0, -h / 2 - 0.045, 0.02);
}

function gableRoof(W: number, D: number, h: number, wallH: number, tileTex: THREE.Texture, wall: THREE.Material, ridge: number) {
    const g = new THREE.Group();
    const half = D / 2 + 0.1;
    const L = Math.hypot(half, h) + 0.04;
    const ang = Math.atan2(h, D / 2);
    const tex = tileTex.clone(); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(W * 2.6, L * 2.6); tex.needsUpdate = true;
    textures.push(tex);
    const roofM = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75 });
    const slabs: THREE.Mesh[] = [];
    for (const s of [1, -1]) {
        const slab = rbox(W + 0.18, 0.06, L, 0.025, roofM);
        put(g, slab, 0, wallH + h / 2 - 0.01, s * (D / 4 + 0.035), s * ang, 0, 0);
        slabs.push(slab);
    }
    const tri = new THREE.Shape();
    tri.moveTo(-D / 2, 0); tri.lineTo(D / 2, 0); tri.lineTo(0, h); tri.closePath();
    const tg = new THREE.ExtrudeGeometry(tri, { depth: 0.04, bevelEnabled: false });
    for (const s of [1, -1]) put(g, mesh(tg, wall), s * (W / 2) - (s > 0 ? 0.04 : 0), wallH, 0, 0, Math.PI / 2, 0);
    put(g, mesh(new THREE.CylinderGeometry(0.045, 0.045, W + 0.2, 10), M(ridge, { rough: 0.6 })), 0, wallH + h + 0.01, 0, 0, 0, Math.PI / 2);
    return { g, front: slabs[0] };
}

/* ------------------------------------------------------------------ */
/* school                                                              */
/* ------------------------------------------------------------------ */

function buildSchool(tx: ReturnType<typeof makeTextures>) {
    const school = new THREE.Group();
    const wall = M(0xfbe3cf, { rough: 0.85 }), wallTower = M(0xf6d8bf, { rough: 0.85 });
    const trim = M(0xffffff, { rough: 0.6 }), plinth = M(0xcdb79a, { rough: 0.9 });
    const tileA = tx.tiles('#DA7756', '#B9583C'), tileB = tx.tiles('#C9644A', '#A24B33');
    const lit = rng(7);

    // main block
    const W = 2.2, D = 1.3, H = 1.3;
    put(school, rbox(W + 0.12, 0.1, D + 0.12, 0.03, plinth), 0, 0.05, 0);
    put(school, rbox(W, H, D, 0.03, wall), 0, H / 2 + 0.05, 0);
    put(school, rbox(W + 0.05, 0.05, D + 0.05, 0.015, trim), 0, 0.7, 0);
    put(school, rbox(W + 0.08, 0.06, D + 0.08, 0.02, trim), 0, H + 0.05, 0);
    put(school, gableRoof(W, D, 0.5, H + 0.08, tileA, wall, 0xb9583c).g);
    for (const x of [-0.92, -0.62, 0.62, 0.92]) for (const y of [0.4, 1.02]) windowUnit(school, x, y, D / 2 + 0.005, 0, lit() < 0.3);

    // wings
    for (const s of [-1, 1]) {
        const wing = put(school, new THREE.Group(), s * 1.72, 0, -0.1);
        const w = 1.25, d = 1.1, h = 1.2;
        put(wing, rbox(w + 0.12, 0.1, d + 0.12, 0.03, plinth), 0, 0.05, 0);
        put(wing, rbox(w, h, d, 0.03, wall), 0, h / 2 + 0.05, 0);
        put(wing, rbox(w + 0.05, 0.05, d + 0.05, 0.015, trim), 0, 0.66, 0);
        put(wing, rbox(w + 0.08, 0.06, d + 0.08, 0.02, trim), 0, h + 0.05, 0);
        const roof = gableRoof(w, d, 0.42, h + 0.08, tileB, wall, 0xa24b33);
        put(wing, roof.g);
        if (s < 0) {
            // solar panels on the left wing roof
            const sp = new THREE.MeshStandardMaterial({ map: tx.solar, roughness: 0.25, metalness: 0.4 });
            put(roof.front, rbox(0.75, 0.025, 0.42, 0.008, sp), 0, 0.045, 0);
        }
        for (const x of [-0.38, 0, 0.38]) for (const y of [0.36, 0.92]) windowUnit(wing, x, y, d / 2 + 0.005, 0, lit() < 0.3, 0.2, 0.28);
        for (const z of [-0.25, 0.25]) for (const y of [0.36, 0.92]) windowUnit(wing, s * (w / 2 + 0.005), y, z, s * Math.PI / 2, lit() < 0.3, 0.2, 0.28);
    }

    // clock tower
    const tower = put(school, new THREE.Group(), 0, 0, 0.55);
    const TW = 0.85, TD = 0.8, TH = 2.3;
    put(tower, rbox(TW + 0.12, 0.1, TD + 0.12, 0.03, plinth), 0, 0.05, 0);
    put(tower, rbox(TW, TH, TD, 0.03, wallTower), 0, TH / 2 + 0.05, 0);
    for (const y of [0.7, 1.38]) put(tower, rbox(TW + 0.05, 0.05, TD + 0.05, 0.015, trim), 0, y, 0);
    put(tower, rbox(TW + 0.14, 0.08, TD + 0.14, 0.025, trim), 0, TH + 0.06, 0);
    const front = TD / 2;
    // door with arch
    put(tower, rbox(0.5, 0.66, 0.04, 0.015, M(0x7a4e33)), 0, 0.42, front + 0.005);
    for (const x of [-0.105, 0.105]) {
        put(tower, rbox(0.2, 0.58, 0.035, 0.012, M(0xf2b23c, { rough: 0.6 })), x, 0.4, front + 0.02);
        put(tower, mesh(new THREE.SphereGeometry(0.016, 8, 6), M(0xd4a017, { metal: 0.7, rough: 0.3 })), x * 0.35, 0.4, front + 0.045);
    }
    put(tower, box(0.44, 0.07, 0.03, M(0xffe6a8, { emissive: 0xffc76a, ei: 0.4 })), 0, 0.71, front + 0.02);
    // porch
    for (const x of [-0.34, 0.34]) put(tower, mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.72, 12), trim), x, 0.45, front + 0.38);
    put(tower, rbox(0.92, 0.07, 0.5, 0.02, trim), 0, 0.83, front + 0.22);
    const ped = new THREE.Shape(); ped.moveTo(-0.46, 0); ped.lineTo(0.46, 0); ped.lineTo(0, 0.18); ped.closePath();
    const pg = new THREE.ExtrudeGeometry(ped, { depth: 0.46, bevelEnabled: false }); pg.translate(0, 0, -0.23);
    put(tower, mesh(pg, M(0xda7756, { rough: 0.7 })), 0, 0.865, front + 0.22);
    for (let i = 0; i < 3; i++) put(tower, rbox(0.8 - i * 0.08, 0.05, 0.16, 0.012, M(0xe6dccb)), 0, 0.025 + i * 0.05, front + 0.6 - i * 0.08);
    // sign
    put(tower, rbox(0.74, 0.17, 0.03, 0.01, M(0x26294a)), 0, 1.2, front + 0.01);
    put(tower, mesh(new THREE.PlaneGeometry(0.7, 0.14), new THREE.MeshStandardMaterial({ map: tx.sign, roughness: 0.5 }), false), 0, 1.2, front + 0.027);
    windowUnit(tower, 0, 1.6, front + 0.005, 0, false, 0.22, 0.26);
    // clock
    put(tower, mesh(new THREE.CircleGeometry(0.22, 40), new THREE.MeshStandardMaterial({ map: tx.clock, roughness: 0.4 }), false), 0, 2.06, front + 0.018);
    put(tower, mesh(new THREE.TorusGeometry(0.225, 0.028, 10, 40), M(0xd4a017, { metal: 0.6, rough: 0.35 })), 0, 2.06, front + 0.02);
    const hourHand = put(tower, new THREE.Group(), 0, 2.06, front + 0.03);
    put(hourHand, box(0.028, 0.12, 0.012, M(INK)), 0, 0.055, 0);
    const minHand = put(tower, new THREE.Group(), 0, 2.06, front + 0.038);
    put(minHand, box(0.02, 0.18, 0.012, M(0xb9583c)), 0, 0.085, 0);
    // belfry + bell
    for (const x of [-0.36, 0.36]) for (const z of [-0.33, 0.33]) put(tower, rbox(0.08, 0.46, 0.08, 0.02, trim), x, TH + 0.33, z);
    const bell = put(tower, new THREE.Group(), 0, TH + 0.52, 0);
    const pts = [new THREE.Vector2(0.001, 0), new THREE.Vector2(0.05, -0.01), new THREE.Vector2(0.07, -0.06), new THREE.Vector2(0.08, -0.14), new THREE.Vector2(0.12, -0.2), new THREE.Vector2(0.001, -0.2)];
    put(bell, mesh(new THREE.LatheGeometry(pts, 20), M(0xe0a92e, { metal: 0.7, rough: 0.3 })));
    put(bell, mesh(new THREE.SphereGeometry(0.03, 8, 6), M(0x8a6a2a, { metal: 0.6 })), 0, -0.2, 0);
    put(tower, rbox(TW + 0.1, 0.06, TD + 0.1, 0.02, trim), 0, TH + 0.58, 0);
    const cone = put(tower, mesh(new THREE.ConeGeometry(0.68, 0.78, 4), M(0xc9644a, { flat: true, rough: 0.7 })), 0, TH + 1.0, 0);
    cone.rotation.y = Math.PI / 4;
    put(tower, mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 6), M(0xd4a017, { metal: 0.6 })), 0, TH + 1.48, 0);
    put(tower, mesh(new THREE.SphereGeometry(0.045, 12, 10), M(0xe0a92e, { metal: 0.7, rough: 0.3 })), 0, TH + 1.42, 0);

    return { school, hourHand, minHand, bell };
}

/* ------------------------------------------------------------------ */
/* bus                                                                 */
/* ------------------------------------------------------------------ */

function buildBus(tx: ReturnType<typeof makeTextures>) {
    const bus = new THREE.Group();
    const yellow = M(0xf6c12f, { rough: 0.45 }), black = M(0x23242c, { rough: 0.6 });
    put(bus, rbox(1.06, 0.06, 0.38, 0.02, black), 0, 0.12, 0);
    put(bus, rbox(1.0, 0.2, 0.42, 0.04, yellow), -0.05, 0.24, 0);
    put(bus, rbox(0.26, 0.17, 0.38, 0.05, yellow), 0.55, 0.215, 0);
    put(bus, rbox(0.02, 0.09, 0.22, 0.008, M(0x4a4d5a)), 0.682, 0.21, 0);
    for (const z of [-0.13, 0.13]) put(bus, mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.02, 12), M(0xfff6d0, { emissive: 0xfff0b0, ei: 0.8 })), 0.683, 0.25, z, 0, 0, Math.PI / 2);
    put(bus, rbox(0.04, 0.05, 0.44, 0.015, black), 0.7, 0.12, 0);
    put(bus, rbox(0.04, 0.05, 0.44, 0.015, black), -0.57, 0.12, 0);
    for (const z of [-0.14, 0.14]) put(bus, box(0.01, 0.04, 0.05, M(0xe5484d, { emissive: 0xa01010, ei: 0.4 })), -0.556, 0.27, z);
    for (const y of [0.29, 0.325]) put(bus, box(1.005, 0.013, 0.425, black), -0.05, y, 0);
    // window band: glass + pillars, kids inside
    put(bus, box(0.96, 0.14, 0.4, new THREE.MeshStandardMaterial({ color: 0xbfe0f8, transparent: true, opacity: 0.35, roughness: 0.1 })), -0.05, 0.41, 0).castShadow = false;
    for (let x = -0.53; x <= 0.44; x += 0.162) put(bus, box(0.03, 0.15, 0.425, yellow), x, 0.41, 0);
    put(bus, rbox(1.03, 0.06, 0.44, 0.03, yellow), -0.05, 0.5, 0);
    const amber: THREE.MeshStandardMaterial[] = [];
    const amberMeshes: THREE.Mesh[] = [];
    for (const x of [0.42, -0.52]) for (const z of [-0.12, 0.12]) {
        const m = new THREE.MeshStandardMaterial({ color: 0xf2994a, emissive: 0xff8a1a, emissiveIntensity: 0, roughness: 0.4 });
        amber.push(m);
        amberMeshes.push(put(bus, rbox(0.05, 0.03, 0.05, 0.01, m), x, 0.54, z));
    }
    const heads = rng(3);
    for (let x = -0.45; x < 0.3; x += 0.162) for (const z of [-0.1, 0.1]) {
        if (heads() < 0.2) continue;
        put(bus, mesh(new THREE.SphereGeometry(0.045, 12, 10), M(SKIN[Math.floor(heads() * 4)], { rough: 0.6 })), x + 0.08, 0.385, z);
        put(bus, mesh(new THREE.SphereGeometry(0.047, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), M(HAIR[Math.floor(heads() * 3)])), x + 0.08, 0.392, z);
    }
    put(bus, mesh(new THREE.SphereGeometry(0.045, 12, 10), M(0xc98c5e)), 0.36, 0.385, -0.1);
    put(bus, mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 12), M(0x2f3a68)), 0.36, 0.43, -0.1);
    // sides: text + stop arm + mirrors
    const txtM = new THREE.MeshBasicMaterial({ map: tx.busText, transparent: true });
    put(bus, mesh(new THREE.PlaneGeometry(0.62, 0.1), txtM, false), -0.08, 0.21, 0.2115);
    put(bus, mesh(new THREE.PlaneGeometry(0.62, 0.1), txtM, false), -0.08, 0.21, -0.2115, 0, Math.PI, 0);
    const stopArm = put(bus, new THREE.Group(), 0.3, 0.3, 0.215);
    put(stopArm, mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.012, 8), M(0xe5484d, { rough: 0.5 })), 0.06, 0, 0, Math.PI / 2, 0, 0);
    for (const z of [-0.25, 0.25]) {
        put(bus, box(0.012, 0.012, 0.06, black), 0.62, 0.33, z * 0.9);
        put(bus, rbox(0.02, 0.07, 0.04, 0.008, black), 0.63, 0.31, z);
    }
    const wheels: THREE.Group[] = [];
    for (const x of [-0.34, 0.44]) for (const z of [-0.19, 0.19]) {
        const w = put(bus, new THREE.Group(), x, 0.09, z);
        put(w, mesh(new THREE.CylinderGeometry(0.088, 0.088, 0.07, 18), M(0x1c1d24, { rough: 0.8 })), 0, 0, 0, Math.PI / 2, 0, 0);
        put(w, mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.075, 6), M(0xd9d4cb, { metal: 0.5, rough: 0.35 })), 0, 0, 0, Math.PI / 2, 0, 0);
        wheels.push(w);
    }
    wheels.forEach((w) => bake(w));
    bake(bus, [stopArm, ...wheels, ...amberMeshes]);
    return { bus, wheels, amber, stopArm };
}

/* ------------------------------------------------------------------ */
/* paper plane, cloud, bird                                            */
/* ------------------------------------------------------------------ */

function paperPlane(color: number) {
    const g = new THREE.BufferGeometry();
    const N = [0.5, 0, 0], L = [-0.32, 0.08, 0.32], C = [-0.32, 0, 0], R = [-0.32, 0.08, -0.32], K = [-0.32, -0.13, 0];
    g.setAttribute('position', new THREE.Float32BufferAttribute([...N, ...L, ...C, ...N, ...C, ...R, ...N, ...C, ...K], 3));
    g.computeVertexNormals();
    const p = new THREE.Group();
    const m = mesh(g, new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, roughness: 0.6 }));
    p.add(m);
    p.add(new THREE.LineSegments(new THREE.EdgesGeometry(g), new THREE.LineBasicMaterial({ color: INK })));
    p.scale.setScalar(0.95);
    return p;
}
function cloud(scale: number) {
    const c = new THREE.Group();
    const m = M(0xffffff, { rough: 1, emissive: 0xdde9f7, ei: 0.25 });
    [[0, 0, 0, 0.5], [0.5, -0.08, 0.05, 0.38], [-0.48, -0.1, 0, 0.36], [0.2, 0.25, -0.05, 0.36], [-0.2, 0.18, 0.08, 0.3], [0.85, -0.16, 0, 0.24]].forEach(([x, y, z, r]) => {
        put(c, mesh(new THREE.SphereGeometry(r, 18, 14), m, false), x, y, z);
    });
    c.scale.set(scale, scale * 0.85, scale);
    return c;
}
function bird() {
    const b = new THREE.Group();
    const m = M(0x3a3d55, { side: THREE.DoubleSide });
    put(b, mesh(new THREE.SphereGeometry(0.04, 8, 6), m, false)).scale.set(1, 1.3, 1);
    // wings spread left/right on screen and flap up/down, so it reads as a "V"
    const wingGeo = (s: number) => {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0.035, 0, 0, -0.025, 0, 0.34 * s, 0.05, 0], 3));
        g.computeVertexNormals();
        return g;
    };
    const wl = put(b, mesh(wingGeo(1), m, false));
    const wr = put(b, mesh(wingGeo(-1), m, false));
    return { b, wl, wr };
}

/* ------------------------------------------------------------------ */
/* scene                                                               */
/* ------------------------------------------------------------------ */

export function createSchoolScene(container: HTMLElement, opts: { still?: boolean } = {}): SchoolScene {
    const still = !!opts.still;
    const tx = makeTextures();
    const R = rng(42);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 120);
    const target = new THREE.Vector3(0, 0.75, 0);
    const camDir = new THREE.Vector3(9.5, 6.6, 12).normalize();
    scene.add(camera);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.style.cursor = 'pointer';
    container.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xfff4e6, 0xa7b59a, 1.45));
    const sun = new THREE.DirectionalLight(0xfff0d8, 2.7);
    sun.position.set(6, 10, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 1, far: 30 });
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.02;
    scene.add(sun);
    const rim = new THREE.DirectionalLight(0xcfe0ff, 0.7);
    rim.position.set(-7, 4, -5);
    scene.add(rim);

    const world = new THREE.Group();
    scene.add(world);

    /* island */
    const isl = new THREE.Group(); world.add(isl);
    put(isl, mesh(new THREE.CylinderGeometry(5.2, 5.2, 0.3, 80), M(0xb4da95, { rough: 0.95 }), false), 0, 0.02, 0);
    put(isl, mesh(new THREE.CylinderGeometry(5.26, 5.2, 0.12, 80), M(0x93c574, { rough: 0.95 })), 0, -0.17, 0);
    put(isl, mesh(new THREE.CylinderGeometry(5.15, 4.3, 0.8, 28), M(0xc88b5d, { flat: true })), 0, -0.63, 0);
    put(isl, mesh(new THREE.CylinderGeometry(4.3, 2.6, 0.9, 24), M(0xa86f47, { flat: true })), 0, -1.48, 0);
    put(isl, mesh(new THREE.ConeGeometry(2.6, 1.7, 14), M(0x8f6a52, { flat: true })), 0, -2.78, 0, Math.PI, 0, 0);
    const rockC = [0x9c7457, 0x8a6a50, 0xb08562, 0x8d8f96];
    for (let i = 0; i < 26; i++) {
        const a = R() * Math.PI * 2, y = -0.4 - R() * 2.2;
        const r = y > -1.03 ? 5.15 - (-(y + 0.23) / 0.8) * 0.85 : y > -1.93 ? 4.3 - (-(y + 1.03) / 0.9) * 1.7 : 2.4;
        const rock = mesh(new THREE.DodecahedronGeometry(0.22 + R() * 0.35, 0), M(rockC[i % 4], { flat: true }));
        put(isl, rock, Math.cos(a) * r, y, Math.sin(a) * r, R() * 3, R() * 3, R() * 3);
    }
    for (let i = 0; i < 8; i++) {
        const a = R() * Math.PI * 2, r = 2.5 + R() * 1.6, len = 0.4 + R() * 0.7;
        put(isl, mesh(new THREE.CylinderGeometry(0.02, 0.035, len, 5), M(0x7a5a3a, { flat: true })), Math.cos(a) * r, -1.0 - len / 2 - R() * 0.5, Math.sin(a) * r, R() * 0.4 - 0.2, 0, R() * 0.4 - 0.2);
    }
    for (let i = 0; i < 26; i++) {
        const a = R() * Math.PI * 2, r = 0.6 + R() * 4.4;
        if (r > 3.8 && r < 4.8) continue;
        put(isl, mesh(new THREE.CircleGeometry(0.25 + R() * 0.4, 14), M(R() < 0.5 ? 0xa8d38a : 0xc0e2a4, { rough: 1 }), false), Math.cos(a) * r, 0.172, Math.sin(a) * r, -Math.PI / 2, 0, 0);
    }

    /* campus: everything on the ground, turned a little toward the camera */
    const campus = put(world, new THREE.Group(), 0, 0.17, 0, 0, 0.3, 0);

    // ring road
    put(campus, mesh(new THREE.RingGeometry(3.92, 4.68, 96), M(0x55585f, { rough: 0.95 }), false), 0, 0.006, 0, -Math.PI / 2, 0, 0);
    for (const [a, b] of [[3.97, 4.0], [4.6, 4.63]]) put(campus, mesh(new THREE.RingGeometry(a, b, 96), M(0xf4f1ea), false), 0, 0.009, 0, -Math.PI / 2, 0, 0);
    const kerbN = 120, kerb = new THREE.InstancedMesh(new THREE.BoxGeometry(0.2, 0.05, 0.06), M(0xffffff, { rough: 0.7 }), kerbN * 2);
    const dashN = 54, dash = new THREE.InstancedMesh(new THREE.BoxGeometry(0.22, 0.006, 0.045), M(0xffffff), dashN);
    const tmp = new THREE.Object3D(), col = new THREE.Color();
    for (let i = 0; i < kerbN * 2; i++) {
        const outer = i >= kerbN, k = i % kerbN, a = (k / kerbN) * Math.PI * 2, r = outer ? 4.71 : 3.89;
        tmp.position.set(Math.cos(a) * r, 0.025, Math.sin(a) * r); tmp.rotation.set(0, -a + Math.PI / 2, 0); tmp.updateMatrix();
        kerb.setMatrixAt(i, tmp.matrix); kerb.setColorAt(i, col.set(k % 2 ? 0x2f3242 : 0xf2c94c));
    }
    for (let i = 0; i < dashN; i++) {
        const a = (i / dashN) * Math.PI * 2;
        tmp.position.set(Math.cos(a) * 4.3, 0.011, Math.sin(a) * 4.3); tmp.rotation.set(0, -a + Math.PI / 2, 0); tmp.updateMatrix();
        dash.setMatrixAt(i, tmp.matrix);
    }
    kerb.receiveShadow = true; campus.add(kerb, dash);
    for (let i = 0; i < 6; i++) put(campus, box(0.07, 0.006, 0.3, M(0xffffff)), -0.3 + i * 0.12, 0.012, 4.3);

    // school
    const { school, hourHand, minHand, bell } = buildSchool(tx);
    put(campus, school, 0, 0, -1.75);
    school.scale.setScalar(1.25);

    // courtyard, path, beds, benches, hedges
    const pave = tx.paving.clone(); pave.repeat.set(5, 2); pave.needsUpdate = true; textures.push(pave);
    put(campus, rbox(2.6, 0.03, 1.1, 0.03, new THREE.MeshStandardMaterial({ map: pave, roughness: 0.9 })), 0, 0.015, 0.75);
    for (let z = 1.32, i = 0; z < 3.8; z += 0.27, i++) put(campus, mesh(new THREE.CylinderGeometry(0.12, 0.13, 0.03, 12), M(0xe9e1d2, { flat: true })), i % 2 ? 0.07 : -0.07, 0.015, z);
    for (const s of [-1, 1]) {
        put(campus, rbox(0.14, 0.18, 1.0, 0.06, M(0x6fae5c, { rough: 0.9 })), s * 1.4, 0.09, 0.75);
        put(campus, rbox(1.0, 0.06, 0.2, 0.02, M(0x8a5a3c)), s * 2.15, 0.03, -1.0);
        for (let i = 0; i < 7; i++) {
            put(campus, mesh(new THREE.SphereGeometry(0.035, 8, 6), M([0xf6c453, 0xe8637a, 0xffffff, 0xb57cf0][i % 4])), s * 2.15 - 0.42 + i * 0.14, 0.09, -1.0 + (i % 2 ? 0.04 : -0.04));
        }
        const bench = put(campus, new THREE.Group(), s * 0.8, 0, 1.05, 0, 0, 0);
        put(bench, rbox(0.42, 0.04, 0.14, 0.01, M(0xc77b4a)), 0, 0.14, 0);
        put(bench, rbox(0.42, 0.1, 0.03, 0.01, M(0xc77b4a)), 0, 0.22, -0.06);
        for (const x of [-0.17, 0.17]) put(bench, box(0.03, 0.14, 0.12, M(0x3a3d4f)), x, 0.07, 0);
    }

    // flag
    put(campus, rbox(0.2, 0.08, 0.2, 0.02, M(0xd9d4cb)), 1.2, 0.04, 1.0);
    put(campus, mesh(new THREE.CylinderGeometry(0.025, 0.032, 2.5, 10), M(0xe4e0d8, { metal: 0.4, rough: 0.4 })), 1.2, 1.3, 1.0);
    put(campus, mesh(new THREE.SphereGeometry(0.045, 12, 10), M(0xe0a92e, { metal: 0.7, rough: 0.3 })), 1.2, 2.57, 1.0);
    const flagGeo = new THREE.PlaneGeometry(0.78, 0.48, 20, 8); flagGeo.translate(0.39, 0, 0);
    const flagBase = Float32Array.from(flagGeo.attributes.position.array as Float32Array);
    const flag = put(campus, mesh(flagGeo, new THREE.MeshStandardMaterial({ map: tx.flag, side: THREE.DoubleSide, roughness: 0.8 })), 1.225, 2.25, 1.0);

    // football field
    const field = put(campus, new THREE.Group(), -1.85, 0, 1.45);
    put(field, rbox(1.5, 0.02, 1.05, 0.01, new THREE.MeshStandardMaterial({ map: tx.field, roughness: 0.95 })), 0, 0.012, 0);
    const postM = M(0xffffff, { rough: 0.5 });
    for (const s of [-1, 1]) {
        for (const z of [-0.17, 0.17]) put(field, mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 6), postM), s * 0.74, 0.11, z);
        put(field, mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.35, 6), postM), s * 0.74, 0.22, 0, Math.PI / 2, 0, 0);
        put(field, box(0.12, 0.2, 0.34, new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.25 })), s * 0.8, 0.11, 0).castShadow = false;
    }
    const ballTex = canvasTex(64, 32, (c) => { c.fillStyle = '#fff'; c.fillRect(0, 0, 64, 32); c.fillStyle = '#222'; for (let i = 0; i < 6; i++) { c.beginPath(); c.arc(6 + i * 11, i % 2 ? 10 : 22, 4, 0, 7); c.fill(); } });
    const ball = put(field, mesh(new THREE.SphereGeometry(0.045, 16, 12), new THREE.MeshStandardMaterial({ map: ballTex, roughness: 0.5 })), 0, 0.06, 0);

    // swing
    const swingG = put(campus, new THREE.Group(), 2.2, 0, 0.8, 0, -0.5, 0);
    const swingM = M(0xe8637a, { rough: 0.5 });
    for (const x of [-0.42, 0.42]) for (const z of [-0.2, 0.2]) put(swingG, mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.95, 8), swingM), x, 0.45, z * 0.55, z > 0 ? -0.38 : 0.38, 0, 0);
    put(swingG, mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.9, 8), swingM), 0, 0.9, 0, 0, 0, Math.PI / 2);
    const swing = put(swingG, new THREE.Group(), 0, 0.9, 0);
    for (const x of [-0.1, 0.1]) put(swing, mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.62, 4), M(0x8a7f70)), x, -0.31, 0);
    put(swing, rbox(0.26, 0.025, 0.11, 0.01, M(0x8a5a3c)), 0, -0.62, 0);

    // slide
    const slideG = put(campus, new THREE.Group(), 1.85, 0, 1.95, 0, 0.9, 0);
    const slideM = M(0x5b8def, { rough: 0.4 }), railM = M(0xf6c453, { rough: 0.5 });
    for (const x of [-0.08, 0.08]) put(slideG, mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.6, 6), railM), x, 0.3, -0.05);
    for (let i = 1; i < 5; i++) put(slideG, mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.16, 6), railM), 0, i * 0.11, -0.05, 0, 0, Math.PI / 2);
    put(slideG, rbox(0.22, 0.03, 0.18, 0.01, railM), 0, 0.56, 0.04);
    const slope = put(slideG, rbox(0.2, 0.025, 0.78, 0.01, slideM), 0, 0.31, 0.43);
    slope.rotation.x = 0.72;

    // see-saw
    const sawG = put(campus, new THREE.Group(), 0.75, 0, 2.95, 0, 0.6, 0);
    put(sawG, mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.14, 8), M(0x47b39c)), 0, 0.07, 0);
    const plank = put(sawG, new THREE.Group(), 0, 0.15, 0);
    put(plank, rbox(0.9, 0.03, 0.08, 0.01, M(0xf2a93b)), 0, 0, 0);

    // trees inside the ring
    const sway: THREE.Object3D[] = [];
    [[-0.9, -2.95, 1.0, 0x7fc46a], [1.0, -3.0, 0.9, 0x93cf6e], [2.95, -0.45, 0.85, 0x6bb35e], [-2.95, -0.55, 0.95, 0x93cf6e]].forEach(([x, z, s, c]) => sway.push(put(campus, roundTree(s, c), x, 0, z)));
    sway.push(put(campus, pineTree(0.95), 0.05, 0, -3.2));
    const palms = [put(campus, palm(1.0).t, -2.95, 0, 0.5), put(campus, palm(0.9).t, 2.95, 0, 0.45)];
    palms.forEach((p) => sway.push(p));

    // outside the ring: trees at the back, bushes at the front, lamps
    const STOP_A = 1.42;
    for (let i = 0; i < 26; i++) {
        const a = (i / 26) * Math.PI * 2 + 0.05;
        if (Math.abs(((a - STOP_A + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < 0.35) continue;
        const r = 4.95, x = Math.cos(a) * r, z = Math.sin(a) * r;
        if (z < -0.5 && i % 2 === 0) sway.push(put(campus, i % 4 === 0 ? pineTree(0.6) : roundTree(0.55, [0x7fc46a, 0x93cf6e, 0x6bb35e][i % 3]), x, 0, z));
        else put(campus, bush(0.7 + R() * 0.4, [0x6fae5c, 0x83c26a][i % 2]), x, 0, z);
    }
    [0.6, 2.35, 3.3, 4.3, 5.4].forEach((a) => put(campus, lamp(), Math.cos(a) * 4.82, 0, Math.sin(a) * 4.82, 0, -a + Math.PI, 0));

    // bus stop shelter
    const stopFace = Math.atan2(-Math.cos(STOP_A), -Math.sin(STOP_A));
    const shelter = put(campus, new THREE.Group(), Math.cos(STOP_A + 0.06) * 5.0, 0, Math.sin(STOP_A + 0.06) * 5.0, 0, stopFace, 0);
    put(shelter, rbox(0.62, 0.36, 0.025, 0.01, new THREE.MeshStandardMaterial({ color: 0xbfe0f8, transparent: true, opacity: 0.5 })), 0, 0.3, -0.1).castShadow = false;
    for (const x of [-0.3, 0.3]) put(shelter, mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.5, 6), M(0x3a3d4f)), x, 0.25, -0.1);
    put(shelter, rbox(0.72, 0.04, 0.3, 0.015, M(0xda7756)), 0, 0.52, -0.02, -0.1, 0, 0);
    put(shelter, rbox(0.5, 0.035, 0.1, 0.01, M(0x8a5a3c)), 0, 0.13, -0.05);
    put(shelter, mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.6, 6), M(0x3a3d4f)), 0.45, 0.3, 0.05);
    put(shelter, mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.015, 20), M(0x0d9488)), 0.45, 0.63, 0.05, Math.PI / 2, 0, 0);

    /* people */
    const uni = (i: number, girl: boolean): Look => ({ skin: SKIN[i % 4], hair: HAIR[i % 3], top: 0xf7f6f0, bottom: girl ? 0x2f3a68 : 0x3b4a7a, girl, tie: 0xc2413b, bag: [0xda7756, 0x5b8def, 0x47b39c, 0xf2a93b][i % 4] });
    const people: Person[] = [];
    const mk = (l: Look, parent: THREE.Object3D, x: number, z: number, ry = 0) => {
        const p = person(l); put(parent, p.g, x, 0, z, 0, ry, 0); people.push(p); return p;
    };
    // football
    const players = [
        mk({ skin: SKIN[1], hair: HAIR[0], top: 0xe8637a, bottom: 0xffffff }, field, -0.3, 0.1),
        mk({ skin: SKIN[2], hair: HAIR[1], top: 0x5b8def, bottom: 0xffffff }, field, 0.3, -0.2),
        mk({ skin: SKIN[0], hair: HAIR[2], top: 0xe8637a, bottom: 0xffffff, girl: true }, field, 0.1, 0.3),
    ];
    const pv = players.map(() => new THREE.Vector2());
    // swing / see-saw / slide
    const swinger = mk(uni(1, true), swing, 0, 0, 0); swinger.g.position.y = -0.74; sitPose(swinger);
    const sawKids = [mk(uni(2, false), plank, -0.38, 0, Math.PI / 2), mk(uni(3, true), plank, 0.38, 0, -Math.PI / 2)];
    sawKids.forEach((k) => { k.g.position.y = -0.125; sitPose(k); });
    const slider = mk(uni(0, false), slideG, 0, 0, 0);
    // walkers on the path
    const walkers = [mk(uni(2, true), campus, -0.11, 3.6, Math.PI), mk(uni(3, false), campus, 0.12, 3.6, Math.PI)];
    // waiting at the bus stop
    const waiting = [0, 1].map((i) => mk(uni(i + 1, i === 0), campus, Math.cos(STOP_A - 0.05 + i * 0.07) * 4.84, Math.sin(STOP_A - 0.05 + i * 0.07) * 4.84, stopFace));
    // teacher at the door
    const boarded = [false, false];
    const teacher = mk({ skin: SKIN[1], hair: HAIR[0], top: 0xc94f7c, bottom: 0xc94f7c, girl: true, adult: true }, campus, 0.62, 0.08, 0.2);

    /* bus */
    const { bus, wheels, amber, stopArm } = buildBus(tx);
    campus.add(bus);
    const puffs = Array.from({ length: 10 }, () => {
        const p = mesh(new THREE.SphereGeometry(0.05, 10, 8), new THREE.MeshStandardMaterial({ color: 0xd8d4cc, transparent: true, opacity: 0, roughness: 1 }), false);
        campus.add(p); return { p, life: 0 };
    });

    /* paper planes with dashed trails */
    const planes = [paperPlane(0xffffff), paperPlane(0xfff2b3)].map((p, i) => {
        world.add(p);
        const N = 46, pos = new Float32Array(N * 3);
        const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const line = new THREE.Line(geo, new THREE.LineDashedMaterial({ color: INK, dashSize: 0.09, gapSize: 0.08, transparent: true, opacity: 0.55 }));
        line.frustumCulled = false;
        world.add(line);
        return { p, line, pos, N, i, filled: false };
    });

    /* clouds + birds ride with the camera so they always sit in the sky */
    const sky = new THREE.Group(); camera.add(sky);
    const clouds = [
        { c: cloud(1.25), x: -5.2, y: 3.4, z: -20 }, { c: cloud(0.95), x: 4.6, y: 4.3, z: -21 },
        { c: cloud(0.7), x: 0.8, y: 5.0, z: -24 }, { c: cloud(0.85), x: 7.5, y: 1.9, z: -22 }, { c: cloud(0.6), x: -7.2, y: 5.2, z: -24 },
    ];
    clouds.forEach((k) => put(sky, k.c, k.x, k.y, k.z));
    const birds = [0, 1, 2].map((i) => { const b = bird(); sky.add(b.b); return { ...b, i }; });

    /* confetti */
    const CN = 110;
    const conf = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.06, 0.1), new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.6 }), CN);
    const cp = Array.from({ length: CN }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler(), rv: new THREE.Vector3(), life: 0 }));
    const confC = [0xda7756, 0xf6c453, 0x5b8def, 0x47b39c, 0xe8637a, 0xb57cf0];
    for (let i = 0; i < CN; i++) { conf.setColorAt(i, col.set(confC[i % confC.length])); tmp.scale.setScalar(0); tmp.updateMatrix(); conf.setMatrixAt(i, tmp.matrix); }
    conf.frustumCulled = false;
    campus.add(conf);

    /* intro build-up */
    /* merge everything that does not move (see bake) */
    bake(isl);
    bake(school, [hourHand, minHand, bell]);
    bake(field, [ball, ...players.map((p) => p.g)]);
    bake(swing, [swinger.g]);
    bake(swingG, [swing]);
    bake(plank, sawKids.map((p) => p.g));
    bake(sawG, [plank]);
    bake(slideG, [slider.g]);
    bake(shelter);
    sway.forEach((t) => bake(t));
    bake(campus, [school, field, swingG, slideG, sawG, shelter, flag, bus, conf, kerb, dash, ...sway, ...people.map((p) => p.g), ...puffs.map((q) => q.p)]);

    const pops: { o: THREE.Object3D; d: number; base: THREE.Vector3 }[] = [];
    const pop = (o: THREE.Object3D, d: number) => { pops.push({ o, d, base: o.scale.clone() }); o.scale.setScalar(0.0001); };
    pop(school, 0.5);
    sway.forEach((o, i) => pop(o, 0.9 + i * 0.05));
    [field, swingG, slideG, sawG, shelter, flag, bus].forEach((o, i) => pop(o, 1.2 + i * 0.08));
    people.forEach((p, i) => pop(p.g, 1.6 + i * 0.05));
    let introDone = still;
    if (still) pops.forEach((k) => k.o.scale.copy(k.base));

    /* sizing: keep the whole island in frame for any aspect */
    const resize = () => {
        const w = container.clientWidth, h = container.clientHeight || w;
        renderer.setSize(w, h, false);
        renderer.domElement.style.width = '100%';
        renderer.domElement.style.height = '100%';
        camera.aspect = w / h;
        const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
        const dist = Math.max(14.5, 5.75 / (tanV * camera.aspect));
        camera.position.copy(target).addScaledVector(camDir, dist);
        camera.lookAt(target);
        camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    const mouse = { x: 0, y: 0 };
    const onMove = (e: PointerEvent) => { mouse.x = (e.clientX / window.innerWidth) * 2 - 1; mouse.y = (e.clientY / window.innerHeight) * 2 - 1; };
    window.addEventListener('pointermove', onMove, { passive: true });

    let visible = true;
    const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; }, { threshold: 0.01 });
    io.observe(container);

    /* state */
    const clock = new THREE.Clock();
    let t = still ? 40 : 0;
    let bellUntil = -10, nextBell = 9;
    let busA = STOP_A + 2.2, dwell = 0, lastStopLap = -1, since = 10, busSpeed = 0.3;
    let lap = 0;
    const flagPos = flagGeo.attributes.position as THREE.BufferAttribute;
    const v3 = new THREE.Vector3();

    const poke = () => {
        bellUntil = t + 2.2;
        people.forEach((p, i) => { p.jump = t + i * 0.04; });
        const origin = new THREE.Vector3(0, 4.3, -0.8);
        cp.forEach((c) => {
            c.p.copy(origin);
            const a = Math.random() * Math.PI * 2, s = 1.4 + Math.random() * 1.8;
            c.v.set(Math.cos(a) * s, 2.2 + Math.random() * 2.2, Math.sin(a) * s);
            c.r.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
            c.rv.set(Math.random() * 10 - 5, Math.random() * 10 - 5, Math.random() * 10 - 5);
            c.life = 2.6 + Math.random();
        });
    };
    renderer.domElement.addEventListener('pointerdown', poke);

    let raf = 0;
    const frame = () => {
        raf = requestAnimationFrame(frame);
        if (!still && (!visible || document.hidden)) { clock.getDelta(); return; }
        const dt = still ? 0 : Math.min(clock.getDelta(), 0.05);
        t += dt;

        /* intro */
        if (!introDone) {
            let all = true;
            for (const k of pops) {
                const q = clamp01((t - k.d) / 0.7);
                if (q < 1) all = false;
                k.o.scale.copy(k.base).multiplyScalar(Math.max(0.0001, easeOutBack(q)));
            }
            if (all) introDone = true;
        }
        const rise = still ? 1 : 1 - Math.pow(1 - clamp01(t / 1.3), 3);

        /* float, parallax, scroll */
        const sc = Math.min(1, window.scrollY / Math.max(1, window.innerHeight));
        world.position.y = (rise - 1) * 2.2 + Math.sin(t * 0.8) * 0.09 - sc * 0.6;
        const wantY = (1 - rise) * -0.9 + Math.sin(t * 0.13) * 0.18 + mouse.x * 0.32 + sc * 0.7;
        world.rotation.y += (wantY - world.rotation.y) * (still ? 1 : 0.05);
        world.rotation.x += (mouse.y * 0.05 - world.rotation.x) * (still ? 1 : 0.05);

        /* flag */
        for (let i = 0; i < flagPos.count; i++) {
            const x = flagBase[i * 3], y = flagBase[i * 3 + 1];
            flagPos.setZ(i, (Math.sin(x * 8 - t * 6) * 0.06 + Math.sin(x * 4 + y * 3 - t * 3.4) * 0.025) * (x / 0.78 + 0.1));
        }
        flagPos.needsUpdate = true;
        flagGeo.computeVertexNormals();

        /* clock + bell */
        const now = new Date();
        const m = now.getMinutes() + now.getSeconds() / 60;
        minHand.rotation.z = -(m / 60) * Math.PI * 2;
        hourHand.rotation.z = -(((now.getHours() % 12) + m / 60) / 12) * Math.PI * 2;
        if (t > nextBell) { bellUntil = t + 1.8; nextBell = t + 14; }
        const ring = clamp01((bellUntil - t) / 1.8);
        bell.rotation.z = Math.sin(t * 14) * 0.55 * ring;

        /* trees */
        sway.forEach((o, i) => { o.rotation.z = Math.sin(t * 1.3 + i * 1.7) * 0.025; o.rotation.x = Math.cos(t * 1.1 + i) * 0.015; });

        /* bus: drives the outer lane, slows and waits at the stop */
        const stopDist = ((STOP_A - busA) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
        if (dwell > 0) {
            dwell -= dt; busSpeed = 0;
            if (dwell <= 0) since = 0;
        } else {
            since += dt;
            let want = 0.34;
            if (stopDist < 0.55 && lastStopLap !== lap) want = Math.max(0.05, 0.34 * (stopDist / 0.55));
            want *= clamp01(0.15 + since / 1.4);
            busSpeed += (want - busSpeed) * Math.min(1, dt * 4);
            const prev = busA;
            busA += busSpeed * dt;
            if (lastStopLap !== lap && stopDist < 0.012) { dwell = 2.6; lastStopLap = lap; }
            if (Math.floor(busA / (Math.PI * 2)) !== Math.floor(prev / (Math.PI * 2))) lap++;
        }
        const BR = 4.47;
        bus.position.set(Math.cos(busA) * BR, 0.005 + (busSpeed > 0.02 ? Math.abs(Math.sin(t * 14)) * 0.006 : 0), Math.sin(busA) * BR);
        bus.rotation.y = -busA - Math.PI / 2;
        wheels.forEach((w) => { w.rotation.z -= (busSpeed * BR * dt) / 0.088; });
        const waitingNow = dwell > 0;
        amber.forEach((a, i) => { a.emissiveIntensity = waitingNow ? ((Math.floor(t * 3) + i) % 2 ? 1.6 : 0.1) : 0; });
        stopArm.rotation.y += ((waitingNow ? -1.4 : 0) - stopArm.rotation.y) * Math.min(1, dt * 6);
        // exhaust puffs
        if (!still && busSpeed > 0.05 && Math.random() < dt * 9) {
            const f = puffs.find((q) => q.life <= 0);
            if (f) { f.life = 1; f.p.position.copy(bus.localToWorld(v3.set(-0.6, 0.1, 0.12))); campus.worldToLocal(f.p.position); }
        }
        puffs.forEach((q) => {
            if (q.life <= 0) return;
            q.life -= dt * 0.9;
            q.p.position.y += dt * 0.15;
            q.p.scale.setScalar(1 + (1 - q.life) * 2.2);
            (q.p.material as THREE.MeshStandardMaterial).opacity = Math.max(0, q.life) * 0.55;
        });

        /* people */
        const jumpY = (p: Person) => { const k = t - p.jump; return k > 0 && k < 0.5 ? Math.sin((k / 0.5) * Math.PI) * 0.35 : 0; };

        // football: kids chase the ball around the pitch
        ball.position.set(Math.sin(t * 0.9) * 0.55 + Math.sin(t * 2.3) * 0.08, 0.06, Math.sin(t * 1.4 + 1) * 0.34);
        ball.rotation.z = -t * 6; ball.rotation.x = t * 3;
        players.forEach((p, i) => {
            const off = [[-0.12, 0.05], [0.14, -0.08], [0.02, 0.15]][i];
            const tx2 = ball.position.x + off[0] + Math.sin(t * 0.7 + i) * 0.1, tz = ball.position.z + off[1];
            const dx = tx2 - p.g.position.x, dz = tz - p.g.position.z, d = Math.hypot(dx, dz);
            const sp = Math.min(d * 2.2, 0.75);
            pv[i].set(dx, dz).normalize().multiplyScalar(sp);
            p.g.position.x += pv[i].x * dt; p.g.position.z += pv[i].y * dt;
            if (sp > 0.05) p.g.rotation.y = Math.atan2(pv[i].x, pv[i].y);
            walkPose(p, t * 13 + i, Math.min(1, sp * 1.6) * 0.9);
            p.g.position.y = jumpY(p);
        });

        swing.rotation.x = Math.sin(t * 1.9) * 0.6;
        swinger.legL.rotation.x = swinger.legR.rotation.x = -1.45 + Math.sin(t * 1.9 + 0.6) * 0.35;
        plank.rotation.z = Math.sin(t * 2.1) * 0.22;

        // slide: climb, sit, slide down, run back
        {
            const c = (t % 4.2) / 4.2;
            const p = slider;
            if (c < 0.35) { const k = c / 0.35; p.g.position.set(0, k * 0.5, -0.12); p.g.rotation.y = 0; walkPose(p, t * 10, 0.6); }
            else if (c < 0.45) { p.g.position.set(0, 0.42, 0.04); p.g.rotation.y = 0; sitPose(p); }
            else if (c < 0.62) { const k = (c - 0.45) / 0.17; p.g.position.set(0, 0.42 - k * 0.51, 0.06 + k * 0.72); sitPose(p); p.armL.rotation.z = -1.2; p.armR.rotation.z = 1.2; }
            else { const k = (c - 0.62) / 0.38; p.g.position.set(0.22, 0, 0.8 - k * 0.92); p.g.rotation.y = Math.PI; walkPose(p, t * 13, 0.9); }
            p.g.position.y += jumpY(p);
        }

        // walkers: from the road up the path into school
        walkers.forEach((p, i) => {
            const k = ((t * 0.09 + i * 0.5) % 1);
            p.g.position.z = 3.65 - k * 3.4;
            walkPose(p, t * 8 + i * 2, 0.7);
            const fade = Math.min(1, k * 12, (1 - k) * 12);
            if (introDone) p.g.scale.setScalar(0.72 * Math.max(0.0001, fade));
            p.g.position.y = jumpY(p);
        });

        // waiting kids wave at the bus, hop on while it waits
        const busNear = stopDist < 1.0 || dwell > 0;
        waiting.forEach((p, i) => {
            if (busNear) wavePose(p, t + i); else { p.armR.rotation.z = Math.sin(t * 2 + i) * 0.08; p.armL.rotation.z = 0; }
            p.body.rotation.z = Math.sin(t * 1.6 + i) * 0.04;
            p.g.position.y = jumpY(p);
            if (dwell > 0 && dwell < 1.8 - i * 0.5) boarded[i] = true;
            if (!busNear && since > 4) boarded[i] = false;
            if (introDone) {
                const cur = p.g.scale.x / 0.72, want = boarded[i] ? 0.0001 : 1;
                p.g.scale.setScalar(0.72 * Math.max(0.0001, cur + (want - cur) * Math.min(1, dt * 7)));
            }
        });

        // teacher waves now and then
        if (Math.sin(t * 0.5) > 0.6) wavePose(teacher, t); else { teacher.armR.rotation.z *= 0.9; }
        teacher.g.position.y = jumpY(teacher) * 0.4;

        sawKids.forEach((p) => { p.g.position.y = -0.125 + jumpY(p) * 0.3; });
        swinger.g.position.y = -0.74 + jumpY(swinger) * 0.2;

        /* paper planes + trails */
        planes.forEach((pl) => {
            const r = pl.i ? 4.9 : 3.9, sp = pl.i ? -0.3 : 0.4, ph = pl.i * 2.4;
            const a = t * sp + ph;
            const y = (pl.i ? 3.9 : 3.2) + Math.sin(a * 2) * 0.35;
            pl.p.position.set(Math.cos(a) * r, y, Math.sin(a) * r * 0.85);
            const dir = sp > 0 ? 1 : -1;
            pl.p.rotation.set(0, -a - (dir * Math.PI) / 2, 0);
            pl.p.rotateZ(Math.cos(a * 2) * 0.3);
            pl.p.rotateX(dir * -0.45);
            if (!pl.filled) { for (let i = 0; i < pl.N; i++) pl.pos.set([pl.p.position.x, y, pl.p.position.z], i * 3); pl.filled = true; }
            pl.pos.copyWithin(3, 0, (pl.N - 1) * 3);
            pl.p.localToWorld(v3.set(-0.35, 0, 0)); world.worldToLocal(v3);
            pl.pos[0] = v3.x; pl.pos[1] = v3.y; pl.pos[2] = v3.z;
            (pl.line.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
            pl.line.computeLineDistances();
            pl.p.visible = pl.line.visible = rise > 0.95;
        });

        /* sky */
        clouds.forEach((k, i) => {
            k.c.position.x = ((k.x + t * (0.08 + i * 0.02) + 9) % 18) - 9;
            k.c.position.y = k.y + Math.sin(t * 0.3 + i) * 0.08;
        });
        birds.forEach((b) => {
            const c = ((t * 0.075 + b.i * 0.04) % 1);
            b.b.position.set(-9 + c * 18 + b.i * 0.5, 4.6 + Math.sin(t * 0.8 + b.i) * 0.3 - b.i * 0.35, -17);
            b.wl.rotation.z = 0.35 + Math.sin(t * 11 + b.i) * 0.55; b.wr.rotation.z = -0.35 - Math.sin(t * 11 + b.i) * 0.55;
            b.b.visible = c < 0.9;
        });

        /* confetti */
        let any = false;
        cp.forEach((c, i) => {
            if (c.life <= 0) return;
            any = true;
            c.life -= dt;
            c.v.y -= 3.2 * dt; c.v.multiplyScalar(1 - dt * 0.9);
            if (c.v.y < -0.8) c.v.y = -0.8 + Math.sin(t * 4 + i) * 0.1;
            c.p.addScaledVector(c.v, dt);
            c.r.x += c.rv.x * dt; c.r.y += c.rv.y * dt; c.r.z += c.rv.z * dt;
            tmp.position.copy(c.p); tmp.rotation.copy(c.r); tmp.scale.setScalar(c.life > 0 && c.p.y > 0.02 ? Math.min(1, c.life) : 0); tmp.updateMatrix();
            conf.setMatrixAt(i, tmp.matrix);
        });
        if (any) conf.instanceMatrix.needsUpdate = true;

        renderer.render(scene, camera);
        if (still) cancelAnimationFrame(raf);
    };
    // compile all shaders in the background first, so the first frame does not
    // freeze the page
    let disposed = false;
    renderer.compileAsync(scene, camera).catch(() => undefined).finally(() => { if (!disposed) { clock.getDelta(); frame(); } });

    return {
        poke,
        dispose: () => {
            disposed = true;
            cancelAnimationFrame(raf);
            ro.disconnect(); io.disconnect();
            window.removeEventListener('pointermove', onMove);
            renderer.domElement.removeEventListener('pointerdown', poke);
            scene.traverse((o) => {
                const me = o as THREE.Mesh;
                if (me.geometry) me.geometry.dispose();
                const mm = me.material as THREE.Material | THREE.Material[] | undefined;
                if (Array.isArray(mm)) mm.forEach((x) => x.dispose()); else mm?.dispose();
            });
            matCache.clear();
            bakedMats.forEach((m) => m.dispose()); bakedMats.clear();
            textures.forEach((x) => x.dispose()); textures.length = 0;
            renderer.dispose();
            renderer.domElement.remove();
        },
    };
}

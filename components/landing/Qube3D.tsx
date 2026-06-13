'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * The "Qube" — a 3×3×3 cluster of cubes that slowly spins,
 * follows the mouse, and explodes apart as you scroll.
 */
export default function Qube3D({ className }: { className?: string }) {
    const wrapRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const wrap = wrapRef.current;
        if (!wrap) return;
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
        camera.position.set(0, 0, 9.5);

        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setClearColor(0x000000, 0);
        wrap.appendChild(renderer.domElement);

        /* lights */
        scene.add(new THREE.AmbientLight(0xffffff, 1.1));
        const key = new THREE.DirectionalLight(0xffffff, 2.2);
        key.position.set(4, 6, 8);
        scene.add(key);
        const violet = new THREE.PointLight(0x7c3aed, 30, 30);
        violet.position.set(-6, -3, 5);
        scene.add(violet);
        const warm = new THREE.PointLight(0xda7756, 22, 30);
        warm.position.set(6, 4, -4);
        scene.add(warm);

        /* cube cluster */
        const group = new THREE.Group();
        scene.add(group);

        const geo = new THREE.BoxGeometry(1, 1, 1);
        const edgeGeo = new THREE.EdgesGeometry(geo);

        const matBase = new THREE.MeshStandardMaterial({ color: 0xf6f2ff, roughness: 0.25, metalness: 0.12 });
        const matViolet = new THREE.MeshStandardMaterial({ color: 0x7c3aed, roughness: 0.3, metalness: 0.2, emissive: 0x4c1d95, emissiveIntensity: 0.25 });
        const matTerra = new THREE.MeshStandardMaterial({ color: 0xda7756, roughness: 0.35, metalness: 0.15, emissive: 0x7c2d12, emissiveIntensity: 0.15 });
        const edgeMat = new THREE.LineBasicMaterial({ color: 0xcabcf0, transparent: true, opacity: 0.55 });

        // accent positions (corner-ish cubes get color)
        const accents = new Set(['2,2,2', '0,0,2', '2,0,0']);
        const terras = new Set(['0,2,0']);

        interface Cell { mesh: THREE.Mesh; home: THREE.Vector3; dir: THREE.Vector3 }
        const cells: Cell[] = [];
        const GAP = 1.16;

        for (let x = 0; x < 3; x++)
            for (let y = 0; y < 3; y++)
                for (let z = 0; z < 3; z++) {
                    const k = `${x},${y},${z}`;
                    const mat = accents.has(k) ? matViolet : terras.has(k) ? matTerra : matBase;
                    const mesh = new THREE.Mesh(geo, mat);
                    const home = new THREE.Vector3((x - 1) * GAP, (y - 1) * GAP, (z - 1) * GAP);
                    mesh.position.copy(home);
                    mesh.scale.setScalar(0.94);
                    const edges = new THREE.LineSegments(edgeGeo, edgeMat);
                    mesh.add(edges);
                    group.add(mesh);
                    const dir = home.lengthSq() === 0 ? new THREE.Vector3(0, 0, 0) : home.clone().normalize();
                    cells.push({ mesh, home, dir });
                }

        group.rotation.set(0.45, -0.65, 0);

        /* interaction state */
        let mouseX = 0, mouseY = 0;
        let scrollT = 0; // 0..1 over first viewport
        const onMouse = (e: MouseEvent) => {
            mouseX = (e.clientX / window.innerWidth) * 2 - 1;
            mouseY = (e.clientY / window.innerHeight) * 2 - 1;
        };
        const onScroll = () => {
            scrollT = Math.min(window.scrollY / (window.innerHeight * 0.9), 1);
        };
        window.addEventListener('mousemove', onMouse, { passive: true });
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();

        /* sizing */
        const resize = () => {
            const w = wrap.clientWidth, h = wrap.clientHeight;
            if (!w || !h) return;
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h);
        };
        resize();
        const ro = new ResizeObserver(resize);
        ro.observe(wrap);

        /* entrance + loop */
        const start = performance.now();
        let raf = 0;
        const tick = (now: number) => {
            raf = requestAnimationFrame(tick);
            const t = (now - start) / 1000;
            const intro = Math.min(t / 1.4, 1);
            const easeIntro = 1 - Math.pow(1 - intro, 3);

            // auto spin + mouse follow + scroll spin
            const tx = 0.45 + mouseY * 0.25 + scrollT * 1.1;
            const ty = -0.65 + t * 0.12 + mouseX * 0.4 + scrollT * 1.6;
            group.rotation.x += (tx - group.rotation.x) * 0.06;
            group.rotation.y += (ty - group.rotation.y) * 0.06;

            // scroll explode + gentle idle breathing
            const breathe = 1 + Math.sin(t * 1.2) * 0.012;
            const spread = 1 + scrollT * 1.9;
            for (const c of cells) {
                c.mesh.position.set(
                    c.home.x * spread * breathe,
                    c.home.y * spread * breathe,
                    c.home.z * spread * breathe,
                );
            }

            const s = easeIntro * (1 - scrollT * 0.18);
            group.scale.setScalar(Math.max(s, 0.0001));

            renderer.render(scene, camera);
        };
        raf = requestAnimationFrame(tick);

        return () => {
            cancelAnimationFrame(raf);
            ro.disconnect();
            window.removeEventListener('mousemove', onMouse);
            window.removeEventListener('scroll', onScroll);
            renderer.dispose();
            geo.dispose();
            edgeGeo.dispose();
            matBase.dispose();
            matViolet.dispose();
            matTerra.dispose();
            edgeMat.dispose();
            wrap.removeChild(renderer.domElement);
        };
    }, []);

    return <div ref={wrapRef} className={className} aria-hidden />;
}

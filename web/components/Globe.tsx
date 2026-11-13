"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

export type GlobeTarget = { lat: number; lon: number };
export type GlobeProps = {
  target?: GlobeTarget;
  /** 0..1 progress of the zoom-in toward `target`. */
  zoom?: number;
  className?: string;
  onReady?: () => void;
};

const DEFAULT_TARGET: GlobeTarget = { lat: 29.6, lon: 32.7 }; // Ras Sudr, South Sinai
const TEXTURE_URL = "/textures/earth_1024.jpg";
const LABEL = "Rotating Earth with a satellite scanning Ras Sudr, Egypt";
const CYAN = 0x4cc9f0;
const AMBER = 0xffc857;
const DEG = Math.PI / 180;
const FOV = 45;
const CAM_FAR = 3.7; // camera distance (Earth radii) at zoom 0
const CAM_NEAR = 2.0; // ... at zoom 1 (closer gets blurry with a 1024px texture)
const ORBIT_R = 1.32;
const HOVER_R = 1.2;
const SPIN_SPEED = (Math.PI * 2) / 60; // one turn per minute
const ORBIT_SPEED = (Math.PI * 2) / 22;
const REST_TILT = 0.18; // show a bit more of the northern hemisphere while idle

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * lat/lon -> point on THREE.SphereGeometry wearing an equirectangular texture.
 * SphereGeometry maps u=0 (lon -180) to -X, so lon 0 lands on +X, lon 90E on -Z, north on +Y.
 */
function latLonToVec3(lat: number, lon: number, r: number, out: THREE.Vector3): THREE.Vector3 {
  const la = lat * DEG;
  const lo = lon * DEG;
  return out.set(r * Math.cos(la) * Math.cos(lo), r * Math.sin(la), -r * Math.cos(la) * Math.sin(lo));
}

/** Rotation about Y that brings longitude `lon` to face +Z (the camera). */
const facingSpin = (lon: number) => -(Math.PI / 2 + lon * DEG);

function prefersStatic(): boolean {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return true;
  if (window.innerWidth < 640) return true;
  return typeof window.WebGLRenderingContext === "undefined";
}

const GLOW_VERT = /* glsl */ `
varying vec3 vN; varying vec3 vP;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vP = wp.xyz; vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
// uBack = 1: halo on a larger back-side shell; uBack = 0: fresnel rim hugging the planet.
const GLOW_FRAG = /* glsl */ `
uniform vec3 uColor; uniform float uBack;
varying vec3 vN; varying vec3 vP;
void main() {
  float d = dot(normalize(vN), normalize(cameraPosition - vP));
  float halo = pow(clamp(-d / 0.45, 0.0, 1.0), 2.0) * 0.9;
  float rim = pow(1.0 - clamp(d, 0.0, 1.0), 4.0) * 0.4;
  gl_FragColor = vec4(uColor, mix(rim, halo, uBack));
  #include <colorspace_fragment>
}`;
const BEAM_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
// vUv.y = 1 at the satellite (apex), 0 at the footprint; moving bands read as a scan.
const BEAM_FRAG = /* glsl */ `
uniform vec3 uColor; uniform float uOpacity; uniform float uTime;
varying vec2 vUv;
void main() {
  float bands = 0.72 + 0.28 * sin(vUv.y * 42.0 + uTime * 7.0);
  gl_FragColor = vec4(uColor, uOpacity * mix(1.0, 0.3, vUv.y) * bands);
  #include <colorspace_fragment>
}`;

export default function Globe({ target, zoom = 0, className, onReady }: GlobeProps) {
  const lat = target?.lat ?? DEFAULT_TARGET.lat;
  const lon = target?.lon ?? DEFAULT_TARGET.lon;
  const [mode, setMode] = useState<"pending" | "webgl" | "static">("pending");
  const hostRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(clamp01(zoom));
  const targetRef = useRef<GlobeTarget>({ lat, lon });
  const readyRef = useRef(onReady);

  useEffect(() => {
    zoomRef.current = clamp01(zoom);
  }, [zoom]);
  useEffect(() => {
    targetRef.current = { lat, lon };
  }, [lat, lon]);
  useEffect(() => {
    readyRef.current = onReady;
  }, [onReady]);
  useEffect(() => setMode(prefersStatic() ? "static" : "webgl"), []);
  useEffect(() => {
    if (mode === "static") readyRef.current?.();
  }, [mode]);

  useEffect(() => {
    const host = hostRef.current;
    if (mode !== "webgl" || !host) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
    } catch {
      setMode("static");
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setClearColor(0x050814, 0);
    const canvas = renderer.domElement;
    canvas.style.cssText = "display:block;width:100%;height:100%;opacity:0;transition:opacity .8s ease";
    host.appendChild(canvas);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, 50);
    camera.position.set(0, 0, CAM_FAR);
    scene.add(new THREE.AmbientLight(0x9fb4d8, 0.45));
    const sun = new THREE.DirectionalLight(0xffffff, 2.4);
    sun.position.set(4, 2.5, 5);
    scene.add(sun);

    // Earth hierarchy: tilt (X) -> spin (Y) -> sphere + marker
    const tiltG = new THREE.Group();
    const spinG = new THREE.Group();
    tiltG.add(spinG);
    scene.add(tiltG);

    let disposed = false;
    let loaded = false;
    const onTexture = () => {
      if (disposed) return;
      loaded = true;
      updateRunning();
    };
    const texture = new THREE.TextureLoader().load(TEXTURE_URL, onTexture, undefined, onTexture);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    const earthMat = new THREE.MeshPhongMaterial({ map: texture, specular: 0x1f2c3a, shininess: 14 });
    spinG.add(new THREE.Mesh(new THREE.SphereGeometry(1, 64, 64), earthMat));

    const glowMat = (back: boolean) =>
      new THREE.ShaderMaterial({
        vertexShader: GLOW_VERT,
        fragmentShader: GLOW_FRAG,
        uniforms: { uColor: { value: new THREE.Color(CYAN) }, uBack: { value: back ? 1 : 0 } },
        side: back ? THREE.BackSide : THREE.FrontSide,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
      });
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(1.09, 64, 32), glowMat(true)));
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(1.006, 64, 32), glowMat(false)));

    // Target marker: dot + soft halo + pulsing ring, riding on the spinning globe
    const fx = { transparent: true, depthWrite: false } as const;
    const marker = new THREE.Group();
    const ringMat = new THREE.MeshBasicMaterial({ color: CYAN, side: THREE.DoubleSide, ...fx });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.03, 0.037, 48), ringMat);
    const haloMat = new THREE.MeshBasicMaterial({ color: AMBER, opacity: 0.25, blending: THREE.AdditiveBlending, ...fx });
    marker.add(
      new THREE.Mesh(new THREE.SphereGeometry(0.014, 16, 12), new THREE.MeshBasicMaterial({ color: AMBER })),
      new THREE.Mesh(new THREE.CircleGeometry(0.034, 32), haloMat),
      ring,
    );
    spinG.add(marker);

    // Inclined orbit ring + satellite (box body, two thin solar panels)
    const orbit = new THREE.Group();
    orbit.rotation.set(1.1, 0, 0.5);
    scene.add(orbit);
    const ringPts = Array.from({ length: 128 }, (_, i) => {
      const a = (i / 128) * Math.PI * 2;
      return new THREE.Vector3(Math.cos(a) * ORBIT_R, 0, Math.sin(a) * ORBIT_R);
    });
    const orbitMat = new THREE.LineBasicMaterial({ color: CYAN, opacity: 0.22, ...fx });
    orbit.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(ringPts), orbitMat));

    const sat = new THREE.Group();
    const bodyMat = new THREE.MeshPhongMaterial({ color: 0xd9b45a, emissive: 0x2a1c00, shininess: 60 });
    sat.add(new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 0.05), bodyMat));
    const panelGeo = new THREE.PlaneGeometry(0.08, 0.03);
    const panelMat = new THREE.MeshPhongMaterial({ color: 0x2a4fa8, emissive: 0x0a1838, side: THREE.DoubleSide });
    for (const s of [-1, 1]) {
      const p = new THREE.Mesh(panelGeo, panelMat);
      p.position.x = s * 0.062;
      sat.add(p);
    }
    scene.add(sat);

    // Scan beam: open cone, apex at origin, opening along -Y over unit length
    const beamGeo = new THREE.ConeGeometry(1, 1, 32, 1, true);
    beamGeo.translate(0, -0.5, 0);
    const beamMat = new THREE.ShaderMaterial({
      vertexShader: BEAM_VERT,
      fragmentShader: BEAM_FRAG,
      uniforms: { uColor: { value: new THREE.Color(CYAN) }, uOpacity: { value: 0 }, uTime: { value: 0 } },
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      ...fx,
    });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    scene.add(beam);

    const st = {
      zoom: zoomRef.current,
      lat: targetRef.current.lat,
      lon: targetRef.current.lon,
      spin: facingSpin(targetRef.current.lon) - 0.7, // target rotates into view shortly after load
      orbitT: 1.1,
      time: 0,
    };
    const Z = new THREE.Vector3(0, 0, 1);
    const Y_DOWN = new THREE.Vector3(0, -1, 0);
    const HOVER_OFFSET = new THREE.Vector3(0.1, 0.08, 0);
    const [targetW, orbitDir, hover, aim, tmp] = Array.from({ length: 5 }, () => new THREE.Vector3());
    const qTo = new THREE.Quaternion();
    const qPart = new THREE.Quaternion();

    let raf = 0;
    let running = false;
    let onScreen = true;
    let last = 0;
    let readyFired = false;

    const frame = (now: number) => {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const k = 1 - Math.exp(-dt * 2.5);
      st.zoom += (zoomRef.current - st.zoom) * k;
      if (Math.abs(zoomRef.current - st.zoom) < 1e-4) st.zoom = zoomRef.current;
      st.lat += (targetRef.current.lat - st.lat) * k;
      st.lon += (wrap((targetRef.current.lon - st.lon) * DEG) / DEG) * k;
      st.time += dt;
      const e = ease(clamp01(st.zoom));

      // Globe: auto-spin only while fully zoomed out; blend toward "target faces camera"
      if (st.zoom < 0.002) st.spin = wrap(st.spin + dt * SPIN_SPEED);
      spinG.rotation.y = st.spin + wrap(facingSpin(st.lon) - st.spin) * e;
      tiltG.rotation.x = lerp(REST_TILT, st.lat * DEG, e);

      latLonToVec3(st.lat, st.lon, 1.004, marker.position);
      marker.quaternion.setFromUnitVectors(Z, tmp.copy(marker.position).normalize());
      marker.scale.setScalar(lerp(1.1, 0.5, e));
      const pulse = (st.time % 1.8) / 1.8;
      ring.scale.setScalar(1 + pulse * 2.2);
      ringMat.opacity = (1 - pulse) * 0.9;
      tiltG.updateMatrixWorld(true);
      targetW.copy(marker.position).applyMatrix4(spinG.matrixWorld).normalize();

      // Satellite: free orbit at zoom 0, slerps to hover just above the target as zoom -> 1
      st.orbitT += dt * ORBIT_SPEED * (1 - e);
      orbitDir.set(Math.cos(st.orbitT), 0, Math.sin(st.orbitT)).applyQuaternion(orbit.quaternion);
      hover.copy(targetW).add(HOVER_OFFSET).normalize();
      qTo.setFromUnitVectors(orbitDir, hover);
      qPart.identity().slerp(qTo, e);
      sat.position.copy(orbitDir).applyQuaternion(qPart).multiplyScalar(lerp(ORBIT_R, HOVER_R, e));
      sat.lookAt(0, 0, 0);
      sat.scale.setScalar(lerp(1.25, 0.45, e));
      orbitMat.opacity = 0.22 * (1 - e);

      // Beam: aims at the sub-satellite point at zoom 0, at the target at zoom 1
      aim.copy(sat.position).normalize().lerp(targetW, e).normalize();
      tmp.copy(aim).sub(sat.position);
      const len = tmp.length();
      beam.position.copy(sat.position);
      beam.quaternion.setFromUnitVectors(Y_DOWN, tmp.normalize());
      const r = len * lerp(0.16, 0.12, e);
      beam.scale.set(r, len, r);
      beamMat.uniforms.uOpacity.value = 0.24 + 0.14 * Math.sin(st.time * 3.2);
      beamMat.uniforms.uTime.value = st.time;

      camera.position.z = lerp(CAM_FAR, CAM_NEAR, e);
      renderer.render(scene, camera);
      if (!readyFired) {
        readyFired = true;
        canvas.style.opacity = "1";
        readyRef.current?.();
      }
    };

    function updateRunning() {
      const should = loaded && onScreen && document.visibilityState === "visible" && !disposed;
      if (should && !running) {
        running = true;
        last = performance.now();
        raf = requestAnimationFrame(frame);
      } else if (!should && running) {
        running = false;
        cancelAnimationFrame(raf);
      }
    }

    const resize = () => {
      const w = Math.max(1, host.clientWidth);
      const h = Math.max(1, host.clientHeight);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      // keep the globe fully visible in portrait containers
      camera.fov = camera.aspect < 1 ? (2 * Math.atan(Math.tan((FOV / 2) * DEG) / camera.aspect)) / DEG : FOV;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    const io = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      updateRunning();
    });
    io.observe(host);
    document.addEventListener("visibilitychange", updateRunning);

    return () => {
      disposed = true;
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", updateRunning);
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.Line) {
          o.geometry.dispose();
          const mats: THREE.Material[] = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((m) => m.dispose());
        }
      });
      texture.dispose();
      renderer.dispose();
      canvas.remove();
    };
  }, [mode]);

  return (
    <div
      ref={hostRef}
      role="img"
      aria-label={LABEL}
      className={`relative ${mode === "static" ? "flex items-center justify-center" : "overflow-hidden"} ${className ?? ""}`}
    >
      {mode === "static" && <StaticGlobe lat={lat} lon={lon} />}
    </div>
  );
}

/** Lightweight fallback: the texture cropped into a circle, centred on the target longitude. */
function StaticGlobe({ lat, lon }: GlobeTarget) {
  const u = ((((lon + 180) % 360) + 360) % 360) / 360;
  const v = clamp01((90 - lat) / 180);
  // object-fit: cover renders the 2:1 image at 2x the circle width; shift it so `u` is centred.
  const p = clamp01(2 * u - 0.5);
  return (
    <div
      className="relative aspect-square rounded-full"
      style={{ width: "min(84%, 440px)", boxShadow: "0 0 60px 8px rgba(76,201,240,.28), 0 0 0 1px rgba(76,201,240,.35)" }}
    >
      <div className="absolute inset-0 overflow-hidden rounded-full bg-[#050814]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={TEXTURE_URL} alt="" className="h-full w-full object-cover" style={{ objectPosition: `${p * 100}% 50%` }} />
        <div
          className="absolute inset-0 rounded-full"
          style={{ background: "radial-gradient(circle at 38% 32%, rgba(255,255,255,.10), transparent 45%, rgba(5,8,20,.78) 100%)" }}
        />
      </div>
      <span className="absolute" style={{ left: `${(2 * u - p) * 100}%`, top: `${v * 100}%` }}>
        <span className="absolute -left-3 -top-3 h-6 w-6 rounded-full border border-[#4cc9f0] motion-safe:animate-ping" />
        <span className="absolute -left-1.5 -top-1.5 h-3 w-3 rounded-full bg-[#ffc857] shadow-[0_0_12px_4px_rgba(255,200,87,.6)]" />
      </span>
    </div>
  );
}

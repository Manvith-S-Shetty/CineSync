import React, { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame, extend } from '@react-three/fiber';
import { OrbitControls, Effects } from '@react-three/drei';
import { UnrealBloomPass } from 'three-stdlib';
import * as THREE from 'three';

extend({ UnrealBloomPass });

// Helper hook to check mobile status
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  return isMobile;
};

const ParticleSwarm = ({ count }) => {
  const meshRef = useRef();
  const speedMult = 0.5; // Slightly slower for more cinematic feel
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const target = useMemo(() => new THREE.Vector3(), []);
  const pColor = useMemo(() => new THREE.Color(), []);
  const color = pColor; 
  
  const positions = useMemo(() => {
     const pos = [];
     for(let i=0; i<count; i++) pos.push(new THREE.Vector3((Math.random()-0.5)*100, (Math.random()-0.5)*100, (Math.random()-0.5)*100));
     return pos;
  }, [count]);

  const material = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {},
    vertexShader: `
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        varying vec3 vColor;
        void main() {
            vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
            vNormal = normalize(normalMatrix * normal);
            vViewPosition = -mvPosition.xyz;
            vColor = instanceColor;
            gl_Position = projectionMatrix * mvPosition;
        }
    `,
    fragmentShader: `
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        varying vec3 vColor;
        void main() {
            float fresnel = dot(vNormal, normalize(vViewPosition));
            fresnel = clamp(1.0 - fresnel, 0.0, 1.0);
            fresnel = pow(fresnel, 2.0);
            vec3 col = vColor * fresnel + vec3(0.05); 
            gl_FragColor = vec4(col, 0.2 + fresnel * 0.8);
        }
    `,
    transparent: true, blending: 2, depthWrite: false
  }), []);
  const geometry = useMemo(() => new THREE.SphereGeometry(0.25, 8, 8), []); // Reduced polygon complexity for performance

  const PARAMS = useMemo(() => ({"breath":1.0,"spread":55,"duality":10.0}), []);
  const addControl = (id, l, min, max, val) => {
      return PARAMS[id] !== undefined ? PARAMS[id] : val;
  };
  const setInfo = () => {};
  const annotate = () => {};

  useFrame((state) => {
    // Pause rendering loop calculations when the tab is inactive
    if (document.hidden) return;
    if (!meshRef.current) return;
    
    const time = state.clock.getElapsedTime() * speedMult;

    if(material.uniforms && material.uniforms.uTime) {
         material.uniforms.uTime.value = time;
    }

    for (let i = 0; i < count; i++) {
        const breath = addControl("breath", "Breathing Speed", 0, 3, 1.0);
        const spread = addControl("spread", "Sphere Radius", 20, 120, 60);
        const duality = addControl("duality", "Duality Gap", 0, 30, 12);
        
        const N = count;
        const nHalo = Math.floor(N * 0.30);
        const nCurves = Math.floor(N * 0.30);
        const nRings = Math.floor(N * 0.20);
        const nCore = Math.floor(N * 0.10);
        
        const breathFactor = 1 + 0.08 * Math.sin(time * breath * 0.7);
        const corePulse = 1 + 0.35 * Math.sin(time * breath * 1.6);
        const GOLDEN = Math.PI * (3 - Math.sqrt(5));
        
        let px = 0, py = 0, pz = 0;
        
        if (i < nHalo) {
          const k = i;
          const f = (k + 0.5) / Math.max(1, nHalo);
          let yy = 1 - 2 * f;
          const sgn = yy >= 0 ? 1 : -1;
          yy = sgn * Math.pow(Math.abs(yy), 0.65);
          const rr = Math.sqrt(Math.max(0, 1 - yy * yy));
          const ang = k * GOLDEN + time * 0.04;
          const r = spread * breathFactor;
          px = Math.cos(ang) * rr * r;
          py = yy * r;
          pz = Math.sin(ang) * rr * r;
        } else if (i < nHalo + nCurves) {
          const j = i - nHalo;
          const sideSign = (j & 1) === 0 ? -1 : 1;
          const localIdx = j >> 1;
          const halfCurve = Math.max(1, nCurves >> 1);
          const ribbonCount = 5;
          const ribbon = localIdx % ribbonCount;
          const along = Math.floor(localIdx / ribbonCount);
          const alongTotal = Math.max(1, Math.floor(halfCurve / ribbonCount));
          const t = along / alongTotal;
          const yt = (t * 2 - 1) * spread * 0.95;
          const amp = Math.sin(t * Math.PI);
          const curveAmp = spread * 0.5 * breathFactor;
          const ribbonOff = (ribbon - (ribbonCount - 1) * 0.5) * 1.2;
          px = sideSign * (duality * 0.5 + amp * curveAmp + ribbonOff);
          py = yt + Math.sin(t * Math.PI * 2 + time * 0.6) * 0.8;
          pz = Math.cos(t * Math.PI * 3 + time * 0.4) * 2.5;
        } else if (i < nHalo + nCurves + nRings) {
          const j = i - nHalo - nCurves;
          const ringPart = Math.floor(nRings * 0.7);
          if (j < ringPart) {
            const numRings = 6;
            const perRing = Math.max(1, Math.floor(ringPart / numRings));
            const ringIdx = Math.floor(j / perRing) % numRings;
            const onRing = j % perRing;
            const ringR = (ringIdx + 1) / numRings * spread * 0.85;
            const angR = (onRing / perRing) * Math.PI * 2 + time * 0.02;
            px = Math.cos(angR) * ringR;
            py = Math.sin(angR) * ringR;
            pz = 0;
          } else {
            const k = j - ringPart;
            const spokeTotal = Math.max(1, nRings - ringPart);
            const numSpokes = 4;
            const perSpoke = Math.max(1, Math.floor(spokeTotal / numSpokes));
            const spokeIdx = Math.floor(k / perSpoke) % numSpokes;
            const onSpoke = k % perSpoke;
            const spokeAng = spokeIdx * Math.PI / 4;
            const ts = (onSpoke / perSpoke) * 2 - 1;
            const dist = ts * spread * 0.9;
            px = Math.cos(spokeAng) * dist;
            py = Math.sin(spokeAng) * dist;
            pz = 0;
          }
        } else if (i < nHalo + nCurves + nRings + nCore) {
          const j = i - nHalo - nCurves - nRings;
          const f2 = (j + 0.5) / Math.max(1, nCore);
          const yy2 = 1 - 2 * f2;
          const rr2 = Math.sqrt(Math.max(0, 1 - yy2 * yy2));
          const ang2 = j * GOLDEN + time * 0.25;
          const coreR = spread * 0.06 * corePulse;
          px = Math.cos(ang2) * rr2 * coreR;
          py = yy2 * coreR;
          pz = Math.sin(ang2) * rr2 * coreR;
        } else {
          const j = i - nHalo - nCurves - nRings - nCore;
          const jetCount = Math.max(1, N - nHalo - nCurves - nRings - nCore);
          const sideSign = (j & 1) === 0 ? -1 : 1;
          const lidx = j >> 1;
          const jetMax = Math.max(1, jetCount >> 1);
          const baseT = lidx / jetMax;
          const jetExtent = spread * 2.0;
          const speed = 0.35;
          const progress = ((baseT + time * speed) % 1 + 1) % 1;
          px = sideSign * progress * jetExtent;
          py = Math.sin(lidx * 0.37) * 0.7;
          pz = Math.cos(lidx * 0.73 + time * 0.5) * 0.5;
        }
        
        target.set(px, py, pz);
        
        const colorScale = spread * 0.6 + 0.0001;
        const xNorm = Math.max(-1, Math.min(1, px / colorScale));
        const t01 = (xNorm + 1) * 0.5;
        const hue = 0.58 + 0.16 * t01; // Deep blues & violets
        const absX = Math.min(1, Math.abs(xNorm));
        const proximity = 1 - absX;
        const prox2 = proximity * proximity;
        const lightness = 0.45 + 0.4 * prox2;
        const saturation = 0.9 - 0.75 * prox2;
        color.setHSL(hue, saturation, lightness);
        
        if (i === 0) {
          setInfo("Janus", "Duality field - two faces, one core.");
          annotate("janus_core", new THREE.Vector3(0, 0, 0), "Janus Core");
        }
        
        // Safety check to ensure array bounds are respected if count changed
        if (positions[i]) {
          positions[i].lerp(target, 0.1);
          dummy.position.copy(positions[i]);
          dummy.updateMatrix();
          meshRef.current.setMatrixAt(i, dummy.matrix);
          meshRef.current.setColorAt(i, pColor);
        }
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[geometry, material, count]} />
  );
};

export default function ParticleBackground() {
  const isMobile = useIsMobile();
  
  // Use significantly fewer particles on mobile (2000 vs 8000 on desktop)
  const particleCount = isMobile ? 2500 : 8000;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'radial-gradient(circle at center, #0a0f24 0%, #030712 100%)', // Premium dark navy/blue glow base
      zIndex: -1,
      pointerEvents: 'none',
      overflow: 'hidden'
    }}>
      <Canvas camera={{ position: [0, 0, 100], fov: 60 }}>
        <fog attach="fog" args={['#030712', 0.01]} />
        <ParticleSwarm count={particleCount} />
        <OrbitControls autoRotate={true} autoRotateSpeed={0.3} enableZoom={false} enablePan={false} />
        
        {/* Render heavy postprocessing bloom only on desktop */}
        {!isMobile && (
          <Effects disableGamma>
            <unrealBloomPass threshold={0.1} strength={1.5} radius={0.5} />
          </Effects>
        )}
      </Canvas>
    </div>
  );
}

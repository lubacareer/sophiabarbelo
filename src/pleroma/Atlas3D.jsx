import { Component, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { AdditiveBlending, BufferGeometry, CatmullRomCurve3, Color, CubicBezierCurve3, DoubleSide, Float32BufferAttribute, LineBasicMaterial, TextureLoader, Vector3 } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { getScene, focusFor, textFor } from './geometry.js';
import './atlas.css';

function worldCurve(edge) {
  const start = new Vector3(...edge.from.world), end = new Vector3(...edge.to.world);
  const delta = end.clone().sub(start);
  const perpendicular = edge.from.kind === 'sefirah' && edge.to.kind === 'sefirah'
    ? new Vector3(-delta.y, delta.x, 0).multiplyScalar(edge.bend)
    : Math.abs(delta.z) + Math.abs(delta.x) > .08
    ? new Vector3(-delta.z, Math.abs(delta.x) * .22, delta.x).multiplyScalar(edge.bend)
    : new Vector3(.45, 0, .15);
  return new CubicBezierCurve3(start, start.clone().addScaledVector(delta, .32).add(perpendicular), start.clone().addScaledVector(delta, .68).add(perpendicular), end);
}

const glowVertex = `varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;
const glowFragment = `varying vec2 vUv; uniform vec3 color; uniform float strength; void main(){vec2 p=vUv-.5;float r=length(p)*2.;float halo=pow(max(0.,1.-r),2.65);float core=pow(max(0.,1.-r),10.);float rays=pow(max(0.,1.-abs(p.x*22.)),2.5)*pow(max(0.,1.-abs(p.y*2.)),3.)+pow(max(0.,1.-abs(p.y*22.)),2.5)*pow(max(0.,1.-abs(p.x*2.)),3.);float diagonal=pow(max(0.,1.-abs((p.x-p.y)*20.)),3.)*pow(max(0.,1.-r),4.)+pow(max(0.,1.-abs((p.x+p.y)*20.)),3.)*pow(max(0.,1.-r),4.);float a=clamp((halo*.88+core*.8+rays*.31+diagonal*.14)*strength,0.,1.);gl_FragColor=vec4(color,a);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`;

function Glow({ position = [0, 0, 0], size = 1, strength = .7, color = '#f0cc7c' }) {
  const mesh = useRef();
  const uniforms = useMemo(() => ({ color: { value: new Color(color) }, strength: { value: strength } }), [color, strength]);
  useFrame(({ camera }) => { if (mesh.current) mesh.current.quaternion.copy(camera.quaternion); });
  return <mesh position={position} ref={mesh} scale={size} raycast={() => null} renderOrder={3}>
    <planeGeometry args={[1, 1]} />
    <shaderMaterial vertexShader={glowVertex} fragmentShader={glowFragment} uniforms={uniforms} transparent blending={AdditiveBlending} depthWrite={false} />
  </mesh>;
}

function Filament({ edge, active = false }) {
  const curve = useMemo(() => worldCurve(edge), [edge]);
  return <group>
    <mesh raycast={() => null}><tubeGeometry args={[curve, 38, active ? .066 : .04, 5, false]} /><meshBasicMaterial color="#edb84f" transparent opacity={active ? .25 : .13} depthWrite={false} blending={AdditiveBlending} toneMapped={false} /></mesh>
    <mesh raycast={() => null}><tubeGeometry args={[curve, 38, active ? .014 : .009, 4, false]} /><meshBasicMaterial color={edge.kind === 'interpretive' ? '#badcc9' : '#ffe1a0'} transparent opacity={active ? .98 : .8} depthWrite={false} toneMapped={false} /></mesh>
  </group>;
}

function Orbit({ ring, torus, onSelect }) {
  const points = useMemo(() => Array.from({ length: 129 }, (_, i) => {
    // The heavens form a backdrop of seven arches rather than a foreground cage.
    const angle = ring.heaven ? Math.PI + i / 128 * Math.PI : i / 128 * Math.PI * 2;
    return new Vector3(Math.cos(angle) * ring.radius, 0, Math.sin(angle) * ring.radius);
  }), [ring.radius, ring.heaven]);
  const geometry = useMemo(() => new BufferGeometry().setFromPoints(points), [points]);
  const ribbon = useMemo(() => new CatmullRomCurve3(points), [points]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  if (ring.wheel) return <group position={ring.world} onClick={(event) => { if (event.delta > 5) return; event.stopPropagation(); onSelect(ring.id.replace(/-rim$/u, '')); }}>
    {[0, Math.PI / 2].map((turn, index) => <mesh key={index} rotation={[0, turn, .12]}>
      <torusGeometry args={[ring.radius, torus ? .13 : .022, torus ? 12 : 5, 96]} />
      <meshStandardMaterial color={index ? '#b4d0b2' : '#d8bd79'} emissive="#ddb55e" emissiveIntensity={.65} metalness={.75} roughness={.24} transparent opacity={torus ? .72 : .86} />
    </mesh>)}
    {Array.from({ length: 22 }, (_, i) => <mesh key={i} position={[Math.cos(i * Math.PI / 11) * ring.radius, Math.sin(i * Math.PI / 11) * ring.radius, 0]}>
      <sphereGeometry args={[.027, 8, 6]} /><meshBasicMaterial color="#edf3ce" />
    </mesh>)}
  </group>;
  const RingLine = ring.heaven ? 'line' : 'lineLoop';
  return <group position={ring.world}>
    <RingLine geometry={geometry} raycast={() => null}>
      <lineBasicMaterial color={ring.planetary ? '#b6e3cd' : ring.heaven ? '#8cbdb6' : '#f8d489'} transparent opacity={Math.min(.86, ring.opacity * (ring.heaven ? 1.6 : 1.25))} depthWrite={false} toneMapped={false} />
    </RingLine>
    <mesh raycast={() => null}><tubeGeometry args={[ribbon, 128, ring.heaven ? .035 : .018, 3, false]} /><meshBasicMaterial color={ring.heaven ? '#69ada4' : '#efc06b'} transparent opacity={ring.heaven ? .045 : .08} blending={AdditiveBlending} depthWrite={false} toneMapped={false} /></mesh>
  </group>;
}

function Cloud({ url, position }) {
  const texture = useLoader(TextureLoader, url);
  const mesh = useRef();
  useEffect(() => {
    // The sole cloud owns its loader entry. Release the GPU allocation and
    // loader cache on exit; StrictMode's replay can re-upload the decoded image.
    texture.needsUpdate = true;
    return () => { texture.dispose(); useLoader.clear(TextureLoader, url); };
  }, [texture, url]);
  useFrame(({ camera }) => { if (mesh.current) mesh.current.quaternion.copy(camera.quaternion); });
  return <mesh ref={mesh} position={position} scale={[5.9, 2, 1]} raycast={() => null}>
    <planeGeometry /><meshBasicMaterial map={texture} color="#ffffff" transparent opacity={.8} depthWrite={false} side={DoubleSide} />
  </mesh>;
}

function Dust({ scene }) {
  const points = useMemo(() => Array.from({ length: 520 }, (_, index) => {
    const seed = scene.dust[index % scene.dust.length];
    const angle = index * 2.39996323;
    const radius = .8 + Math.sqrt(((index * 73) % 520) / 520) * 6.1;
    return {
      position: new Vector3(Math.cos(angle) * radius, ((index * 37) % 100) / 44 - .5, Math.sin(angle) * radius * .85),
      color: new Color(index % 11 === 0 ? '#fff0c3' : index % 5 === 0 ? '#accfba' : '#e6b761'),
      glint: index % 26 === 0,
      seed,
    };
  }), [scene]);
  const geometry = useMemo(() => {
    const result = new BufferGeometry().setFromPoints(points.map((point) => point.position));
    result.setAttribute('color', new Float32BufferAttribute(points.flatMap((point) => point.color.toArray()), 3));
    return result;
  }, [points]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <group>
    <points geometry={geometry} raycast={() => null}><pointsMaterial size={.028} vertexColors transparent opacity={.95} sizeAttenuation depthWrite={false} blending={AdditiveBlending} toneMapped={false} /></points>
    <points geometry={geometry} raycast={() => null}><pointsMaterial size={.095} vertexColors transparent opacity={.14} sizeAttenuation depthWrite={false} blending={AdditiveBlending} toneMapped={false} /></points>
    {points.filter((point) => point.glint).map((point, index) => <Glow key={index} position={point.position.toArray()} size={.31 + index % 3 * .07} strength={.7} color="#fff0bb" />)}
  </group>;
}

function LightTrails({ traditionId }) {
  const curves = useMemo(() => traditionId !== 'john' ? [] : Array.from({ length: 15 }, (_, i) => {
    const radius = 1.1 + i * .285, angle = i * 2.399;
    return new CatmullRomCurve3(Array.from({ length: 11 }, (_, p) => {
      const a = angle + p / 10 * Math.PI * 1.7;
      return new Vector3(Math.cos(a) * radius, .08 + Math.sin(p / 10 * Math.PI) * .72 + (i % 3) * .08, Math.sin(a) * radius * .72);
    }));
  }), [traditionId]);
  return <group>{curves.map((curve, i) => <group key={i}>
    <mesh raycast={() => null}><tubeGeometry args={[curve, 70, .032, 3, false]} /><meshBasicMaterial color="#d99b3d" transparent opacity={.07} depthWrite={false} blending={AdditiveBlending} toneMapped={false} /></mesh>
    <mesh raycast={() => null}><tubeGeometry args={[curve, 70, .007, 3, false]} /><meshBasicMaterial color="#efc676" transparent opacity={.33 + (i % 4) * .065} depthWrite={false} blending={AdditiveBlending} toneMapped={false} /></mesh>
  </group>)}</group>;
}

function Marker({ marker, active, onSelect }) {
  const core = ['barbelo', 'invisible-spirit', 'one'].includes(marker.canonicalParentId);
  const size = marker.kind === 'sefirah' ? .16 : marker.major ? core ? .16 : .11 : marker.aspect ? .065 : .075;
  const sage = marker.aspect === 'feminine' || marker.kind === 'planet' || marker.canonicalParentId === 'invisible-spirit';
  return <group position={marker.world}>
    <Glow size={size * (core ? 18 : active ? 20 : marker.major ? 16 : 13)} strength={core ? .85 : active ? 1.15 : marker.major ? 1.1 : .85} color={sage ? '#dbf1da' : '#ffdc8c'} />
    <mesh onClick={(event) => { if (event.delta > 5) return; event.stopPropagation(); onSelect(marker.canonicalParentId); }} onPointerOver={(event) => { event.stopPropagation(); document.body.style.cursor = 'pointer'; }} onPointerOut={() => { document.body.style.cursor = ''; }}>
      <sphereGeometry args={[size, 24, 16]} />
      <meshStandardMaterial color={sage ? '#d9edce' : '#ffe2a0'} metalness={.35} roughness={.18} emissive={sage ? '#b0e5cf' : '#ffd276'} emissiveIntensity={active || core ? 1.25 : .7} toneMapped={false} />
    </mesh>
    {active && <mesh rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}><torusGeometry args={[size * 1.4, .01, 5, 48]} /><meshBasicMaterial color="#ffedb8" /></mesh>}
  </group>;
}

function Pulse({ selected, edges, eventKey, reducedMotion }) {
  const group = useRef(), start = useRef(null);
  const { invalidate, clock } = useThree();
  const material = useMemo(() => new LineBasicMaterial({ color: '#ffe1a1', transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false }), []);
  const rays = useMemo(() => Array.from({ length: 13 }, (_, i) => {
    const angle = i * Math.PI * 2 / 13;
    const end = new Vector3(Math.cos(angle) * 1.1, Math.sin(angle) * .7, Math.sin(angle) * .9);
    return new BufferGeometry().setFromPoints(new CubicBezierCurve3(new Vector3(), new Vector3(-end.z * .3, .2, end.x * .3), end.clone().multiplyScalar(.6).add(new Vector3(.1, .1, .15)), end).getPoints(25));
  }), []);
  useEffect(() => () => { material.dispose(); rays.forEach((ray) => ray.dispose()); }, [material, rays]);
  useEffect(() => { if (!reducedMotion && selected) { start.current = null; invalidate(); } }, [eventKey, selected?.id, reducedMotion, invalidate]);
  useFrame(() => {
    // A demand-rendered clock includes its idle gap in the next frame. Begin
    // the pulse in that first frame so a later selection cannot skip the burst.
    if (start.current === null) start.current = clock.elapsedTime;
    const t = clock.elapsedTime - start.current;
    if (!group.current) return;
    group.current.visible = !reducedMotion && !!selected && t >= 0 && t < 1.2;
    if (!group.current.visible) return;
    const p = t / 1.2;
    group.current.scale.setScalar(.3 + p * 1.8);
    material.opacity = Math.sin(p * Math.PI) * (1 - p) * .9;
    invalidate();
  });
  return <group>
    <group ref={group} position={selected?.world || [0, 0, 0]} visible={false}>{rays.map((geometry, i) => <line key={i} geometry={geometry} material={material} raycast={() => null} />)}</group>
    {!reducedMotion && edges.filter((edge) => edge.from.id === selected?.id || edge.to.id === selected?.id).slice(0, 7).map((edge) => <Spark key={`${eventKey}-${edge.id}`} edge={edge} />)}
  </group>;
}

function Spark({ edge }) {
  const mesh = useRef(), begun = useRef(null);
  const curve = useMemo(() => worldCurve(edge), [edge]);
  const { invalidate } = useThree();
  useFrame(({ clock }) => {
    if (begun.current === null) begun.current = clock.elapsedTime;
    const p = (clock.elapsedTime - begun.current) / 1.2;
    if (!mesh.current) return;
    mesh.current.visible = p < 1;
    if (p < 1) { mesh.current.position.copy(curve.getPoint(Math.max(0, p))); invalidate(); }
  });
  return <mesh ref={mesh} raycast={() => null}><sphereGeometry args={[.035, 8, 6]} /><meshBasicMaterial color="#fff2c4" /></mesh>;
}

function ProjectLabels({ labels, labelRefs, selectedId }) {
  const { size } = useThree();
  useFrame(({ camera }) => {
    for (const marker of labels) {
      const el = labelRefs.current.get(marker.id);
      if (!el) continue;
      const position = new Vector3(...marker.world);
      position.y += marker.decorative ? 0 : marker.id === 'invisible-spirit' ? .48 : -.29;
      position.project(camera);
      const visible = position.z > -1 && position.z < 1 && Math.abs(position.x) < 1.1 && Math.abs(position.y) < 1.1;
      el.style.visibility = visible ? 'visible' : 'hidden';
      el.style.transform = `translate(-50%, -50%) translate(${(position.x * .5 + .5) * size.width}px, ${(-position.y * .5 + .5) * size.height}px)`;
      el.classList.toggle('is-selected', marker.canonicalParentId === selectedId);
    }
  });
  return null;
}

function ControlsRig({ tradition, scene, zoom, focusLayer, cameraKey, reducedMotion }) {
  const { camera, gl, invalidate } = useThree();
  // Construction is side-effect free. StrictMode can disconnect/reconnect this
  // effect without leaving a disposed controls instance bound to the canvas.
  const controls = useMemo(() => new OrbitControls(camera), [camera]);
  const previous = useRef({ tradition: null, focus: null, cameraKey: null, zoom: 1 });
  useEffect(() => {
    controls.connect(gl.domElement);
    controls.enableDamping = !reducedMotion;
    controls.dampingFactor = .09;
    controls.minDistance = 2.2; controls.maxDistance = 28;
    controls.enableRotate = true;
    controls.maxPolarAngle = Math.PI * .76;
    controls.screenSpacePanning = true;
    controls.addEventListener('change', invalidate);
    return () => { controls.removeEventListener('change', invalidate); controls.dispose(); document.body.style.cursor = ''; };
  }, [controls, gl, invalidate, reducedMotion]);
  useEffect(() => {
    const old = previous.current;
    const reset = old.tradition !== tradition.id || old.focus !== focusLayer || old.cameraKey !== cameraKey;
    if (reset) {
      const focus = focusFor(scene, focusLayer);
      const target = focusLayer === 'all' ? tradition.id === 'tree' ? [0, 3.1, 0] : tradition.id === 'ezekiel' ? [0, 2, -.2] : [0, 1.0, -.8] : focus.world;
      controls.target.set(...target);
      const offset = tradition.id === 'tree' ? new Vector3(.3, 0, 12.4) : tradition.id === 'ezekiel' ? new Vector3(0, 4.5, 11.5) : new Vector3(0, 6.8, 10.5);
      camera.position.copy(controls.target).add(offset.multiplyScalar(1 / (zoom * focus.scale)));
    } else if (old.zoom !== zoom) camera.position.sub(controls.target).multiplyScalar(old.zoom / zoom).add(controls.target);
    previous.current = { tradition: tradition.id, focus: focusLayer, cameraKey, zoom };
    controls.update(); invalidate();
  }, [camera, controls, tradition.id, scene, zoom, focusLayer, cameraKey, invalidate]);
  useFrame(() => controls.update());
  return null;
}

function Scene({ scene, tradition, language, selectedId, onSelect, overlays, zoom, focusLayer, reducedMotion, eventKey, cameraKey, cloudUrl, labelRefs, labels }) {
  const selected = scene.canonical.find((marker) => marker.id === selectedId);
  return <>
    <ambientLight intensity={1.2} color="#d1dfc9" /><pointLight position={[0, 3, 3]} color="#ffe2a4" intensity={18} distance={20} />
    <ControlsRig {...{ tradition, scene, zoom, focusLayer, cameraKey, reducedMotion }} />
    <group key={tradition.id}>
      <Dust scene={scene} /><LightTrails traditionId={tradition.id} />
      {scene.rings.map((ring) => <Orbit key={ring.id} ring={ring} torus={overlays.torus} onSelect={onSelect} />)}
      {scene.edges.map((edge) => <Filament key={edge.id} edge={edge} active={edge.from.id === selectedId || edge.to.id === selectedId} />)}
      {scene.cloud && cloudUrl && <Cloud url={cloudUrl} position={scene.cloud.world} />}
      {scene.markers.map((marker) => <Marker key={marker.id} marker={marker} active={marker.canonicalParentId === selectedId} onSelect={onSelect} />)}
      <Glow position={tradition.id === 'tree' ? [0, 3.1, -.3] : [0, .05, 0]} size={tradition.id === 'tree' ? 10 : 12} strength={.26} color="#ae8f4d" />
      {scene.cloud && <Glow position={scene.cloud.world} size={4.2} strength={.3} color="#e5daa3" />}
      <Pulse selected={selected} edges={scene.edges} eventKey={eventKey} reducedMotion={reducedMotion} />
    </group>
    <ProjectLabels labels={labels} labelRefs={labelRefs} selectedId={selectedId} language={language} />
  </>;
}

class RenderBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailure?.('initialization'); }
  render() { return this.state.failed ? <div className="atlas-three-fallback" role="status">{this.props.fallbackText}</div> : this.props.children; }
}

export default function Atlas3D({ tradition, language = 'en', selectedId, onSelect, overlays = {}, zoom = 1, focusLayer = 'all', reducedMotion = false, eventKey = 0, cameraKey = 0, cloudUrl, onFailure }) {
  const scene = useMemo(() => getScene(tradition, overlays), [tradition, overlays.paired, overlays.planets, overlays.torus]);
  const labelRefs = useRef(new Map());
  const labels = useMemo(() => [
    ...scene.canonical.filter((m) => m.major || m.id === selectedId),
    ...(tradition.id === 'john' ? [{ id: 'realm-seven-heavens', canonicalParentId: null, decorative: true, kind: 'realm', world: [0, 4.4, -4.0], node: { label: { en: 'Seven heavens', he: 'שבעה רקיעים', ru: 'Семь небес' } } }] : []),
  ], [scene, selectedId, tradition.id]);
  const fallbackText = textFor({ en: 'Opening the accessible 2D map…', he: 'פותחים את המפה הדו־ממדית הנגישה…', ru: 'Открывается доступная двумерная карта…' }, language);
  const cleanup = useRef(null);
  useEffect(() => () => cleanup.current?.(), []);
  return <RenderBoundary onFailure={onFailure} fallbackText={fallbackText}>
    <div className="atlas-three" data-renderer="webgl" role="group" aria-label={textFor({ en: 'Interactive three-dimensional cosmology map', he: 'מפת קוסמולוגיה תלת־ממדית אינטראקטיבית', ru: 'Интерактивная трёхмерная карта космологии' }, language)}>
      <Canvas frameloop="demand" camera={{ fov: 43, near: .1, far: 70, position: [0, 7.8, 9.7] }} dpr={[1, typeof window !== 'undefined' && window.innerWidth < 760 ? 1.5 : 2]} gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
        onCreated={({ gl }) => {
          cleanup.current?.();
          const canvas = gl.domElement;
          const lost = (event) => {
            // Fiber intentionally releases a detached canvas on navigation.
            // Only a context lost by the currently displayed renderer is a failure.
            if (!canvas.isConnected) return;
            event.preventDefault();
            onFailure?.('context-lost');
          };
          canvas.addEventListener('webglcontextlost', lost);
          cleanup.current = () => canvas.removeEventListener('webglcontextlost', lost);
        }}>
        <Scene {...{ scene, tradition, language, selectedId, onSelect, overlays, zoom, focusLayer, reducedMotion, eventKey, cameraKey, cloudUrl, labelRefs, labels }} />
      </Canvas>
      <div className="atlas-three-labels">{labels.map((marker) => {
        const label = textFor(marker.node.label, language);
        const [name, meaning] = marker.kind === 'sefirah' ? label.split(/\s+·\s+/u) : [label];
        const content = meaning ? <>{name}<span className="atlas-label-gloss">{meaning}</span></> : label;
        const attributes = { ref: (element) => { if (element) labelRefs.current.set(marker.id, element); else labelRefs.current.delete(marker.id); }, className: `atlas-three-label${marker.decorative ? ' atlas-three-realm-label' : ''}${marker.id === selectedId ? ' is-selected' : ''}`, 'data-kind': marker.kind, dir: language === 'he' ? 'rtl' : 'ltr' };
        return marker.decorative ? <span key={marker.id} {...attributes} aria-hidden="true">{content}</span> : <button key={marker.id} type="button" {...attributes} data-node-id={marker.id} onClick={() => onSelect(marker.id)} aria-pressed={marker.id === selectedId}>{content}</button>;
      })}</div>
    </div>
  </RenderBoundary>;
}

import { Suspense, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useLoader } from '@react-three/fiber'
import { Billboard, Html, OrbitControls, Stars } from '@react-three/drei'
import * as THREE from 'three'
import { useTranslation } from 'react-i18next'
import type { Site } from '../lib/types'

const base = import.meta.env.BASE_URL as string
const tex = (f: string) => `${base}textures/${f}`

/** Position 3D d'un point (lat, lon Est) sur la sphère : la longitude 0 est au centre de la texture. */
export function toXYZ(lat: number, lon: number, r = 1): [number, number, number] {
  const la = (lat * Math.PI) / 180, lo = (lon * Math.PI) / 180
  return [r * Math.cos(la) * Math.cos(lo), r * Math.sin(la), -r * Math.cos(la) * Math.sin(lo)]
}

const COLORS: Record<string, string> = { atterrie: '#6fe3a1', planifiee: '#8ab4ff', echec: '#ff8a8a', reference: '#ffffff' }

function Marker({ site, selected, onSelect }: { site: Site; selected: boolean; onSelect: (id: string) => void }) {
  const [hover, setHover] = useState(false)
  const p = useMemo(() => toXYZ(site.lat, site.lon, 1.012), [site])
  const c = COLORS[site.statut] ?? '#ffffff'
  return (
    <group position={p}>
      <mesh
        onClick={(e) => { e.stopPropagation(); onSelect(site.id) }}
        onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = 'pointer' }}
        onPointerOut={() => { setHover(false); document.body.style.cursor = '' }}
      >
        <sphereGeometry args={[selected || hover ? 0.045 : 0.03, 16, 16]} />
        <meshBasicMaterial color={selected ? '#ffd166' : c} toneMapped={false} />
      </mesh>
      {selected && (
        <mesh>
          <ringGeometry args={[0.06, 0.075, 32]} />
          <meshBasicMaterial color="#ffd166" side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
      )}
      {(hover || selected) && (
        <Html center style={{ pointerEvents: 'none' }} position={[0, 0.1, 0]}>
          <span className="moon-label">{site.nom}</span>
        </Html>
      )}
    </group>
  )
}

function Moon({ sites, selected, onSelect, reduced }: { sites: Site[]; selected: string; onSelect: (id: string) => void; reduced: boolean }) {
  const [color, bump] = useLoader(THREE.TextureLoader, [tex('moon_color_2k.jpg'), tex('moon_bump.jpg')])
  color.colorSpace = THREE.SRGBColorSpace
  color.anisotropy = 8
  const spin = useRef<THREE.Group>(null)
  useFrame((_, dt) => { if (!reduced && spin.current) spin.current.rotation.y += dt * 0.05 })
  return (
    <group rotation={[-0.95, 0, 0]}>
      <group ref={spin} rotation={[0, 0.6, 0]}>
        <mesh>
          <sphereGeometry args={[1, 96, 96]} />
          <meshStandardMaterial map={color} bumpMap={bump} bumpScale={0.025} roughness={1} metalness={0} />
        </mesh>
        {sites.map((s) => <Marker key={s.id} site={s} selected={s.id === selected} onSelect={onSelect} />)}
      </group>
    </group>
  )
}

function EarthSprite() {
  const map = useLoader(THREE.TextureLoader, tex('earth_bluemarble.jpg'))
  map.colorSpace = THREE.SRGBColorSpace
  return (
    <Billboard position={[2.6, 1.2, -3.2]}>
      <mesh>
        <circleGeometry args={[0.42, 64]} />
        <meshBasicMaterial map={map} toneMapped={false} />
      </mesh>
    </Billboard>
  )
}

export function webglAvailable() {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch { return false }
}

/** Lune 3D de l'accueil : le Soleil est une simple source de lumière (jour/nuit), la Terre est petite en arrière-plan. */
export default function MoonScene({ sites, selected, onSelect, reduced }: { sites: Site[]; selected: string; onSelect: (id: string) => void; reduced: boolean }) {
  const { t } = useTranslation()
  if (!webglAvailable())
    return (
      <div className="moon-fallback">
        <img src={tex('moon_color_2k.jpg')} alt={t('home.fallbackAlt')} />
        <p className="muted small">{t('home.noWebgl')}</p>
      </div>
    )
  return (
    <Canvas camera={{ position: [0, 0, 3.4], fov: 38 }} dpr={[1, 2]} aria-label={t('home.canvasLabel')}>
      <color attach="background" args={['#070b18']} />
      <ambientLight intensity={0.1} />
      <directionalLight position={[4, 1.2, 3]} intensity={2.6} />
      <Stars radius={60} depth={30} count={2200} factor={3} fade speed={0} />
      <Suspense fallback={null}>
        <Moon sites={sites} selected={selected} onSelect={onSelect} reduced={reduced} />
        <EarthSprite />
      </Suspense>
      <OrbitControls enablePan={false} minDistance={2.1} maxDistance={5.5} rotateSpeed={0.6} />
    </Canvas>
  )
}

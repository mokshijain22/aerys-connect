'use client';

import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { useGLTF, ContactShadows } from '@react-three/drei';

function Model() {
  const { scene } = useGLTF('/aerys-scooter.glb');
  return (
    <primitive
      object={scene}
      scale={1.8}
      position={[0, -1, 0]}
      rotation={[0, Math.PI * 0.85, 0]}
    />
  );
}

function Fallback() {
  return (
    <mesh>
      <boxGeometry args={[0.5, 0.5, 0.5]} />
      <meshStandardMaterial color="#6C5CE7" wireframe />
    </mesh>
  );
}

export function ScooterModel({ className = '' }: { className?: string }) {
  return (
    <div className={className} style={{ width: '100%', height: '100%' }}>
      <Canvas
        camera={{ position: [3.5, 1.2, 5], fov: 28 }}
        gl={{ alpha: true, antialias: true }}
        style={{ background: 'transparent', width: '100%', height: '100%' }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
        }}
      >
        <ambientLight intensity={1} />
        <directionalLight position={[3, 5, 4]} intensity={1.8} />
        <directionalLight position={[-4, 2, -3]} intensity={0.7} />
        <directionalLight position={[0, -2, 3]} intensity={0.4} />
        <Suspense fallback={<Fallback />}>
          <Model />
          <ContactShadows position={[0, -1.05, 0]} opacity={0.35} scale={6} blur={2.2} far={2} />
        </Suspense>
      </Canvas>
    </div>
  );
}

useGLTF.preload('/aerys-scooter.glb');
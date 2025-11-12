import { useRef, useState, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { Mesh } from "three";

interface AnimatedRingsProps {
  position: [number, number, number];
}

interface PulseRing {
  scale: number;
  opacity: number;
  rotation: [number, number, number];
}

export default function AnimatedRings({ position }: AnimatedRingsProps) {
  const ring1Ref = useRef<Mesh>(null);
  const ring2Ref = useRef<Mesh>(null);
  const ring3Ref = useRef<Mesh>(null);
  const [pulseRings, setPulseRings] = useState<PulseRing[]>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      setPulseRings((prev) => {
        const newRing: PulseRing = {
          scale: 1.0,
          opacity: 1,
          rotation: [
            Math.random() * Math.PI,
            Math.random() * Math.PI,
            Math.random() * Math.PI,
          ],
        };
        return [...prev, newRing].slice(-5);
      });
    }, 800);

    return () => clearInterval(interval);
  }, []);

  useFrame((state, delta) => {
    if (ring1Ref.current) {
      ring1Ref.current.rotation.z += delta * 1.0;
      ring1Ref.current.rotation.x += delta * 0.3;
    }
    if (ring2Ref.current) {
      ring2Ref.current.rotation.x += delta * 0.8;
      ring2Ref.current.rotation.y += delta * 0.4;
    }
    if (ring3Ref.current) {
      ring3Ref.current.rotation.y += delta * 0.6;
      ring3Ref.current.rotation.z += delta * 0.5;
    }

    setPulseRings((prev) =>
      prev.map((ring) => ({
        ...ring,
        scale: ring.scale + delta * 2,
        opacity: Math.max(0, ring.opacity - delta * 0.8),
      })).filter((ring) => ring.opacity > 0)
    );
  });

  return (
    <group position={position}>
      <mesh ref={ring1Ref} rotation={[Math.PI / 3, Math.PI / 4, 0]}>
        <torusGeometry args={[5.5, 0.04, 16, 100]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.8} />
      </mesh>
      <mesh ref={ring2Ref} rotation={[Math.PI / 4, Math.PI / 3, Math.PI / 6]}>
        <torusGeometry args={[6.0, 0.04, 16, 100]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.6} />
      </mesh>
      <mesh ref={ring3Ref} rotation={[Math.PI / 5, Math.PI / 2, Math.PI / 4]}>
        <torusGeometry args={[6.5, 0.04, 16, 100]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.5} />
      </mesh>
      {pulseRings.map((ring, index) => (
        <mesh
          key={index}
          rotation={ring.rotation}
          scale={[ring.scale, ring.scale, ring.scale]}
        >
          <torusGeometry args={[5.5, 0.05, 16, 100]} />
          <meshBasicMaterial
            color="#ffffff"
            transparent
            opacity={ring.opacity * 0.6}
          />
        </mesh>
      ))}
    </group>
  );
}


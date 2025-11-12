import { forwardRef, useEffect, useRef } from "react";
import {
  Mesh,
  Group,
  MeshStandardMaterial,
  VideoTexture,
  ClampToEdgeWrapping,
  Texture,
} from "three";
import { useFrame } from "@react-three/fiber";
import { gsap } from "gsap";
import { Node } from "../data/nodes";
import AnimatedRings from "./AnimatedRings";
import {
  initSharedImageTexture,
  getSharedImageTexture,
  onTextureLoaded,
} from "./SharedGifTexture";

interface NodeSphereProps {
  node: Node;
  isSelected: boolean;
  isHovered: boolean;
  onClick: () => void;
}

const NodeSphere = forwardRef<Mesh, NodeSphereProps>(
  ({ node, isSelected, isHovered, onClick }, ref) => {
    const meshRef = useRef<Mesh>(null);
    const groupRef = useRef<Group>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const videoTextureRef = useRef<VideoTexture | null>(null);
    const textureRef = useRef<Texture | null>(null);
    const materialRef = useRef<MeshStandardMaterial | null>(null);

    useEffect(() => {
      initSharedImageTexture();
      const currentTexture = getSharedImageTexture();
      if (currentTexture) {
        textureRef.current = currentTexture;
      }

      // Подписываемся на загрузку текстуры
      onTextureLoaded((texture) => {
        textureRef.current = texture;
        // Принудительно обновляем материал
        if (materialRef.current) {
          materialRef.current.map = texture;
          materialRef.current.emissiveMap = texture;
          materialRef.current.needsUpdate = true;
        }
      });
    }, []);

    useEffect(() => {
      if (isSelected) {
        const video = document.createElement("video");
        video.src = "/activeBallBG.mov";
        video.loop = true;
        video.muted = true;
        video.playsInline = true;
        video.autoplay = true;
        video.preload = "auto";

        video.addEventListener("loadeddata", () => {
          video.play().catch(console.error);
          if (video) {
            const videoTexture = new VideoTexture(video);
            videoTexture.generateMipmaps = false;
            videoTexture.wrapS = ClampToEdgeWrapping;
            videoTexture.wrapT = ClampToEdgeWrapping;
            videoTexture.offset.set(0, 0);
            videoTexture.repeat.set(1, 1);
            videoTextureRef.current = videoTexture;
          }
        });

        videoRef.current = video;

        return () => {
          if (videoTextureRef.current) {
            videoTextureRef.current.dispose();
          }
          if (videoRef.current) {
            videoRef.current.pause();
            videoRef.current = null;
          }
        };
      }
    }, [isSelected]);

    useEffect(() => {
      const targetScale = isSelected ? 1.5 : 1;
      const mesh = meshRef.current;

      if (mesh) {
        gsap.to(mesh.scale, {
          x: targetScale,
          y: targetScale,
          z: targetScale,
          duration: 0.8,
          ease: "power2.out",
        });
      }
    }, [isSelected]);

    useFrame(() => {
      const mesh = meshRef.current;
      if (mesh) {
        mesh.userData.nodeId = node.id;
        const material = mesh.material as MeshStandardMaterial;
        if (material) {
          materialRef.current = material;

          // Получаем актуальную текстуру
          const currentTexture = textureRef.current || getSharedImageTexture();
          if (currentTexture && currentTexture !== textureRef.current) {
            textureRef.current = currentTexture;
          }

          if (isSelected && videoTextureRef.current) {
            material.map = null;
            material.emissiveMap = videoTextureRef.current;
            // подсветка
            material.emissiveIntensity = 0.5;
            material.color.set("#ffffff");
          } else if (currentTexture) {
            // Принудительно применяем текстуру
            if (material.map !== currentTexture) {
              material.map = currentTexture;
            }
            if (material.emissiveMap !== currentTexture) {
              material.emissiveMap = currentTexture;
            }
            material.emissiveIntensity = isHovered ? 0.5 : 0;
            material.color.set("#ffffff");
            material.emissive.set("#ffffff");
            material.metalness = 0;
            material.roughness = 1;
            material.needsUpdate = true;
            if (currentTexture) {
              currentTexture.offset.set(0, 0);
              currentTexture.repeat.set(1, 1);
              currentTexture.center.set(0.5, 0.5);
              currentTexture.rotation = 0;
            }
          }
        }
      }
      const group = groupRef.current;
      if (group && ref) {
        if (typeof ref === "function") {
          ref(group as any);
        } else if (ref) {
          (ref as React.MutableRefObject<Mesh | null>).current = group as any;
        }
      }
    });

    const handleClick = (e: any) => {
      e.stopPropagation();
      onClick();
    };

    const baseColor = "#4A90E2";
    const emissiveIntensity = isSelected ? 1.5 : isHovered ? 1.0 : 0.8;

    return (
      <group
        ref={groupRef}
        position={[node.position.x, node.position.y, node.position.z]}
      >
        <mesh
          ref={meshRef}
          onClick={handleClick}
          scale={[1, 1, 1]}
          rotation={[0, 0, 0]}
        >
          <sphereGeometry args={[3, 32, 32]} />
          <meshStandardMaterial
            color={isSelected ? "#ffffff" : "#ffffff"}
            emissive={isSelected ? baseColor : "#ffffff"}
            emissiveIntensity={emissiveIntensity}
            metalness={0.1}
            roughness={0.05}
          />
        </mesh>
        {isSelected && <AnimatedRings position={[0, 0, 0]} />}
      </group>
    );
  }
);

NodeSphere.displayName = "NodeSphere";

export default NodeSphere;

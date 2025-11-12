import { useRef, useEffect, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { PerspectiveCamera, Vector3, Mesh } from "three";
import { gsap } from "gsap";
import { nodes } from "../data/nodes";
import VideoBackground from "./VideoBackground";
import NodeSphere from "./NodeSphere";
import NodeLabel from "./NodeLabel";
import NodeConnections from "./NodeConnections";
import { initSharedImageTexture } from "./SharedGifTexture";

const INITIAL_SELECTED_NODE_ID = "50";

export default function Scene3D() {
  const { camera, raycaster, pointer, gl } = useThree();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(
    INITIAL_SELECTED_NODE_ID
  );
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const cameraRef = useRef<PerspectiveCamera>(camera as PerspectiveCamera);
  const nodeRefs = useRef<{ [key: string]: Mesh }>({});

  // Инициализируем текстуру один раз для всех компонентов
  useEffect(() => {
    initSharedImageTexture();
  }, []);

  const FIXED_CAMERA_Z = 35; // Фиксированное расстояние камеры от плоскости с шарами

  useEffect(() => {
    const initialNode = nodes.find((n) => n.id === INITIAL_SELECTED_NODE_ID);
    if (initialNode) {
      const targetPosition = new Vector3(
        initialNode.position.x,
        initialNode.position.y,
        FIXED_CAMERA_Z
      );
      cameraRef.current.position.copy(targetPosition);
      const lookAtPoint = new Vector3(
        initialNode.position.x,
        initialNode.position.y,
        -5
      );
      cameraRef.current.lookAt(lookAtPoint);
      cameraRef.current.updateProjectionMatrix();
    }
  }, []);

  const handleNodeClick = (nodeId: string) => {
    if (selectedNodeId === nodeId) return;

    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;

    setSelectedNodeId(nodeId);

    // Анимируем только X и Y, Z остается фиксированным
    gsap.to(cameraRef.current.position, {
      duration: 1.5,
      x: node.position.x,
      y: node.position.y,
      z: FIXED_CAMERA_Z, // Фиксируем Z
      ease: "power2.inOut",
    });
  };

  useFrame(() => {
    // Фиксируем Z камеры, чтобы избежать перспективных искажений
    if (Math.abs(cameraRef.current.position.z - FIXED_CAMERA_Z) > 0.01) {
      cameraRef.current.position.z = FIXED_CAMERA_Z;
    }

    const lookAtPoint = new Vector3(
      cameraRef.current.position.x,
      cameraRef.current.position.y,
      -5
    );
    cameraRef.current.lookAt(lookAtPoint);

    raycaster.setFromCamera(pointer, cameraRef.current);
    const intersects = raycaster.intersectObjects(
      Object.values(nodeRefs.current),
      true
    );

    if (intersects.length > 0) {
      const intersectedNode = intersects[0].object.userData.nodeId as string;
      if (intersectedNode && intersectedNode !== hoveredNodeId) {
        setHoveredNodeId(intersectedNode);
        gl.domElement.style.cursor = "pointer";
      }
    } else {
      if (hoveredNodeId) {
        setHoveredNodeId(null);
        gl.domElement.style.cursor = "default";
      }
    }
  });

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <pointLight position={[-10, -10, -5]} intensity={0.5} />

      <VideoBackground />

      <group rotation={[0, 0, 0]} position={[0, 0, -5]}>
        <NodeConnections />
        {nodes.map((node) => (
          <group key={node.id}>
            <NodeSphere
              node={node}
              isSelected={selectedNodeId === node.id}
              isHovered={hoveredNodeId === node.id}
              onClick={() => handleNodeClick(node.id)}
              ref={(el) => {
                if (el) {
                  nodeRefs.current[node.id] = el;
                }
              }}
            />
            <NodeLabel node={node} isSelected={selectedNodeId === node.id} />
          </group>
        ))}
      </group>
    </>
  );
}

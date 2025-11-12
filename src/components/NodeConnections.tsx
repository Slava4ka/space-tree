import { useMemo } from "react";
import { nodes } from "../data/nodes";
import { BufferGeometry, Vector3 } from "three";

const GRID_SIZE = 10;

export default function NodeConnections() {
  const connections = useMemo(() => {
    const lines: Array<{
      from: { x: number; y: number; z: number };
      to: { x: number; y: number; z: number };
    }> = [];

    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        const node = nodes[row * GRID_SIZE + col];
        if (!node) continue;

        if (col < GRID_SIZE - 1) {
          const rightNode = nodes[row * GRID_SIZE + col + 1];
          if (rightNode) {
            lines.push({
              from: node.position,
              to: rightNode.position,
            });
          }
        }

        if (row < GRID_SIZE - 1) {
          const bottomNode = nodes[(row + 1) * GRID_SIZE + col];
          if (bottomNode) {
            lines.push({
              from: node.position,
              to: bottomNode.position,
            });
          }
        }
      }
    }

    return lines;
  }, []);

  return (
    <>
      {connections.map((line, index) => {
        const points = [
          new Vector3(line.from.x, line.from.y, line.from.z),
          new Vector3(line.to.x, line.to.y, line.to.z),
        ];
        const geometry = new BufferGeometry().setFromPoints(points);

        return (
          <group key={index}>
            <line geometry={geometry}>
              <lineBasicMaterial 
                color="#4A90E2" 
                opacity={0.6} 
                transparent 
                linewidth={2}
              />
            </line>
            <line geometry={geometry}>
              <lineBasicMaterial 
                color="#6BB6FF" 
                opacity={0.3} 
                transparent 
                linewidth={4}
              />
            </line>
          </group>
        );
      })}
    </>
  );
}

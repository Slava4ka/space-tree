import { Html } from "@react-three/drei";
import { Node } from "../data/nodes";

interface NodeLabelProps {
  node: Node;
  isSelected?: boolean;
}

export default function NodeLabel({ node, isSelected = false }: NodeLabelProps) {
  const titleFontSize = isSelected ? "18px" : "12px";
  const descriptionFontSize = isSelected ? "14px" : "10px";
  const maxWidth = isSelected ? "250px" : "200px";

  return (
    <Html
      position={[node.position.x, node.position.y - 1.5, node.position.z]}
      center
      style={{
        pointerEvents: "none",
        userSelect: "none",
      }}
    >
      <div
        style={{
          color: "#ffffff",
          textAlign: "center",
          fontSize: titleFontSize,
          lineHeight: "1.3",
          whiteSpace: "pre-line",
          textShadow: "0 0 10px rgba(0,0,0,0.8), 0 0 5px rgba(0,0,0,0.8)",
          maxWidth: maxWidth,
          display: "-webkit-box",
          WebkitLineClamp: 3,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
          transition: "font-size 0.8s ease, max-width 0.8s ease",
        }}
      >
        <div style={{ fontWeight: "bold", marginBottom: "2px" }}>
          {node.title}
        </div>
        <div 
          style={{ 
            fontSize: descriptionFontSize, 
            opacity: 0.9,
            transition: "font-size 0.8s ease",
          }}
        >
          {node.description.split("\n").slice(0, 2).join("\n")}
        </div>
      </div>
    </Html>
  );
}


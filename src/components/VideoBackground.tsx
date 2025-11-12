import { useRef, useEffect } from "react";
import {
  Mesh,
  VideoTexture,
  MeshBasicMaterial,
  LinearFilter,
  BackSide,
} from "three";

export default function VideoBackground() {
  const meshRef = useRef<Mesh>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const textureRef = useRef<VideoTexture | null>(null);

  useEffect(() => {
    const video = document.createElement("video");
    video.src = "/HEX.mp4";
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.autoplay = true;
    video.preload = "auto";

    const setupTexture = () => {
      if (meshRef.current && video && video.readyState >= 2) {
        const texture = new VideoTexture(video);
        texture.generateMipmaps = false;
        texture.minFilter = LinearFilter;
        texture.magFilter = LinearFilter;
        textureRef.current = texture;
        const material = new MeshBasicMaterial({
          map: texture,
          side: BackSide,
        });
        meshRef.current.material = material;
      }
    };

    video.addEventListener("loadeddata", () => {
      video.play().catch(console.error);
      setupTexture();
    });

    video.addEventListener("error", (e) => {
      console.error("Video loading error:", e);
    });

    videoRef.current = video;

    return () => {
      if (textureRef.current) {
        textureRef.current.dispose();
      }
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current = null;
      }
    };
  }, []);

  return (
    <mesh ref={meshRef} scale={[100, 100, 100]}>
      <sphereGeometry args={[1, 64, 64]} />
    </mesh>
  );
}

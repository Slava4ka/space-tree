import { Canvas } from '@react-three/fiber'
import Scene3D from './components/Scene3D'

function App() {
  return (
    <Canvas
      camera={{ position: [0, 0, 35], fov: 55, near: 0.1, far: 200 }}
      gl={{ antialias: true, alpha: false }}
    >
      <Scene3D />
    </Canvas>
  )
}

export default App


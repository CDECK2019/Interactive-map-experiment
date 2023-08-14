import React from 'react';
import { useLoader } from '@react-three/fiber';
import { TextureLoader } from 'three/src/loaders/TextureLoader';

const ThreeMesh = () => {
  const earthMap = useLoader(
    TextureLoader,
    '/earth-assets/8k_earth_daymap.jpg'
  );
  const starMap = useLoader(TextureLoader, '/earth-assets/starmap_g4k.jpg');
  return (
    <mesh>
      <sphereGeometry args={[0.5, 32, 32]} />
      <meshStandardMaterial map={earthMap} />
    </mesh>
  );
};

export default ThreeMesh;

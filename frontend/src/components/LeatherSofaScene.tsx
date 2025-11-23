'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls, RoundedBox, Center } from '@react-three/drei';

function LeatherSofa() {
  // 가죽 재질 설정 (이미지 없이 수치로만 구현)
  const leatherMaterialProps = {
    color: "#5D4037", // 고급스러운 진한 갈색
    roughness: 0.4,   // 약간의 광택 (가죽 느낌)
    metalness: 0.1,   // 아주 약간의 금속성
  };

  return (
    <group>
      {/* 1. 좌석 (두께감 있는 쿠션) */}
      <RoundedBox args={[1.2, 0.4, 1.2]} radius={0.05} smoothness={4} position={[0, 0.2, 0]}>
        <meshStandardMaterial {...leatherMaterialProps} />
      </RoundedBox>

      {/* 2. 등받이 */}
      <RoundedBox args={[1.2, 0.8, 0.3]} radius={0.05} smoothness={4} position={[0, 0.8, -0.45]}>
        <meshStandardMaterial {...leatherMaterialProps} />
      </RoundedBox>

      {/* 3. 왼쪽 팔걸이 */}
      <RoundedBox args={[0.25, 0.6, 1.2]} radius={0.05} smoothness={4} position={[-0.725, 0.3, 0]}>
        <meshStandardMaterial {...leatherMaterialProps} />
      </RoundedBox>

      {/* 4. 오른쪽 팔걸이 */}
      <RoundedBox args={[0.25, 0.6, 1.2]} radius={0.05} smoothness={4} position={[0.725, 0.3, 0]}>
        <meshStandardMaterial {...leatherMaterialProps} />
      </RoundedBox>
      
      {/* 5. 다리 (심플한 검은색) - 살짝 띄워줌 */}
      <mesh position={[-0.5, -0.1, 0.5]}>
        <cylinderGeometry args={[0.05, 0.03, 0.2]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      <mesh position={[0.5, -0.1, 0.5]}>
        <cylinderGeometry args={[0.05, 0.03, 0.2]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      <mesh position={[-0.5, -0.1, -0.5]}>
        <cylinderGeometry args={[0.05, 0.03, 0.2]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      <mesh position={[0.5, -0.1, -0.5]}>
        <cylinderGeometry args={[0.05, 0.03, 0.2]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
    </group>
  );
}

export default function LeatherSofaScene() {
  return (
    <div className="w-full h-[500px] bg-black rounded-lg overflow-hidden relative">
      <Canvas camera={{ position: [3, 2, 4], fov: 45 }}>
        {/* 배경색 지정 (완전한 블랙) */}
        <color attach="background" args={['#000000']} />

        {/* 조명: 가죽의 질감을 살리기 위한 스팟 조명 */}
        <ambientLight intensity={0.3} />
        <spotLight 
          position={[5, 10, 5]} 
          angle={0.3} 
          penumbra={1} 
          intensity={1.5} 
          castShadow 
        />
        {/* 뒤쪽에서 오는 은은한 림 라이트 (입체감) */}
        <pointLight position={[-5, 5, -5]} intensity={0.5} color="#0000ff" />

        <Center>
          <LeatherSofa />
        </Center>

        <OrbitControls 
          enablePan={false}
          minPolarAngle={0} 
          maxPolarAngle={Math.PI / 2} // 바닥 아래로 못 내려가게
        />
      </Canvas>
    </div>
  );
}



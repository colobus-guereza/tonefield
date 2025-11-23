'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface SpacePterosaurProps {
  position?: [number, number, number];
  scale?: number;
  speed?: number;
}

export default function SpacePterosaur({ 
  position = [0, 0, 0], 
  scale = 1,
  speed = 1.2 
}: SpacePterosaurProps) {
  const groupRef = useRef<THREE.Group>(null);
  const wingLeftRef = useRef<THREE.Group>(null);
  const wingRightRef = useRef<THREE.Group>(null);
  const tailRef = useRef<THREE.Group>(null);
  
  // 색상 변경을 위한 Material refs
  const bodyMaterialRef = useRef<THREE.MeshStandardMaterial>(null);
  const headMaterialRef = useRef<THREE.MeshStandardMaterial>(null);
  const tailMaterialRef = useRef<THREE.MeshStandardMaterial>(null);
  const wingLeftMaterialRef = useRef<THREE.MeshPhysicalMaterial>(null);
  const wingRightMaterialRef = useRef<THREE.MeshPhysicalMaterial>(null);
  
  // 비행 경로 애니메이션
  const timeRef = useRef(0);
  const basePositionRef = useRef<THREE.Vector3>(new THREE.Vector3(...position));
  
  // 색상 변화를 위한 시드값 (랜덤 초기값)
  const colorSeedRef = useRef({
    bodyHue: Math.random() * 360,
    wingHue: Math.random() * 360,
    bodySpeed: 0.05 + Math.random() * 0.05, // 느린 변화 속도
    wingSpeed: 0.05 + Math.random() * 0.05,
  });
  
  useFrame((state, delta) => {
    if (!groupRef.current) return;
    
    timeRef.current += delta * speed;
    
    // 3D 공간에서 자유로운 비행 경로 (여러 주파수의 사인파 조합)
    const t = timeRef.current;
    
    // X축: 매우 넓은 원형 경로 (반경 15.0)
    const radiusX = 15.0;
    const x = basePositionRef.current.x + Math.cos(t * 0.1) * radiusX;
    
    // Y축: 상하로 넓게 움직임 (범위 확대)
    const y = basePositionRef.current.y + Math.sin(t * 0.12) * 10.0 + Math.cos(t * 0.08) * 5.0;
    
    // Z축: 앞뒤로 넓게 움직임 (범위 확대)
    const z = basePositionRef.current.z + Math.sin(t * 0.11) * 12.0 + Math.cos(t * 0.09) * 8.0;
    
    // 위치 업데이트
    groupRef.current.position.set(x, y, z);
    
    // 비행 방향에 따른 회전 (자연스러운 비행 자세) - 넓은 범위에 맞게 조정
    const forwardX = -Math.sin(t * 0.1) * 0.1;
    const forwardY = Math.cos(t * 0.12) * 0.12 + Math.sin(t * 0.08) * 0.08;
    const forwardZ = Math.cos(t * 0.11) * 0.11;
    
    // 비행 방향을 향하도록 회전
    groupRef.current.rotation.y = Math.atan2(forwardX, forwardZ);
    groupRef.current.rotation.x = Math.atan2(forwardY, Math.sqrt(forwardX * forwardX + forwardZ * forwardZ)) * 0.3;
    groupRef.current.rotation.z = Math.sin(t * 0.5) * 0.2; // 약간의 롤링 효과
    
    // 날개 펄럭임 (부드러운 사인파)
    const wingFlap = Math.sin(t * 8) * 0.3;
    if (wingLeftRef.current) {
      wingLeftRef.current.rotation.z = wingFlap;
    }
    if (wingRightRef.current) {
      wingRightRef.current.rotation.z = -wingFlap;
    }
    
    // 꼬리 흔들림
    if (tailRef.current) {
      tailRef.current.rotation.y = Math.sin(t * 4) * 0.2;
      tailRef.current.rotation.z = Math.sin(t * 6) * 0.1;
    }
    
    // 본체 색상 변화 (느리게 끊임없이)
    const colorTime = t * 0.1; // 매우 느린 변화
    colorSeedRef.current.bodyHue += delta * colorSeedRef.current.bodySpeed * 10;
    colorSeedRef.current.wingHue += delta * colorSeedRef.current.wingSpeed * 10;
    
    // HSL 색상 생성 (본체: 어두운 톤, 날개: 밝은 톤)
    const bodyHue = colorSeedRef.current.bodyHue % 360;
    const wingHue = colorSeedRef.current.wingHue % 360;
    
    // 본체 색상 (어두운 톤, 낮은 채도와 명도)
    const bodyColor = new THREE.Color().setHSL(
      bodyHue / 360,
      0.4 + Math.sin(colorTime * 0.3) * 0.2, // 채도 변화
      0.15 + Math.sin(colorTime * 0.5) * 0.1  // 명도 변화
    );
    
    // 날개 색상 (밝은 톤, 높은 채도)
    const wingColor = new THREE.Color().setHSL(
      wingHue / 360,
      0.7 + Math.sin(colorTime * 0.4) * 0.2, // 채도 변화
      0.5 + Math.sin(colorTime * 0.6) * 0.2   // 명도 변화
    );
    
    // Material 색상 업데이트
    if (bodyMaterialRef.current) {
      bodyMaterialRef.current.color.copy(bodyColor);
    }
    if (headMaterialRef.current) {
      headMaterialRef.current.color.copy(bodyColor);
    }
    if (tailMaterialRef.current) {
      tailMaterialRef.current.color.copy(bodyColor);
    }
    if (wingLeftMaterialRef.current) {
      wingLeftMaterialRef.current.color.copy(wingColor);
      wingLeftMaterialRef.current.emissive.copy(wingColor);
    }
    if (wingRightMaterialRef.current) {
      wingRightMaterialRef.current.color.copy(wingColor);
      wingRightMaterialRef.current.emissive.copy(wingColor);
    }
  });

  // 초기 위치 저장
  if (basePositionRef.current.x !== position[0] || 
      basePositionRef.current.y !== position[1] || 
      basePositionRef.current.z !== position[2]) {
    basePositionRef.current.set(...position);
  }

  // 우주 익룡 초기 색상 정의
  const initialBodyColor = "#1a1a2e"; // 어두운 남색 (외골격)
  const initialWingColor = "#4488ff"; // 푸른색 (에너지 날개)
  const emissiveColor = "#00ffff"; // 청록색 (발광 포인트)

  return (
    <group ref={groupRef} position={position} scale={scale}>
      {/* --- 몸통 (Body) --- */}
      <mesh position={[0, 0, 0]} rotation={[0.2, 0, 0]}>
        <coneGeometry args={[0.8, 3, 6]} /> {/* 다각형 뿔 형태로 거친 느낌 */}
        <meshStandardMaterial 
          ref={bodyMaterialRef}
          color={initialBodyColor} 
          roughness={0.7} 
          metalness={0.3}
          flatShading={true} // 각진 느낌 강조
        />
      </mesh>

      {/* --- 머리 (Head) --- */}
      <group position={[0, 1.8, 0.5]} rotation={[-0.3, 0, 0]}>
        {/* 두개골 */}
        <mesh>
          <dodecahedronGeometry args={[0.5, 0]} /> {/* 다면체 형태 */}
          <meshStandardMaterial ref={headMaterialRef} color={initialBodyColor} roughness={0.6} metalness={0.4} flatShading={true} />
        </mesh>
        {/* 부리 (Beak) */}
        <mesh position={[0, 0, 0.6]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.2, 1, 4]} />
          <meshStandardMaterial color="#333344" roughness={0.2} metalness={0.8} /> {/* 수정 같은 느낌 */}
        </mesh>
        {/* 눈 (Eyes) - 발광 */}
        <mesh position={[0.25, 0.1, 0.2]} rotation={[0, 0.3, 0]}>
          <icosahedronGeometry args={[0.1, 0]} />
          <meshStandardMaterial color={emissiveColor} emissive={emissiveColor} emissiveIntensity={2} />
        </mesh>
        <mesh position={[-0.25, 0.1, 0.2]} rotation={[0, -0.3, 0]}>
          <icosahedronGeometry args={[0.1, 0]} />
          <meshStandardMaterial color={emissiveColor} emissive={emissiveColor} emissiveIntensity={2} />
        </mesh>
        {/* 머리 돌기 (Crest) - 발광 */}
        <mesh position={[0, 0.5, -0.2]} rotation={[-0.5, 0, 0]}>
          <coneGeometry args={[0.1, 0.8, 4]} />
          <meshStandardMaterial color={emissiveColor} emissive={emissiveColor} emissiveIntensity={1} />
        </mesh>
      </group>

      {/* --- 날개 (Wings) - 에너지 형태 --- */}
      <group>
        {/* 왼쪽 날개 */}
        <group ref={wingLeftRef} position={[-2, 0.5, 0]} rotation={[0, 0, Math.PI / 3]}>
          <mesh>
            <boxGeometry args={[4, 0.05, 2]} /> {/* 얇은 판 형태 */}
            <meshPhysicalMaterial 
              ref={wingLeftMaterialRef}
              color={initialWingColor}
              transparent={true}
              opacity={0.6} // 반투명
              emissive={initialWingColor}
              emissiveIntensity={0.5}
              roughness={0.1}
              metalness={0.1}
              side={THREE.DoubleSide} // 양면 렌더링
            />
          </mesh>
        </group>
        {/* 오른쪽 날개 (대칭) */}
        <group ref={wingRightRef} position={[2, 0.5, 0]} rotation={[0, 0, -Math.PI / 3]}>
          <mesh>
            <boxGeometry args={[4, 0.05, 2]} />
            <meshPhysicalMaterial 
              ref={wingRightMaterialRef}
              color={initialWingColor}
              transparent={true}
              opacity={0.6}
              emissive={initialWingColor}
              emissiveIntensity={0.5}
              roughness={0.1}
              metalness={0.1}
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>
        {/* 날개 골격 발광 포인트 */}
        <mesh position={[-3.8, 1.5, 0]}>
          <sphereGeometry args={[0.1, 8, 8]} />
          <meshStandardMaterial color={emissiveColor} emissive={emissiveColor} emissiveIntensity={1.5} />
        </mesh>
        <mesh position={[3.8, 1.5, 0]}>
          <sphereGeometry args={[0.1, 8, 8]} />
          <meshStandardMaterial color={emissiveColor} emissive={emissiveColor} emissiveIntensity={1.5} />
        </mesh>
      </group>

      {/* --- 꼬리 (Tail) --- */}
      <group ref={tailRef} position={[0, -1.5, 0]} rotation={[3.2, 0, 0]}>
        <mesh>
          <coneGeometry args={[0.4, 2, 6]} />
          <meshStandardMaterial ref={tailMaterialRef} color={initialBodyColor} roughness={0.7} metalness={0.3} flatShading={true} />
        </mesh>
      </group>
      
      {/* 비행 궤적 효과 - 청록색으로 변경 */}
      <mesh position={[0, 0, -0.5]}>
        <sphereGeometry args={[0.1, 8, 8]} />
        <meshBasicMaterial 
          color={emissiveColor} 
          transparent 
          opacity={0.3}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}


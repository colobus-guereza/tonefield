'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Float, Sparkles } from '@react-three/drei';
import * as THREE from 'three';

interface SpaceshipProps {
  position?: [number, number, number];
  rotation?: [number, number, number]; // 회전 prop 추가
  velocity?: number; // 속도 prop 추가
}

export default function Spaceship({ position = [0, 2, 0], rotation, velocity = 0 }: SpaceshipProps) {
  const shipRef = useRef<THREE.Group>(null);
  const shieldRef = useRef<THREE.Mesh>(null);
  const shieldInnerRef = useRef<THREE.Mesh>(null);

  // 속도에 따른 불꽃 효과 강도 계산 (0~1 범위로 정규화)
  // 속도가 0.15 (최대 속도)일 때 최대 강도
  const MAX_SPEED = 0.15;
  const flameIntensity = Math.min(velocity / MAX_SPEED, 1);

  // 방어막 펄스 애니메이션
  useFrame((state) => {
    if (shieldRef.current && shieldInnerRef.current) {
      const time = state.clock.elapsedTime;
      // 부드러운 펄스 효과 (0.8 ~ 1.0 사이)
      const pulse = 0.9 + Math.sin(time * 2) * 0.1;
      shieldRef.current.scale.setScalar(pulse);
      shieldInnerRef.current.scale.setScalar(pulse * 0.95);

      // 투명도 펄스
      const opacity = 0.15 + Math.sin(time * 3) * 0.05;
      if (shieldRef.current.material instanceof THREE.Material) {
        (shieldRef.current.material as THREE.MeshBasicMaterial).opacity = opacity;
      }
      if (shieldInnerRef.current.material instanceof THREE.Material) {
        (shieldInnerRef.current.material as THREE.MeshBasicMaterial).opacity = opacity * 0.6;
      }
    }
  });

  return (
    // Float: 둥둥 떠다니는 무중력 효과 자동 적용 (착륙 모드: floatingRange를 작게)
    // rotation이 제공되면 Float 효과 비활성화 (플레이어 제어 모드)
    <Float
      speed={rotation ? 0 : 2}
      rotationIntensity={rotation ? 0 : 0.2}
      floatIntensity={rotation ? 0 : 0.1}
      floatingRange={[0, 0.1]}
    >
      <group ref={shipRef} position={position} rotation={rotation} scale={0.03}>
        {/* 전체 모델을 180도 회전하여 -Z 방향이 앞이 되도록 수정 */}
        <group rotation={[0, Math.PI, 0]}>

          {/* === 1. 메인 본체 (각진 GT-R 스타일) === */}
          <group rotation={[0, 0, 0]}>
            {/* 상단 본체 (흰색) - 날렵한 각진 형태 */}
            <mesh position={[0, 0.15, 0]}>
              <boxGeometry args={[1.2, 0.3, 2.5]} />
              <meshStandardMaterial
                color="#ffffff"
                metalness={0.8}
                roughness={0.2}
              />
            </mesh>

            {/* 하단 본체 (짙은 회색) */}
            <mesh position={[0, -0.1, 0]}>
              <boxGeometry args={[1.2, 0.2, 2.5]} />
              <meshStandardMaterial
                color="#2a2a2a"
                metalness={0.7}
                roughness={0.3}
              />
            </mesh>

            {/* 전면 그릴 (삼각형 모양) */}
            <mesh position={[0, 0.1, 1.3]} rotation={[0, 0, 0]}>
              <coneGeometry args={[0.4, 0.3, 3]} />
              <meshStandardMaterial
                color="#1a1a1a"
                metalness={0.5}
                roughness={0.4}
              />
            </mesh>

            {/* 전면 주황색 방향 지시등 (왼쪽) */}
            <mesh position={[-0.55, 0.1, 1.2]}>
              <boxGeometry args={[0.15, 0.05, 0.2]} />
              <meshStandardMaterial
                color="#ff8800"
                emissive="#ff6600"
                emissiveIntensity={0.8}
              />
            </mesh>

            {/* 전면 주황색 방향 지시등 (오른쪽) */}
            <mesh position={[0.55, 0.1, 1.2]}>
              <boxGeometry args={[0.15, 0.05, 0.2]} />
              <meshStandardMaterial
                color="#ff8800"
                emissive="#ff6600"
                emissiveIntensity={0.8}
              />
            </mesh>

            {/* 후면 빨간색 후미등 (왼쪽) */}
            <mesh position={[-0.4, 0.05, -1.25]}>
              <boxGeometry args={[0.2, 0.1, 0.15]} />
              <meshStandardMaterial
                color="#ff0000"
                emissive="#cc0000"
                emissiveIntensity={0.6 + flameIntensity * 0.4}
              />
            </mesh>

            {/* 후면 빨간색 후미등 (오른쪽) */}
            <mesh position={[0.4, 0.05, -1.25]}>
              <boxGeometry args={[0.2, 0.1, 0.15]} />
              <meshStandardMaterial
                color="#ff0000"
                emissive="#cc0000"
                emissiveIntensity={0.6 + flameIntensity * 0.4}
              />
            </mesh>
          </group>

          {/* === 2. 측면 창문 (어두운 틴팅) === */}
          <mesh position={[0, 0.2, 0.2]}>
            <boxGeometry args={[0.8, 0.15, 1.2]} />
            <meshStandardMaterial
              color="#000000"
              transparent
              opacity={0.3}
              metalness={0.9}
              roughness={0.1}
            />
          </mesh>

          {/* 측면 창문 내부 청록색 좌석 (희미하게) */}
          <mesh position={[0, 0.15, 0.2]}>
            <boxGeometry args={[0.6, 0.1, 1.0]} />
            <meshStandardMaterial
              color="#00ffff"
              emissive="#00aaaa"
              emissiveIntensity={0.2}
              transparent
              opacity={0.4}
            />
          </mesh>

          {/* === 3. 측면 스트라이프 (검은색) === */}
          <mesh position={[0.6, 0.1, 0]}>
            <boxGeometry args={[0.02, 0.4, 2.2]} />
            <meshStandardMaterial color="#000000" />
          </mesh>
          <mesh position={[-0.6, 0.1, 0]}>
            <boxGeometry args={[0.02, 0.4, 2.2]} />
            <meshStandardMaterial color="#000000" />
          </mesh>

          {/* === 4. 지붕 안테나 === */}
          <mesh position={[0, 0.35, -0.5]}>
            <cylinderGeometry args={[0.01, 0.01, 0.15, 8]} />
            <meshStandardMaterial color="#333" />
          </mesh>

          {/* === 5. 방어막 효과 (우주선을 감싸는 형태) === */}
          {/* 외부 방어막 (타원체 형태로 우주선을 감쌈) */}
          <mesh ref={shieldRef} position={[0, 0.1, 0]}>
            <sphereGeometry args={[2.34, 32, 32]} />
            <meshBasicMaterial
              color="#0066ff"
              transparent
              opacity={0.15}
              side={THREE.BackSide}
              blending={THREE.AdditiveBlending}
              wireframe={false}
            />
          </mesh>

          {/* 내부 방어막 (더 작고 밝음) */}
          <mesh ref={shieldInnerRef} position={[0, 0.1, 0]}>
            <sphereGeometry args={[2.21, 32, 32]} />
            <meshBasicMaterial
              color="#00aaff"
              transparent
              opacity={0.1}
              side={THREE.BackSide}
              blending={THREE.AdditiveBlending}
              wireframe={false}
            />
          </mesh>

          {/* 방어막 에너지 입자 효과 (우주선 주변) */}
          <Sparkles
            count={40}
            scale={[3.25, 3.25, 3.25]}
            size={2}
            speed={0.2}
            opacity={0.5}
            color="#0066ff"
            position={[0, 0.1, 0]}
          />

          {/* 후면 불꽃 효과 - 왼쪽 엔진 */}
          {flameIntensity > 0.01 && (
            <group position={[-0.4, 0.05, -1.25]}>
              {/* 불꽃 입자 효과 */}
              <Sparkles
                count={Math.floor(10 + flameIntensity * 30)}
                scale={[0.3, 0.8 * flameIntensity, 0.3]}
                size={2 + flameIntensity * 4}
                speed={0.5 + flameIntensity * 1.5}
                opacity={0.6 * flameIntensity}
                color="#ff4400"
              />
              {/* 불꽃 빛 효과 (원뿔 모양) */}
              <mesh position={[0, 0, -0.2 * flameIntensity]} rotation={[0, 0, 0]}>
                <coneGeometry args={[0.15, 0.4 * flameIntensity, 8]} />
                <meshBasicMaterial
                  color="#ff6600"
                  transparent
                  opacity={0.5 * flameIntensity}
                  side={THREE.DoubleSide}
                  blending={THREE.AdditiveBlending}
                />
              </mesh>
              {/* 내부 핵심 불꽃 (더 밝고 작음) */}
              <mesh position={[0, 0, -0.1 * flameIntensity]} rotation={[0, 0, 0]}>
                <coneGeometry args={[0.08, 0.2 * flameIntensity, 8]} />
                <meshBasicMaterial
                  color="#ffff00"
                  transparent
                  opacity={0.8 * flameIntensity}
                  side={THREE.DoubleSide}
                  blending={THREE.AdditiveBlending}
                />
              </mesh>
            </group>
          )}

          {/* 후면 불꽃 효과 - 오른쪽 엔진 */}
          {flameIntensity > 0.01 && (
            <group position={[0.4, 0.05, -1.25]}>
              {/* 불꽃 입자 효과 */}
              <Sparkles
                count={Math.floor(10 + flameIntensity * 30)}
                scale={[0.3, 0.8 * flameIntensity, 0.3]}
                size={2 + flameIntensity * 4}
                speed={0.5 + flameIntensity * 1.5}
                opacity={0.6 * flameIntensity}
                color="#ff4400"
              />
              {/* 불꽃 빛 효과 (원뿔 모양) */}
              <mesh position={[0, 0, -0.2 * flameIntensity]} rotation={[0, 0, 0]}>
                <coneGeometry args={[0.15, 0.4 * flameIntensity, 8]} />
                <meshBasicMaterial
                  color="#ff6600"
                  transparent
                  opacity={0.5 * flameIntensity}
                  side={THREE.DoubleSide}
                  blending={THREE.AdditiveBlending}
                />
              </mesh>
              {/* 내부 핵심 불꽃 (더 밝고 작음) */}
              <mesh position={[0, 0, -0.1 * flameIntensity]} rotation={[0, 0, 0]}>
                <coneGeometry args={[0.08, 0.2 * flameIntensity, 8]} />
                <meshBasicMaterial
                  color="#ffff00"
                  transparent
                  opacity={0.8 * flameIntensity}
                  side={THREE.DoubleSide}
                  blending={THREE.AdditiveBlending}
                />
              </mesh>
            </group>
          )}
        </group>
      </group>
    </Float>
  );
}

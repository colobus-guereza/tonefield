"use client";

import * as THREE from "three";
import { RoundedBox } from "@react-three/drei";

// 디테일이 살아있는 가죽 소파 컴포넌트
export function UniverseSofa() {
    const leatherMaterial = new THREE.MeshStandardMaterial({
        color: "#3e2723", // 진한 초콜릿색
        roughness: 0.4,   // 가죽의 광택
        metalness: 0.1,
    });

    const legMaterial = new THREE.MeshStandardMaterial({ color: "#1a1a1a" });

    return (
        <group position={[0, 0, 0]}>
            {/* 1. 좌석 쿠션 (두툼하고 둥글게) */}
            <RoundedBox args={[0.9, 0.25, 0.8]} radius={0.05} smoothness={4} position={[0, 0.4, 0]}>
                <primitive object={leatherMaterial} />
            </RoundedBox>

            {/* 2. 등받이 (약간 뒤로 기울여서 편안해 보이게) */}
            <group position={[0, 0.7, -0.35]} rotation={[-0.1, 0, 0]}>
                <RoundedBox args={[0.9, 0.6, 0.2]} radius={0.05} smoothness={4}>
                    <primitive object={leatherMaterial} />
                </RoundedBox>
            </group>

            {/* 3. 팔걸이 (좌/우) */}
            <RoundedBox args={[0.15, 0.45, 0.8]} radius={0.03} smoothness={4} position={[-0.52, 0.5, 0]}>
                <primitive object={leatherMaterial} />
            </RoundedBox>
            <RoundedBox args={[0.15, 0.45, 0.8]} radius={0.03} smoothness={4} position={[0.52, 0.5, 0]}>
                <primitive object={leatherMaterial} />
            </RoundedBox>

            {/* 4. 소파 다리 (4개) */}
            <mesh position={[-0.4, 0.1, 0.35]}>
                <cylinderGeometry args={[0.04, 0.03, 0.2]} />
                <primitive object={legMaterial} />
            </mesh>
            <mesh position={[0.4, 0.1, 0.35]}>
                <cylinderGeometry args={[0.04, 0.03, 0.2]} />
                <primitive object={legMaterial} />
            </mesh>
            <mesh position={[-0.4, 0.1, -0.35]}>
                <cylinderGeometry args={[0.04, 0.03, 0.2]} />
                <primitive object={legMaterial} />
            </mesh>
            <mesh position={[0.4, 0.1, -0.35]}>
                <cylinderGeometry args={[0.04, 0.03, 0.2]} />
                <primitive object={legMaterial} />
            </mesh>
        </group>
    );
}

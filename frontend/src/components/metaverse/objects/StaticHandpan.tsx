"use client";

import { useMemo } from "react";
import * as THREE from "three";

// Reusing the geometry logic from ToneField.tsx for consistency
function createHandpanGeometry(width: number, height: number, radialSegments: number, ringSegments: number) {
    const geometry = new THREE.BufferGeometry();
    const vertices = [];
    const indices = [];
    const colors = [];
    const uvs = [];

    for (let i = 0; i <= ringSegments; i++) {
        const r = i / ringSegments;
        for (let j = 0; j <= radialSegments; j++) {
            const theta = (j / radialSegments) * Math.PI * 2;

            const x = r * Math.cos(theta) * (width / 2);
            const y = r * Math.sin(theta) * (height / 2);

            // Profile logic (same as ToneField)
            const dimpleRadius = 0.35;
            const dimpleHeight = 0.04;
            const transitionWidth = 0.05;
            let z = 0;

            if (r < dimpleRadius - transitionWidth) {
                const r_norm = r / (dimpleRadius - transitionWidth);
                z = dimpleHeight * (1 - r_norm * r_norm);
            } else if (r < dimpleRadius + transitionWidth) {
                const t = (r - (dimpleRadius - transitionWidth)) / (2 * transitionWidth);
                const r_norm = (dimpleRadius - transitionWidth) / (dimpleRadius - transitionWidth);
                const domeHeight = dimpleHeight * (1 - r_norm * r_norm);
                z = domeHeight * (1 - t) * Math.cos(t * Math.PI / 2);
            } else {
                z = 0;
            }

            vertices.push(x, y, z);
            uvs.push(0.5 + 0.5 * r * Math.cos(theta), 0.5 + 0.5 * r * Math.sin(theta));
            colors.push(1, 1, 1);
        }
    }

    for (let i = 0; i < ringSegments; i++) {
        for (let j = 0; j < radialSegments; j++) {
            const a = i * (radialSegments + 1) + j;
            const b = (i + 1) * (radialSegments + 1) + j;
            const c = (i + 1) * (radialSegments + 1) + (j + 1);
            const d = i * (radialSegments + 1) + (j + 1);
            indices.push(a, b, d);
            indices.push(b, c, d);
        }
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    return geometry;
}

interface StaticHandpanProps {
    position?: [number, number, number];
    rotation?: [number, number, number];
    scale?: number;
    color?: string;
}

export function StaticHandpan({ position = [0, 0, 0], rotation = [0, 0, 0], scale = 1, color = "#4a5568" }: StaticHandpanProps) {
    const geometry = useMemo(() => {
        // Using the same dimensions as the main ToneField (0.6 x 0.85)
        return createHandpanGeometry(0.6, 0.85, 64, 32);
    }, []);

    return (
        <group position={position} rotation={rotation} scale={[scale, scale, scale]}>
            {/* Top Shell */}
            <mesh geometry={geometry} castShadow receiveShadow>
                <meshStandardMaterial
                    color={color}
                    metalness={0.9}
                    roughness={0.2}
                    envMapIntensity={1.5}
                />
            </mesh>

            {/* Bottom Shell (Simple scaled sphere for now, or inverted top) */}
            <mesh position={[0, 0, -0.15]} scale={[1, 1, 0.4]} rotation={[Math.PI, 0, 0]} castShadow>
                <sphereGeometry args={[0.35, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
                <meshStandardMaterial
                    color={color}
                    metalness={0.9}
                    roughness={0.2}
                    side={THREE.DoubleSide}
                />
            </mesh>

            {/* Rim/Ring (Rubber protection) */}
            <mesh rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[0.32, 0.01, 16, 64]} />
                <meshStandardMaterial color="#1a202c" roughness={0.8} />
            </mesh>
        </group>
    );
}

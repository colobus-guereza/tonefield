"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { useMemo, useRef, useEffect } from "react";
import * as THREE from "three";

interface TensionSceneProps {
    tonicError: number;
    octaveError: number;
    fifthError: number;
}

function TensionField({ tonicError, octaveError, fifthError }: TensionSceneProps) {
    const meshRef = useRef<THREE.Mesh>(null);

    // Helper to convert error (-50 to 50) to tension factor (0 to 1)
    // 0 error -> 1 tension (tight)
    // 50 error -> 0 tension (loose)
    const errorToTensionFactor = (error: number) => {
        const absErr = Math.abs(error);
        const maxErr = 50;
        return Math.max(0, 1 - absErr / maxErr);
    };

    const tonicT = errorToTensionFactor(tonicError);
    const octaveT = errorToTensionFactor(octaveError);
    const fifthT = errorToTensionFactor(fifthError);

    const { geometry, colors } = useMemo(() => {
        // Create a high-resolution sphere
        const geo = new THREE.SphereGeometry(1, 128, 128);
        const posAttr = geo.attributes.position as THREE.BufferAttribute;
        const count = posAttr.count;
        const colorArray = new Float32Array(count * 3);
        const color = new THREE.Color();

        // Store original positions to reset before applying new displacement
        // However, since we recreate geometry on prop change here (useMemo dependency),
        // we can just calculate directly.
        // Optimization: If performance is bad, we should use a ref for original positions
        // and update in useFrame or useEffect without recreating geometry.
        // For now, recreating on slider change is acceptable for a prototype.

        for (let i = 0; i < count; i++) {
            const x = posAttr.getX(i);
            const y = posAttr.getY(i);
            const z = posAttr.getZ(i);

            // Convert to spherical-like coordinates for mapping
            // We assume the dome is roughly the top hemisphere, but SphereGeometry is full.
            // Let's treat it as a full sphere for now, or just map based on direction.
            const r = Math.sqrt(x * x + y * y + z * z);
            const nx = x / r;
            const ny = y / r;
            const nz = z / r;

            // Simple mapping logic:
            // Top (ny > 0.5) -> Octave
            // Sides (abs(nx) > 0.5) -> Fifth
            // Center/Rest -> Tonic (Base tension)

            // Let's make a smooth blend
            // Weight for Octave: increases as we go up (y)
            const wOctave = Math.max(0, ny);
            // Weight for Fifth: increases as we go sideways (x)
            const wFifth = Math.abs(nx);
            // Weight for Tonic: remainder
            // This is a very rough approximation

            // Better approach for "Tonefield":
            // Center = Tonic
            // Top (North) = Octave
            // Sides (East/West) = Fifth

            // Let's use distance on surface from "center" (0, 1, 0) for Octave? 
            // Or just simple directional blending.

            // Let's try:
            // Base tension = Tonic
            // If near top pole (0, 1, 0), blend towards Octave
            // If near side poles (1, 0, 0) or (-1, 0, 0), blend towards Fifth

            let t = tonicT; // Start with tonic

            // Simple hard/soft regions
            if (ny > 0.6) {
                // Top cap
                t = (t + octaveT) / 2;
            } else if (Math.abs(nx) > 0.6) {
                // Side lobes
                t = (t + fifthT) / 2;
            }

            // Smooth interpolation could be better but this is a start.

            // Color mapping:
            // High tension (1.0) -> Warm/Bright (Red/Orange)
            // Low tension (0.0) -> Cool/Dark (Blue/Purple)
            // HSL: Blue is ~0.66, Red is ~0.0
            // Let's go from Blue (0.6) to Red (0.0)
            const hue = 0.6 * (1 - t);
            const lightness = 0.3 + 0.4 * t; // Brighter when tight
            color.setHSL(hue, 1.0, lightness);

            colorArray[i * 3 + 0] = color.r;
            colorArray[i * 3 + 1] = color.g;
            colorArray[i * 3 + 2] = color.b;

            // Displacement
            // Tight -> Bulge out slightly (or stay neutral)
            // Loose -> Sag in? Or just less bulge?
            // Let's say default radius is 1.
            // High tension -> 1.05
            // Low tension -> 0.95
            const displacement = 0.05 * (t - 0.5);
            // or just 0 to 0.1
            // const displacement = 0.1 * t;

            const scale = 1 + displacement;
            posAttr.setXYZ(i, x * scale, y * scale, z * scale);
        }

        geo.setAttribute("color", new THREE.BufferAttribute(colorArray, 3));
        geo.computeVertexNormals(); // Recompute normals after displacement

        return { geometry: geo, colors: colorArray };
    }, [tonicT, octaveT, fifthT]);

    return (
        <mesh ref={meshRef} geometry={geometry}>
            <meshStandardMaterial
                vertexColors
                metalness={0.6}
                roughness={0.2}
            />
        </mesh>
    );
}

export function TensionScene(props: TensionSceneProps) {
    return (
        <div className="w-full h-full bg-slate-900">
            <Canvas>
                <PerspectiveCamera makeDefault position={[0, 2, 4]} />
                <OrbitControls enablePan={false} minDistance={2} maxDistance={10} />

                <ambientLight intensity={0.5} />
                <pointLight position={[10, 10, 10]} intensity={1} />
                <pointLight position={[-10, -10, -5]} intensity={0.5} color="#4444ff" />

                <TensionField {...props} />

                <gridHelper args={[10, 10, 0x444444, 0x222222]} />
            </Canvas>
        </div>
    );
}

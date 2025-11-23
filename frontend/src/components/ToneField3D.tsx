"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, Text, Html } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

// Props 인터페이스 정의
export interface ToneField3DProps {
    // 기본 설정
    tension?: number;
    wireframe?: boolean;
    cameraView?: 'perspective' | 'top';

    // 타점 데이터
    hitPointLocation?: "internal" | "external" | null;
    hitPointCoordinate?: string;
    hitPointStrength?: string;
    hitPointCount?: string;
    hammeringType?: string;

    // 조율 오차 (장력 시각화)
    tuningErrors?: {
        tonic: number;    // Hz 오차
        octave: number;   // Hz 오차
        fifth: number;    // Hz 오차
    };

    // 콜백 함수
    onTensionChange?: (tension: number) => void;
    onCameraViewChange?: (view: 'perspective' | 'top') => void;

    // 스타일
    width?: string | number;
    height?: string | number;
    className?: string;

    // Supabase 설정 (선택적)
    supabaseUrl?: string;
    supabaseKey?: string;
}

// Custom Geometry Generator for Elliptical Tonefield
function createTonefieldGeometry(width: number, height: number, radialSegments: number, ringSegments: number) {
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
            const z = r * Math.sin(theta) * (height / 2);

            const dimpleRadius = 0.35;
            const dimpleHeight = 0.04;
            const transitionWidth = 0.05;

            let y = 0;

            if (r < dimpleRadius - transitionWidth) {
                const r_norm = r / (dimpleRadius - transitionWidth);
                y = dimpleHeight * (1 - r_norm * r_norm);
            } else if (r < dimpleRadius + transitionWidth) {
                const t = (r - (dimpleRadius - transitionWidth)) / (2 * transitionWidth);
                const r_norm = (dimpleRadius - transitionWidth) / (dimpleRadius - transitionWidth);
                const domeHeight = dimpleHeight * (1 - r_norm * r_norm);
                y = domeHeight * (1 - t) * Math.cos(t * Math.PI / 2);
            } else {
                y = 0;
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
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    return geometry;
}

/**
 * 오차값을 색상으로 변환하는 유틸리티 함수
 * @param errorValue - 조율 오차 (Hz 단위)
 * @returns THREE.Color 객체
 */
function getErrorColor(errorValue: number): THREE.Color {
    const color = new THREE.Color();
    const absError = Math.abs(errorValue);

    // 허용 오차 범위 설정 (0~30Hz 범위로 정규화)
    const maxError = 30.0;
    const normalizedError = Math.min(absError / maxError, 1.0);

    if (absError < 0.1) {
        // 오차가 거의 없음: 초록색 (안정)
        color.setRGB(0, 1, 0);
    } else if (errorValue > 0) {
        // 과장력 (Over-tension): Green → Yellow → Red
        if (normalizedError < 0.5) {
            // Green to Yellow
            const t = normalizedError * 2;
            color.setRGB(t, 1, 0);
        } else {
            // Yellow to Red
            const t = (normalizedError - 0.5) * 2;
            color.setRGB(1, 1 - t, 0);
        }
    } else {
        // 저장력 (Under-tension): Green → Cyan → Blue
        if (normalizedError < 0.5) {
            // Green to Cyan
            const t = normalizedError * 2;
            color.setRGB(0, 1, t);
        } else {
            // Cyan to Blue
            const t = (normalizedError - 0.5) * 2;
            color.setRGB(0, 1 - t, 1);
        }
    }

    return color;
}

function ToneFieldMesh({
    tension,
    wireframe,
    tuningErrors
}: {
    tension: number;
    wireframe: boolean;
    tuningErrors?: {
        tonic: number;   // Hz 오차
        octave: number;  // Hz 오차
        fifth: number;   // Hz 오차
    };
}) {
    const meshRef = useRef<THREE.Mesh>(null);

    const geometry = useMemo(() => {
        return createTonefieldGeometry(0.6, 0.85, 64, 32);
    }, []);

    useEffect(() => {
        if (!meshRef.current) return;
        const geo = meshRef.current.geometry;
        const posAttr = geo.attributes.position;
        const colorAttr = geo.attributes.color;
        const count = posAttr.count;
        const color = new THREE.Color();

        // 메쉬 크기 정보
        const width = 0.6;
        const height = 0.85;

        // 조율 오차가 있는 경우, 각 영역별 타겟 색상 미리 계산
        let colOctave: THREE.Color;
        let colTonic: THREE.Color;
        let colFifth: THREE.Color;

        if (tuningErrors) {
            colOctave = getErrorColor(tuningErrors.octave);
            colTonic = getErrorColor(tuningErrors.tonic);
            colFifth = getErrorColor(tuningErrors.fifth);
        } else {
            // 기본 색상 (모두 초록색)
            colOctave = new THREE.Color(0, 1, 0);
            colTonic = new THREE.Color(0, 1, 0);
            colFifth = new THREE.Color(0, 1, 0);
        }

        for (let i = 0; i < count; i++) {
            const x = posAttr.getX(i);
            const y = posAttr.getY(i); // 실제 높이값 (딤플)
            const z = posAttr.getZ(i); // 평면상 세로축 (Top/Bottom)

            // 정규화된 거리 계산 (딤플 영역 판별용)
            const r = Math.sqrt(Math.pow(x / (width / 2), 2) + Math.pow(z / (height / 2), 2));

            // A. 딤플 영역 (중심부): 기존 금속 재질 색상 유지
            if (r < 0.35) {
                // 딤플은 높이(y)에 따라 밝은 회색 계열
                const brightness = 0.4 + 0.3 * THREE.MathUtils.clamp(y * 10, 0, 1);
                color.setRGB(brightness, brightness, brightness);
                colorAttr.setXYZ(i, color.r, color.g, color.b);
                continue;
            }

            // B. 도넛 영역 (장력 시각화): 가중치 블렌딩
            // 좌표계: z > 0 = 위쪽 (Octave), z < 0 = 아래쪽 (Tonic), x = 좌우 (Fifth)

            // 가중치 계산 (부드러운 그라데이션을 위해 절대값 사용)
            const wOctave = Math.max(z, 0);           // 위쪽 (z > 0)
            const wTonic = Math.max(-z, 0);           // 아래쪽 (z < 0)
            const wFifth = Math.abs(x);               // 양 옆

            const totalW = wOctave + wTonic + wFifth;

            // 안전장치: 가중치 합이 0이면 기본 초록색
            if (totalW <= 0.001) {
                color.setRGB(0, 1, 0);
                colorAttr.setXYZ(i, color.r, color.g, color.b);
                continue;
            }

            // 색상 블렌딩 (RGB 채널별 가중 평균)
            const rVal = (colOctave.r * wOctave + colTonic.r * wTonic + colFifth.r * wFifth) / totalW;
            const gVal = (colOctave.g * wOctave + colTonic.g * wTonic + colFifth.g * wFifth) / totalW;
            const bVal = (colOctave.b * wOctave + colTonic.b * wTonic + colFifth.b * wFifth) / totalW;

            colorAttr.setXYZ(i, rVal, gVal, bVal);
        }

        colorAttr.needsUpdate = true;
    }, [tension, geometry, tuningErrors]);

    return (
        <mesh ref={meshRef} geometry={geometry}>
            <meshStandardMaterial
                vertexColors
                wireframe={wireframe}
                side={THREE.DoubleSide}
                metalness={0.5}
                roughness={0.2}
                color={wireframe ? "cyan" : "white"}
            />
        </mesh>
    );
}

function TonefieldBoundaries({ hitPointLocation }: { hitPointLocation: "internal" | "external" | null }) {
    let color: number;
    let opacity: number;

    if (hitPointLocation === "internal") {
        color = 0x3b82f6;
        opacity = 1.0;
    } else if (hitPointLocation === "external") {
        color = 0xdc2626;
        opacity = 1.0;
    } else {
        color = 0x808080;
        opacity = 0.8;
    }

    const outerLine = useMemo(() => {
        const curve = new THREE.EllipseCurve(0, 0, 0.3, 0.425, 0, 2 * Math.PI, false, 0);
        const points = curve.getPoints(64);
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({
            color: color,
            transparent: true,
            opacity: opacity,
            linewidth: 2
        });
        const line = new THREE.Line(geometry, material);
        line.rotation.x = -Math.PI / 2;
        return line;
    }, [color, opacity]);

    const innerLine = useMemo(() => {
        const curve = new THREE.EllipseCurve(0, 0, 0.3 * 0.35, 0.425 * 0.35, 0, 2 * Math.PI, false, 0);
        const points = curve.getPoints(64);
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({
            color: color,
            transparent: true,
            opacity: opacity,
            linewidth: 1.5
        });
        const line = new THREE.Line(geometry, material);
        line.rotation.x = -Math.PI / 2;
        return line;
    }, [color, opacity]);

    return (
        <group position={[0, 0.001, 0]}>
            <primitive object={outerLine} />
            <primitive object={innerLine} />
        </group>
    );
}

function AnimatedRing({ position }: { position: [number, number, number] }) {
    const ringRef = useRef<THREE.Mesh>(null);

    useFrame((state) => {
        if (!ringRef.current) return;
        const scale = 1 + 0.15 * Math.sin(state.clock.elapsedTime * 3);
        ringRef.current.scale.setScalar(scale);
        ringRef.current.rotation.z = state.clock.elapsedTime * 2;
        const material = ringRef.current.material as THREE.MeshBasicMaterial;
        material.opacity = 0.5 + 0.3 * Math.sin(state.clock.elapsedTime * 3);
    });

    return (
        <mesh ref={ringRef} position={position} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.015, 0.025, 32]} />
            <meshBasicMaterial color="#00ffff" transparent opacity={0.8} side={THREE.DoubleSide} />
        </mesh>
    );
}

function HitPointMarker({
    x,
    y,
    strength,
    count,
    hammeringType
}: {
    x: number;
    y: number;
    strength: string;
    count: string;
    hammeringType: string;
}) {
    const worldX = x;
    const worldZ = -y;
    const worldY = 0.002;

    return (
        <group>
            <mesh position={[worldX, worldY, worldZ]}>
                <sphereGeometry args={[0.01, 16, 16]} />
                <meshStandardMaterial color="#ff0066" emissive="#ff0066" emissiveIntensity={0.5} />
            </mesh>
            <AnimatedRing position={[worldX, worldY, worldZ]} />
            <Html
                position={[worldX, worldY, worldZ]}
                zIndexRange={[100, 0]}
                center
                style={{ pointerEvents: 'none' }}
            >
                <div className="transform -translate-y-12 min-w-[140px]">
                    <div className="bg-gray-900/95 backdrop-blur-sm border border-gray-700 rounded-lg shadow-xl px-3 py-2 flex flex-col items-center gap-0.5">
                        <div className="text-gray-100 font-bold text-sm whitespace-nowrap font-mono">
                            {strength} × {count}
                        </div>
                        <div className="text-gray-400 font-bold text-xs whitespace-nowrap">
                            ({hammeringType})
                        </div>
                        <div className="absolute -bottom-1.5 left-1/2 transform -translate-x-1/2 w-3 h-3 bg-gray-900 rotate-45 border-r border-b border-gray-700"></div>
                    </div>
                </div>
            </Html>
        </group>
    );
}

function CoordinateGrid() {
    return (
        <group>
            <gridHelper
                args={[2, 8, '#666666', '#333333']}
                position={[0, 0, 0]}
                rotation={[0, 0, 0]}
            />

            <group name="tuningBox">
                <lineSegments rotation={[-Math.PI / 2, 0, 0]}>
                    <edgesGeometry args={[new THREE.PlaneGeometry(1, 1)]} />
                    <lineBasicMaterial color="#808080" transparent opacity={0.3} linewidth={3} />
                </lineSegments>

                <Text position={[-0.5, 0.02, 0.6]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.04} color="#808080" anchorX="center" anchorY="middle">-1</Text>
                <Text position={[0, 0.02, 0.6]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.04} color="#808080" anchorX="center" anchorY="middle">0</Text>
                <Text position={[0.5, 0.02, 0.6]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.04} color="#808080" anchorX="center" anchorY="middle">1</Text>
                <Text position={[-0.6, 0.02, 0.5]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.04} color="#808080" anchorX="center" anchorY="middle">-1</Text>
                <Text position={[-0.6, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.04} color="#808080" anchorX="center" anchorY="middle">0</Text>
                <Text position={[-0.6, 0.02, -0.5]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.04} color="#808080" anchorX="center" anchorY="middle">1</Text>
            </group>

            <axesHelper args={[1.2]} />
        </group>
    );
}

function CameraController({ viewMode }: { viewMode: 'perspective' | 'top' }) {
    const { camera } = useThree();

    useEffect(() => {
        if (viewMode === 'top') {
            camera.position.set(0, 1.5, 0);
            camera.lookAt(0, 0, 0);
        } else {
            camera.position.set(0, 3, 3);
            camera.lookAt(0, 0, 0);
        }
        camera.updateProjectionMatrix();
    }, [viewMode, camera]);

    return null;
}

// 재사용 가능한 ToneField3D 컴포넌트
export function ToneField3D({
    tension = 0.5,
    wireframe = true,
    cameraView = 'top',
    hitPointLocation = null,
    hitPointCoordinate,
    hitPointStrength,
    hitPointCount,
    hammeringType,
    tuningErrors,
    onTensionChange,
    onCameraViewChange,
    width = '100%',
    height = '100%',
    className = '',
}: ToneField3DProps) {
    const [internalTension, setInternalTension] = useState(tension);
    const [internalCameraView, setInternalCameraView] = useState(cameraView);

    useEffect(() => {
        setInternalTension(tension);
    }, [tension]);

    useEffect(() => {
        setInternalCameraView(cameraView);
    }, [cameraView]);

    const handleTensionChange = (newTension: number) => {
        setInternalTension(newTension);
        onTensionChange?.(newTension);
    };

    const handleCameraViewChange = (newView: 'perspective' | 'top') => {
        setInternalCameraView(newView);
        onCameraViewChange?.(newView);
    };

    return (
        <div
            className={className}
            style={{
                width,
                height,
                backgroundColor: '#000000',
                position: 'relative'
            }}
        >
            <Canvas
                gl={{ alpha: false }}
                onCreated={({ gl }) => {
                    gl.setClearColor('#000000', 1);
                }}
            >
                <PerspectiveCamera makeDefault position={[0, 3, 3]} fov={50} />
                <OrbitControls target={[0, 0, 0]} />
                <CameraController viewMode={internalCameraView} />

                <ambientLight intensity={0.4} />
                <pointLight position={[10, 10, 10]} intensity={1} />
                <pointLight position={[-10, 5, -10]} intensity={0.5} color="#ff00ff" />

                <CoordinateGrid />
                <TonefieldBoundaries hitPointLocation={hitPointLocation} />
                <ToneFieldMesh
                    tension={internalTension}
                    wireframe={wireframe}
                    tuningErrors={tuningErrors}
                />

                {hitPointCoordinate && hitPointStrength && hitPointCount && hammeringType && (() => {
                    const match = hitPointCoordinate.match(/\(([^,]+),\s*([^)]+)\)/);
                    if (match) {
                        const x = parseFloat(match[1]);
                        const y = parseFloat(match[2]);
                        return (
                            <HitPointMarker
                                x={x}
                                y={y}
                                strength={hitPointStrength}
                                count={hitPointCount}
                                hammeringType={hammeringType}
                            />
                        );
                    }
                    return null;
                })()}
            </Canvas>
        </div>
    );
}


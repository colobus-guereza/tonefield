"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, Text, Html, Stars } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import SpacePterosaur from "./metaverse/objects/SpacePterosaur";

// 카메라 프리셋 타입 정의
export type CameraPreset = 'top' | 'perspective' | 'front' | 'side' | 'isometric' | 'close';

// Props 인터페이스 정의
export interface ToneField3DProps {
    // 기본 설정
    tension?: number;
    wireframe?: boolean;
    cameraView?: CameraPreset;

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
    onCameraViewChange?: (view: CameraPreset) => void;

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

/**
 * 각도 기반 가중치 계산 (원형 연속성 고려)
 * @param currentAngle - 현재 버텍스의 각도 (라디안)
 * @param targetAngle - 타겟 영역의 중심 각도 (라디안)
 * @param transitionRange - 전환 구간 범위 (라디안)
 * @returns 0~1 범위의 가중치 (1 = 타겟 중심, 0 = 멀리)
 */
function angularWeight(currentAngle: number, targetAngle: number, transitionRange: number): number {
    // 각도 차이 계산 (원형 연속성 고려: 0° = 360°)
    let diff = Math.abs(currentAngle - targetAngle);
    if (diff > Math.PI) {
        diff = 2 * Math.PI - diff;
    }

    // 정규화 (0 = 타겟 중심, 1 = 전환 범위 끝)
    const normalized = Math.min(diff / transitionRange, 1);

    // 반전 후 smootherstep 적용 (5차 함수로 더욱 부드러운 전환)
    const t = 1 - normalized;
    return t * t * t * (t * (t * 6 - 15) + 10);
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
        return createTonefieldGeometry(0.6, 0.85, 256, 32);  // 128 → 256 for smoother edges
    }, []);

    // Custom Shader Material for pixel-perfect color blending
    const shaderMaterial = useMemo(() => {
        const colOctave = tuningErrors ? getErrorColor(tuningErrors.octave) : new THREE.Color(0, 1, 0);
        const colTonic = tuningErrors ? getErrorColor(tuningErrors.tonic) : new THREE.Color(0, 1, 0);
        const colFifth = tuningErrors ? getErrorColor(tuningErrors.fifth) : new THREE.Color(0, 1, 0);

        return new THREE.ShaderMaterial({
            uniforms: {
                colOctave: { value: colOctave },
                colTonic: { value: colTonic },
                colFifth: { value: colFifth },
                width: { value: 0.6 },
                height: { value: 0.85 },
                dimpleRadius: { value: 0.35 },
                debugMode: { value: 0.0 }  // 0=normal, 1=show weights
            },
            vertexShader: `
                varying vec3 vPosition;
                varying float vHeight;

                void main() {
                    vPosition = position;
                    vHeight = position.y;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 colOctave;
                uniform vec3 colTonic;
                uniform vec3 colFifth;
                uniform float width;
                uniform float height;
                uniform float dimpleRadius;
                uniform float debugMode;

                varying vec3 vPosition;
                varying float vHeight;

                // Smootherstep (5차 함수)
                float smootherstep(float t) {
                    t = clamp(t, 0.0, 1.0);
                    return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
                }

                // 각도 기반 가중치 (개선된 버전)
                float angularWeight(float currentAngle, float targetAngle, float transitionRange) {
                    float diff = abs(currentAngle - targetAngle);
                    if (diff > 3.14159265) {
                        diff = 6.28318531 - diff;
                    }
                    float normalized = min(diff / transitionRange, 1.0);
                    // 더 부드러운 전환을 위해 smootherstep 두 번 적용
                    float t = 1.0 - normalized;
                    return smootherstep(smootherstep(t));
                }

                void main() {
                    // 타원 정규화
                    float nx = vPosition.x / (width / 2.0);
                    float nz = vPosition.z / (height / 2.0);
                    float r = sqrt(nx * nx + nz * nz);

                    // 딤플 영역: 금속 재질
                    if (r < dimpleRadius) {
                        float brightness = 0.4 + 0.3 * clamp(vHeight * 10.0, 0.0, 1.0);
                        gl_FragColor = vec4(vec3(brightness), 1.0);
                        return;
                    }

                    // 각도 계산
                    float theta = atan(nz, nx);
                    float transitionRange = 3.14159265;  // 180도

                    // 가중치 계산
                    float wOctave = angularWeight(theta, 1.5707963, transitionRange);  // 90도
                    float wTonic = angularWeight(theta, -1.5707963, transitionRange);  // 270도
                    // Fifth: 합산 방식으로 부드러운 전환
                    float wFifthRight = angularWeight(theta, 0.0, transitionRange);
                    float wFifthLeft = angularWeight(theta, 3.14159265, transitionRange);
                    float wFifth = wFifthRight + wFifthLeft;

                    float totalW = wOctave + wTonic + wFifth;

                    if (totalW <= 0.001) {
                        gl_FragColor = vec4(0.0, 1.0, 0.0, 1.0);
                        return;
                    }

                    // DEBUG MODE: 가중치 시각화
                    if (debugMode > 0.5) {
                        // Octave=Red, Tonic=Green, Fifth=Blue
                        vec3 debugColor = vec3(
                            wOctave / totalW,
                            wTonic / totalW,
                            wFifth / totalW
                        );
                        gl_FragColor = vec4(debugColor, 1.0);
                        return;
                    }

                    // 색상 블렌딩
                    vec3 finalColor = (colOctave * wOctave + colTonic * wTonic + colFifth * wFifth) / totalW;
                    gl_FragColor = vec4(finalColor, 1.0);
                }
            `,
            side: THREE.DoubleSide,
            wireframe: wireframe
        });
    }, [tuningErrors, wireframe]);

    return (
        <mesh ref={meshRef} geometry={geometry} material={shaderMaterial} />
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
            <ringGeometry args={[0.03, 0.045, 32]} />
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
            {/* Hit point marker - 30파이 쇠망치 크기 (타원형) */}
            <mesh position={[worldX, worldY, worldZ]} scale={[1.0, 1.0, 0.3]}>
                <sphereGeometry args={[0.025, 16, 16]} />
                <meshStandardMaterial color="#FF0066" emissive="#FF0066" emissiveIntensity={1.0} />
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

// 카메라 프리셋 위치 정의
const CAMERA_PRESETS: Record<CameraPreset, { position: [number, number, number], lookAt?: [number, number, number] }> = {
    top: {
        position: [0, 1.5, 0],
        lookAt: [0, 0, 0]
    },
    perspective: {
        position: [0, 3, 3],
        lookAt: [0, 0, 0]
    },
    front: {
        position: [0, 0.5, 2],
        lookAt: [0, 0, 0]
    },
    side: {
        position: [2, 0.5, 0],
        lookAt: [0, 0, 0]
    },
    isometric: {
        position: [1.5, 1.5, 1.5],
        lookAt: [0, 0, 0]
    },
    close: {
        position: [0, 0.8, 1.2],
        lookAt: [0, 0, 0]
    }
};

function CameraController({ viewMode }: { viewMode: CameraPreset }) {
    const { camera } = useThree();

    useEffect(() => {
        const preset = CAMERA_PRESETS[viewMode];
        if (preset) {
            camera.position.set(...preset.position);
            if (preset.lookAt) {
                camera.lookAt(...preset.lookAt);
            } else {
                camera.lookAt(0, 0, 0);
            }
        }
        camera.updateProjectionMatrix();
    }, [viewMode, camera]);

    return null;
}

// 재사용 가능한 ToneField3D 컴포넌트
export function ToneField3D({
    tension = 0.5,
    wireframe = false,
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

    const handleCameraViewChange = (newView: CameraPreset) => {
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
                    gl.setClearColor('#000011', 1);
                }}
            >
                <PerspectiveCamera makeDefault position={[0, 3, 3]} fov={50} />
                <OrbitControls target={[0, 0, 0]} />
                <CameraController viewMode={internalCameraView} />

                {/* 우주 별들 */}
                <Stars 
                    radius={100} 
                    depth={50} 
                    count={3000} 
                    factor={4} 
                    saturation={0.5} 
                    fade 
                    speed={0.5}
                />

                <ambientLight intensity={0.5} />
                <pointLight position={[10, 10, 10]} intensity={1} />
                <pointLight position={[-10, 5, -10]} intensity={0.5} color="#ff00ff" />
                <pointLight position={[0, 15, 0]} intensity={0.3} color="#00aaff" />

                {/* 우주 익룡 - 우주선 옆에 고정 배치 (우주선 위치: [0, 2, 0], 스케일: 0.03) */}
                <SpacePterosaur position={[0.15, 2, 0]} scale={2.0} speed={0.7} />

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


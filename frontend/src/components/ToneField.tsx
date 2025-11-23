"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, Text, Html } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { supabase } from "@/lib/supabase";

// Custom Geometry Generator for Elliptical Tonefield
function createTonefieldGeometry(width: number, height: number, radialSegments: number, ringSegments: number) {
    const geometry = new THREE.BufferGeometry();
    const vertices = [];
    const indices = [];
    const colors = [];
    const uvs = [];

    // Generate vertices
    // Polar coordinates: r from 0 to 1, theta from 0 to 2*PI
    for (let i = 0; i <= ringSegments; i++) {
        const r = i / ringSegments; // 0 to 1

        for (let j = 0; j <= radialSegments; j++) {
            const theta = (j / radialSegments) * Math.PI * 2;

            // Elliptical conversion - XY plane
            // x = r * cos(theta) * width/2
            // y = r * sin(theta) * height/2 (Now using Y for the 2D plane)

            const x = r * Math.cos(theta) * (width / 2);
            const y = r * Math.sin(theta) * (height / 2);

            // Base Shape Profile (Z-axis for height)
            // 1. Main Dome: convex shape
            // 2. Inner Dimple: central elliptical dome

            // Tonefield profile with smooth dome and clear boundaries
            // Dimple area has a gentle dome, outer area is flat
            // Smooth transition at boundary to avoid sharp edges

            const dimpleRadius = 0.35; // Inner dimple boundary
            const dimpleHeight = 0.04; // Very subtle dome height
            const transitionWidth = 0.05; // Smooth transition zone width

            let z = 0; // Height in Z-axis

            if (r < dimpleRadius - transitionWidth) {
                // Inside dimple core: smooth dome using cosine curve
                const r_norm = r / (dimpleRadius - transitionWidth);
                z = dimpleHeight * (1 - r_norm * r_norm); // Parabolic dome
            } else if (r < dimpleRadius + transitionWidth) {
                // Transition zone: smooth blend to flat
                const t = (r - (dimpleRadius - transitionWidth)) / (2 * transitionWidth);
                const r_norm = (dimpleRadius - transitionWidth) / (dimpleRadius - transitionWidth);
                const domeHeight = dimpleHeight * (1 - r_norm * r_norm);
                // Smooth interpolation using cosine
                z = domeHeight * (1 - t) * Math.cos(t * Math.PI / 2);
            } else {
                // Outside dimple: completely flat
                z = 0;
            }

            vertices.push(x, y, z);

            // UVs
            uvs.push(0.5 + 0.5 * r * Math.cos(theta), 0.5 + 0.5 * r * Math.sin(theta));

            // Placeholder colors (white)
            colors.push(1, 1, 1);
        }
    }

    // Generate indices
    for (let i = 0; i < ringSegments; i++) {
        for (let j = 0; j < radialSegments; j++) {
            const a = i * (radialSegments + 1) + j;
            const b = (i + 1) * (radialSegments + 1) + j;
            const c = (i + 1) * (radialSegments + 1) + (j + 1);
            const d = i * (radialSegments + 1) + (j + 1);

            // Two triangles per quad
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

function ToneFieldMesh({ tension, wireframe }: { tension: number, wireframe: boolean }) {
    const meshRef = useRef<THREE.Mesh>(null);

    // Parameters for the ellipse
    const width = 10; // Major axis
    const height = 14; // Minor axis (rotated 90 deg? Image shows vertical ellipse)
    // Actually image shows vertical ellipse. Let's say Width < Height.

    const geometry = useMemo(() => {
        // Create ellipse with 0.6 (X-axis) x 0.85 (Z-axis) dimensions
        // This creates the tonefield with the longer axis along Z
        return createTonefieldGeometry(0.6, 0.85, 64, 32);
    }, []);

    useEffect(() => {
        if (!meshRef.current) return;
        const geo = meshRef.current.geometry;
        const posAttr = geo.attributes.position;
        const colorAttr = geo.attributes.color;
        const count = posAttr.count;
        const color = new THREE.Color();

        for (let i = 0; i < count; i++) {
            const z = posAttr.getZ(i); // Height is now in Z-axis

            // Visualization Logic:
            // We want to visualize "Tension".
            // Let's assume the "Dimple" (center) has the most tension variation.
            // z ranges roughly from 0 to 1.0 (dimple height).

            // Map Height (z) and Global Tension (tension prop) to Color.

            // 1. Normalize height (0 to ~1)
            const h = THREE.MathUtils.clamp(z, 0, 1);

            // 2. Color Logic
            // If Tension is High (1.0) -> Whole field is "Tight" -> Warm colors (Red/Orange)
            // If Tension is Low (0.0) -> Whole field is "Loose" -> Cool colors (Blue/Purple)
            // AND, we want to see the gradient across the shape.

            // Let's try:
            // Base Hue depends on Tension (0=Blue/0.6, 1=Red/0.0)
            // Local variation depends on Height (Higher = Tighter/Warmer?)

            // Global Base:
            const baseHue = 0.6 * (1 - tension); // 0.6 (Blue) -> 0.0 (Red)

            // Local Variation (Height adds "heat"):
            // If y is high (dimple), it's "tighter" or "more active".
            // Let's shift hue towards Red as Y increases.
            const hueShift = 0.2 * h;
            let finalHue = baseHue - hueShift;
            if (finalHue < 0) finalHue += 1; // Wrap or clamp? Red is 0.
            finalHue = Math.max(0, finalHue);

            // Saturation/Lightness
            const s = 1.0;
            const l = 0.5 + 0.3 * h; // Higher = Brighter

            color.setHSL(finalHue, s, l);

            colorAttr.setXYZ(i, color.r, color.g, color.b);
        }

        colorAttr.needsUpdate = true;
    }, [tension, geometry]);

    useFrame((state) => {
        if (!meshRef.current) return;
        // Optional: Subtle breathing animation
        // meshRef.current.scale.setScalar(1 + 0.005 * Math.sin(state.clock.elapsedTime));
    });

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

// Component for tonefield boundary lines
function TonefieldBoundaries({ hitPointLocation }: { hitPointLocation: "internal" | "external" | null }) {
    // 초기 상태: 투명도 80% 회색, 타점값에 따라 파란색(내부) 또는 빨간색(외부)
    let color: number;
    let opacity: number;

    if (hitPointLocation === "internal") {
        color = 0x3b82f6; // Blue for internal
        opacity = 1.0;
    } else if (hitPointLocation === "external") {
        color = 0xdc2626; // Red for external
        opacity = 1.0;
    } else {
        color = 0x808080; // Gray for initial state
        opacity = 0.8;
    }

    const outerLine = useMemo(() => {
        const curve = new THREE.EllipseCurve(
            0, 0,              // center x, y
            0.3, 0.425,        // xRadius (0.6/2), yRadius (0.85/2)
            0, 2 * Math.PI,    // start angle, end angle
            false,             // clockwise
            0                  // rotation
        );
        const points = curve.getPoints(64);
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({
            color: color,
            transparent: true,
            opacity: opacity,
            linewidth: 2
        });
        const line = new THREE.Line(geometry, material);
        // No rotation needed - already in XY plane
        return line;
    }, [color, opacity]);

    const innerLine = useMemo(() => {
        // Inner dimple boundary at 35% of outer radius
        const curve = new THREE.EllipseCurve(
            0, 0,
            0.3 * 0.35, 0.425 * 0.35, // 35% of outer radii
            0, 2 * Math.PI,
            false,
            0
        );
        const points = curve.getPoints(64);
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({
            color: color,
            transparent: true,
            opacity: opacity,
            linewidth: 1.5
        });
        const line = new THREE.Line(geometry, material);
        // No rotation needed - already in XY plane
        return line;
    }, [color, opacity]);

    // 대각선 4개 (점선, 타원 외곽선과 동일한 색상)
    const diagonalLines = useMemo(() => {
        const outerRadiusX = 0.3;
        const outerRadiusY = 0.425;
        const innerRadiusX = 0.3 * 0.35; // 35% of outer radius
        const innerRadiusY = 0.425 * 0.35; // 35% of outer radius
        const lines = [];

        // 4개의 대각선 방향 (45도, 135도, 225도, 315도)
        const angles = [
            Math.PI / 4,       // 45도 (오른쪽 위)
            3 * Math.PI / 4,   // 135도 (왼쪽 위)
            5 * Math.PI / 4,   // 225도 (왼쪽 아래)
            7 * Math.PI / 4    // 315도 (오른쪽 아래)
        ];

        for (const angle of angles) {
            // 외부 타원 위의 점
            const outerX = outerRadiusX * Math.cos(angle);
            const outerY = outerRadiusY * Math.sin(angle);

            // 내부 타원 위의 점
            const innerX = innerRadiusX * Math.cos(angle);
            const innerY = innerRadiusY * Math.sin(angle);

            // 각 방향마다 2개의 선분 (중심을 사이에 두고 양쪽)
            // 선분 1: 양의 방향 (내부 타원 -> 외부 타원)
            const points1 = [
                new THREE.Vector3(innerX, innerY, 0),
                new THREE.Vector3(outerX, outerY, 0)
            ];

            // 선분 2: 음의 방향 (내부 타원 -> 외부 타원)
            const points2 = [
                new THREE.Vector3(-innerX, -innerY, 0),
                new THREE.Vector3(-outerX, -outerY, 0)
            ];

            // 첫 번째 선분 (타원 외곽선과 동일한 색상 사용)
            const geometry1 = new THREE.BufferGeometry().setFromPoints(points1);
            const material1 = new THREE.LineDashedMaterial({
                color: color,
                transparent: true,
                opacity: opacity,
                linewidth: 1,
                dashSize: 0.02,
                gapSize: 0.01
            });
            const line1 = new THREE.Line(geometry1, material1);
            line1.computeLineDistances();
            lines.push(line1);

            // 두 번째 선분 (타원 외곽선과 동일한 색상 사용)
            const geometry2 = new THREE.BufferGeometry().setFromPoints(points2);
            const material2 = new THREE.LineDashedMaterial({
                color: color,
                transparent: true,
                opacity: opacity,
                linewidth: 1,
                dashSize: 0.02,
                gapSize: 0.01
            });
            const line2 = new THREE.Line(geometry2, material2);
            line2.computeLineDistances();
            lines.push(line2);
        }

        return lines;
    }, [color, opacity]);

    return (
        <group position={[0, 0, 0.001]}> {/* Slightly above surface (Z-axis) to avoid z-fighting */}
            {/* Outer tonefield boundary */}
            <primitive object={outerLine} />

            {/* Inner dimple boundary */}
            <primitive object={innerLine} />

            {/* 대각선 4개 (점선) */}
            {diagonalLines.map((line, index) => (
                <primitive key={`diagonal-${index}`} object={line} />
            ))}
        </group>
    );
}

// Component for animated ring around hit point
function AnimatedRing({ position }: { position: [number, number, number] }) {
    const ringRef = useRef<THREE.Mesh>(null);

    useFrame((state) => {
        if (!ringRef.current) return;

        // Pulsing scale animation
        const scale = 1 + 0.15 * Math.sin(state.clock.elapsedTime * 3);
        ringRef.current.scale.setScalar(scale);

        // Rotation animation
        ringRef.current.rotation.z = state.clock.elapsedTime * 2;

        // Pulsing opacity
        const material = ringRef.current.material as THREE.MeshBasicMaterial;
        material.opacity = 0.5 + 0.3 * Math.sin(state.clock.elapsedTime * 3);
    });

    return (
        <mesh ref={ringRef} position={position}>
            {/* Reduced size by 50% - Already in XY plane */}
            <ringGeometry args={[0.015, 0.025, 32]} />
            <meshBasicMaterial color="#00ffff" transparent opacity={0.8} side={THREE.DoubleSide} />
        </mesh>
    );
}

// Component for hit point marker visualization
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
    // Convert 2D tonefield coordinates to 3D world coordinates
    // x maps to X-axis, y maps to Y-axis (XY plane)
    const worldX = x;
    const worldY = y;
    const worldZ = 0.002; // Slightly above the tonefield surface

    return (
        <group>
            {/* Hit point marker sphere - Reduced size by 50% */}
            <mesh position={[worldX, worldY, worldZ]}>
                <sphereGeometry args={[0.01, 16, 16]} />
                <meshStandardMaterial color="#ff0066" emissive="#ff0066" emissiveIntensity={0.5} />
            </mesh>

            {/* Animated ring around hit point */}
            <AnimatedRing position={[worldX, worldY, worldZ]} />

            {/* Info label using HTML overlay for better styling and no overlap */}
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
                        {/* Little triangle pointer */}
                        <div className="absolute -bottom-1.5 left-1/2 transform -translate-x-1/2 w-3 h-3 bg-gray-900 rotate-45 border-r border-b border-gray-700"></div>
                    </div>
                </div>
            </Html>
        </group>
    );
}

// Component for coordinate grid and tuning area in 3D space
function CoordinateGrid() {
    return (
        <group>
            {/* Coordinate plane at z=0 (XY plane) */}
            {/* gridHelper is by default in XZ plane, rotate 90deg around X-axis to make it XY plane */}
            <gridHelper
                args={[2, 8, '#666666', '#333333']}
                position={[0, 0, 0]}
                rotation={[Math.PI / 2, 0, 0]}
            />

            {/* Tuning Box - 정사각형 외곽선과 축 레이블을 그룹화 */}
            <group name="tuningBox">
                {/* 1x1 Tuning area square boundary - XY plane */}
                <lineSegments>
                    <edgesGeometry
                        args={[new THREE.PlaneGeometry(1, 1)]}
                    />
                    <lineBasicMaterial color="#808080" transparent opacity={0.3} linewidth={3} />
                </lineSegments>

                {/* Axis Labels */}
                {/* X-axis labels (bottom) */}
                <Text
                    position={[-0.5, -0.6, 0.02]}
                    fontSize={0.04}
                    color="#808080"
                    opacity={0.3}
                    anchorX="center"
                    anchorY="middle"
                >
                    -1
                </Text>
                <Text
                    position={[0, -0.6, 0.02]}
                    fontSize={0.04}
                    color="#808080"
                    opacity={0.3}
                    anchorX="center"
                    anchorY="middle"
                >
                    0
                </Text>
                <Text
                    position={[0.5, -0.6, 0.02]}
                    fontSize={0.04}
                    color="#808080"
                    opacity={0.3}
                    anchorX="center"
                    anchorY="middle"
                >
                    1
                </Text>

                {/* Y-axis labels (left side) */}
                <Text
                    position={[-0.6, -0.5, 0.02]}
                    fontSize={0.04}
                    color="#808080"
                    opacity={0.3}
                    anchorX="center"
                    anchorY="middle"
                >
                    -1
                </Text>
                <Text
                    position={[-0.6, 0, 0.02]}
                    fontSize={0.04}
                    color="#808080"
                    opacity={0.3}
                    anchorX="center"
                    anchorY="middle"
                >
                    0
                </Text>
                <Text
                    position={[-0.6, 0.5, 0.02]}
                    fontSize={0.04}
                    color="#808080"
                    opacity={0.3}
                    anchorX="center"
                    anchorY="middle"
                >
                    1
                </Text>
            </group>

            {/* Coordinate axes */}
            <axesHelper args={[1.2]} />
        </group>
    );
}

// Camera controller component
function CameraController({ viewMode }: { viewMode: 'perspective' | 'top' }) {
    const { camera } = useThree();

    useEffect(() => {
        if (viewMode === 'top') {
            // Top-down view: camera directly above XY plane (Z-axis) looking down
            camera.position.set(0, 0, 1.5);
            camera.lookAt(0, 0, 0);
        } else {
            // Perspective view: angled view from above and to the side
            camera.position.set(2, 2, 2);
            camera.lookAt(0, 0, 0);
        }
        camera.updateProjectionMatrix();
    }, [viewMode, camera]);

    return null;
}

export function ToneField() {
    const [tension, setTension] = useState(0.5);
    const [wireframe, setWireframe] = useState(true);
    const [cameraView, setCameraView] = useState<'perspective' | 'top'>('top'); // Changed to 'top'
    const [controlsOpen, setControlsOpen] = useState(false); // Controls panel state - 초기값: 닫힘

    // Tuning error states
    const [tonicError, setTonicError] = useState(0);
    const [octaveError, setOctaveError] = useState(0);
    const [fifthError, setFifthError] = useState(0);

    // Hit point parameter states
    const [tuningTarget, setTuningTarget] = useState<string | null>(null);
    const [auxiliaryTarget, setAuxiliaryTarget] = useState<string | null>(null);
    const [targetDisplay, setTargetDisplay] = useState("");
    const [hitPointIntent, setHitPointIntent] = useState("");
    const [hitPointLocation, setHitPointLocation] = useState<"internal" | "external" | null>(null);
    const [hitPointCoordinate, setHitPointCoordinate] = useState("");
    const [hitPointStrength, setHitPointStrength] = useState("");
    const [hitPointCount, setHitPointCount] = useState("");
    const [hammeringType, setHammeringType] = useState("");

    // Recent Hit Points State
    interface HitPointData {
        id?: string;
        created_at?: string;
        tonic: number;
        octave: number;
        fifth: number;
        tuning_target: string | null;
        primary_target: string | null;
        auxiliary_target: string | null;
        is_compound: boolean;
        target_display: string;
        intent: string;
        location: "internal" | "external";
        coordinate_x: number;
        coordinate_y: number;
        strength: number;
        hit_count: number;
        hammering_type: string | null;
    }

    const [recentHitPoints, setRecentHitPoints] = useState<HitPointData[]>([]);
    const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
    const [selectedHitPoint, setSelectedHitPoint] = useState<HitPointData | null>(null);
    const [isLoadingHitPoints, setIsLoadingHitPoints] = useState(false);
    const cardsContainerRef = useRef<HTMLDivElement>(null);
    const [panelWidth, setPanelWidth] = useState(480);
    const [isClient, setIsClient] = useState(false);
    const [rightPanelWidth, setRightPanelWidth] = useState<string | number>('100%');
    const isResizingRef = useRef(false);
    const startXRef = useRef(0);
    const startWidthRef = useRef(0);
    const handleResizeMouseDown = (e: React.MouseEvent) => {
        isResizingRef.current = true;
        startXRef.current = e.clientX;
        startWidthRef.current = panelWidth;
        document.addEventListener('mousemove', handleResizeMouseMove);
        document.addEventListener('mouseup', handleResizeMouseUp);
    };
    const handleResizeMouseMove = (e: MouseEvent) => {
        if (!isResizingRef.current) return;
        const delta = e.clientX - startXRef.current;
        setPanelWidth(Math.max(300, startWidthRef.current + delta));
    };
    const handleResizeMouseUp = () => {
        isResizingRef.current = false;
        document.removeEventListener('mousemove', handleResizeMouseMove);
        document.removeEventListener('mouseup', handleResizeMouseUp);
    };
    // Hammering type mapping
    const hammeringTypeMap: Record<string, string> = {
        SNAP: "튕겨치기",
        PULL: "당겨치기",
        PRESS: "눌러치기"
    };

    // Physics constants
    // Note: These should match the geometry radius (width/2 and height/2)
    // Geometry width=0.6 -> Radius X = 0.3
    // Geometry height=0.85 -> Radius Y = 0.425
    const TONEFIELD_RADIUS_X = 0.3;
    const TONEFIELD_RADIUS_Y = 0.425;
    const THRESHOLD_C = 20.0;
    const SCALING_S = 30.0;
    const SAFETY_RATIO = 2.1;
    const LIMIT = THRESHOLD_C * SAFETY_RATIO; // 42.0
    const STIFFNESS_K = { tonic: 1.0, octave: 0.9, fifth: 1.2 };
    const HAMMERING_RULES = {
        INTERNAL: { SNAP_LIMIT: 1.0, PRESS_START: 10.0 },
        EXTERNAL: { SNAP_LIMIT: 5.0 }
    };

    // Debug: Log state changes
    useEffect(() => {
        console.log('📊 State updated - tonicError (5도):', tonicError);
    }, [tonicError]);

    useEffect(() => {
        console.log('📊 State updated - octaveError (옥타브):', octaveError);
    }, [octaveError]);

    useEffect(() => {
        console.log('📊 State updated - fifthError (토닉):', fifthError);
    }, [fifthError]);

    // Auto-calculate tuning target (primary + auxiliary) based on weighted error values
    // Weight: tonic×6, octave×3, fifth×2 (to account for frequency ratios 1:2:3)
    useEffect(() => {
        const tonicValue = Math.abs(fifthError) * 6;  // fifthError is actually tonic
        const octaveValue = Math.abs(octaveError) * 3;
        const fifthValue = Math.abs(tonicError) * 2;  // tonicError is actually fifth (5도)

        const scores = [
            { type: '토닉', key: 'tonic', score: tonicValue, value: fifthError },
            { type: '옥타브', key: 'octave', score: octaveValue, value: octaveError },
            { type: '5도', key: 'fifth', score: fifthValue, value: tonicError }
        ].sort((a, b) => b.score - a.score);

        const primary = scores[0];
        const maxValue = primary.score;

        if (maxValue === 0) {
            setTuningTarget(null);
            setAuxiliaryTarget(null);
            setTargetDisplay("");
            return;
        }

        // Set primary tuning target
        setTuningTarget(primary.type);

        // 보조 조율대상 선정 로직 (좌표계 사분면 기반)
        // 토닉과 옥타브는 Y축을 공유하지만 방향이 반대이므로 절대로 보조가 될 수 없음
        let auxiliary: typeof scores[0] | undefined = undefined;

        if (primary.key === 'tonic' || primary.key === 'octave') {
            // Primary가 토닉 또는 옥타브인 경우 → 보조는 5도만 가능
            const fifthCandidate = scores.find(item => item.key === 'fifth' && item.value !== 0);
            if (fifthCandidate) {
                // 5도와 부호가 같은 경우에만 보조로 선정
                const primarySign = Math.sign(primary.value);
                const fifthSign = Math.sign(fifthCandidate.value);
                if (primarySign === fifthSign) {
                    auxiliary = fifthCandidate;
                }
            }
        } else if (primary.key === 'fifth') {
            // Primary가 5도인 경우 → 보조는 토닉 또는 옥타브 중 부호가 같은 것
            const primarySign = Math.sign(primary.value);
            const candidates = scores
                .slice(1)
                .filter(item =>
                    (item.key === 'tonic' || item.key === 'octave') &&
                    item.value !== 0 &&
                    Math.sign(item.value) === primarySign
                );

            if (candidates.length > 0) {
                // 가중치 점수가 더 높은 것을 선택
                candidates.sort((a, b) => b.score - a.score);
                auxiliary = candidates[0];
            }
        }

        if (auxiliary) {
            setAuxiliaryTarget(auxiliary.type);
            setTargetDisplay(`${primary.type} (+${auxiliary.type})`);
        } else {
            setAuxiliaryTarget(null);
            setTargetDisplay(primary.type);
        }
    }, [tonicError, octaveError, fifthError]);

    // Auto-calculate intention and location based on tuning target
    useEffect(() => {
        if (selectedHitPoint) return;
        if (!tuningTarget) {
            setHitPointIntent("");
            setHitPointLocation(null);
            return;
        }

        // Get the target value based on tuning target
        let targetValue: number;
        if (tuningTarget === "토닉") {
            targetValue = fifthError;
        } else if (tuningTarget === "옥타브") {
            targetValue = octaveError;
        } else {
            targetValue = tonicError;
        }

        // Auto-suggest intention
        // Positive: too high → need to lower (하향)
        // Negative: too low → need to raise (상향)
        const suggestedIntent = targetValue > 0 ? "하향" : targetValue < 0 ? "상향" : "";
        setHitPointIntent(suggestedIntent);

        // Auto-select location
        // 하향 → external hit
        // 상향 → internal hit
        const autoPosition = targetValue > 0 ? "external" : targetValue < 0 ? "internal" : null;
        setHitPointLocation(autoPosition);
    }, [tuningTarget, tonicError, octaveError, fifthError, selectedHitPoint]);

    // Auto-calculate coordinates, strength, count, and hammering type
    useEffect(() => {
        if (selectedHitPoint) return;
        if (!tuningTarget || !hitPointLocation) {
            setHitPointCoordinate("");
            setHitPointStrength("");
            setHitPointCount("");
            setHammeringType("");
            return;
        }

        // Get error values
        const tonicVal = fifthError;
        const octaveVal = octaveError;
        const fifthVal = tonicError;

        const eT = Math.abs(tonicVal);
        const eO = Math.abs(octaveVal);
        const eF = Math.abs(fifthVal);

        // Physical forces (raw Hz values)
        const forceTonic = eT;
        const forceOctave = eO;
        const forceFifth = eF;

        // Primary target determination
        const scores = [
            { type: 'tonic', key: '토닉', score: eT * 6, value: tonicVal, force: forceTonic },
            { type: 'octave', key: '옥타브', score: eO * 3, value: octaveVal, force: forceOctave },
            { type: 'fifth', key: '5도', score: eF * 2, value: fifthVal, force: forceFifth }
        ].sort((a, b) => b.score - a.score);

        const primary = scores[0];
        const primaryErrorValue = primary.value;

        // Vector force calculation
        let vectorX = 0;
        let vectorY = 0;

        if (primary.type === 'fifth') {
            // X-axis force: fifth direction (random left/right)
            const isRight = Math.random() >= 0.5;
            vectorX = isRight ? forceFifth : -forceFifth;

            // Y-axis partner finding
            const fifthSign = Math.sign(primary.value);
            const candidates = [
                { type: 'octave', value: octaveVal, force: forceOctave, sign: Math.sign(octaveVal) },
                { type: 'tonic', value: tonicVal, force: forceTonic, sign: Math.sign(tonicVal) }
            ];

            const cooperatives = candidates.filter(c => c.sign === fifthSign && c.value !== 0);
            if (cooperatives.length > 0) {
                cooperatives.sort((a, b) => b.force - a.force);
                const partner = cooperatives[0];
                if (partner.type === 'octave') {
                    vectorY = partner.force;
                } else {
                    vectorY = -partner.force;
                }
            } else {
                vectorY = 0;
            }
        } else {
            // Y-axis force: primary target direction
            if (primary.type === 'octave') {
                vectorY = forceOctave;
            } else {
                vectorY = -forceTonic;
            }

            // X-axis force: check cooperation with fifth
            const isSignSame = Math.sign(primary.value) === Math.sign(fifthVal);
            if (isSignSame || fifthVal === 0) {
                const isRight = Math.random() >= 0.5;
                vectorX = isRight ? forceFifth : -forceFifth;
            } else {
                vectorX = 0;
            }
        }

        // Angle calculation and elliptical coordinate mapping
        const theta = Math.atan2(vectorY, vectorX);
        const x = TONEFIELD_RADIUS_X * Math.cos(theta);
        const y = TONEFIELD_RADIUS_Y * Math.sin(theta);

        setHitPointCoordinate(`(${x.toFixed(3)}, ${y.toFixed(3)})`);

        // Strength and count calculation
        const mode = primary.type as 'tonic' | 'octave' | 'fifth';

        // Relative efficiency
        let currentPos = 0;
        let vertexPos = 1.0;
        if (mode === 'fifth') {
            currentPos = Math.abs(x);
            vertexPos = TONEFIELD_RADIUS_X;
        } else {
            currentPos = Math.abs(y);
            vertexPos = TONEFIELD_RADIUS_Y;
        }
        const efficiency = Math.max(currentPos / vertexPos, 0.1);
        const effectiveHz = Math.abs(primaryErrorValue) / efficiency;

        // Energy calculation
        const stiffness = STIFFNESS_K[mode] || 1.0;
        const pureEnergy = Math.sqrt(effectiveHz * SCALING_S * stiffness);
        const requiredForce = THRESHOLD_C + pureEnergy;

        // Multi-hit safety splitting
        let finalForce = requiredForce;
        let finalCount = 1;

        if (requiredForce > LIMIT) {
            let count = 2;
            while (true) {
                const splitEnergy = pureEnergy / Math.sqrt(count);
                const currentForce = THRESHOLD_C + splitEnergy;
                if (currentForce <= LIMIT) {
                    finalForce = currentForce;
                    finalCount = count;
                    break;
                }
                count++;
                if (count > 10) {
                    finalForce = LIMIT;
                    finalCount = 10;
                    break;
                }
            }
        }

        setHitPointStrength(finalForce.toFixed(1));
        setHitPointCount(finalCount.toString());

        // Hammering type determination
        const absHz = Math.abs(primaryErrorValue);
        let hammeringTypeResult: string;

        if (primaryErrorValue < 0) {
            // Internal hit
            if (absHz <= HAMMERING_RULES.INTERNAL.SNAP_LIMIT) {
                hammeringTypeResult = "튕겨치기";
            } else if (absHz < HAMMERING_RULES.INTERNAL.PRESS_START) {
                hammeringTypeResult = "당겨치기";
            } else {
                hammeringTypeResult = "눌러치기";
            }
        } else {
            // External hit
            if (absHz <= HAMMERING_RULES.EXTERNAL.SNAP_LIMIT) {
                hammeringTypeResult = "튕겨치기";
            } else {
                hammeringTypeResult = "눌러치기";
            }
        }

        setHammeringType(hammeringTypeResult);
    }, [tuningTarget, hitPointLocation, tonicError, octaveError, fifthError, selectedHitPoint]);

    // Randomize tuning errors
    const handleRandomize = () => {
        // Generate random values between -30.0 and +30.0 with 1 decimal place
        const random5do = parseFloat((Math.random() * 60 - 30).toFixed(1));
        const randomOctave = parseFloat((Math.random() * 60 - 30).toFixed(1));
        const randomTonic = parseFloat((Math.random() * 60 - 30).toFixed(1));

        setTonicError(random5do);
        setOctaveError(randomOctave);
        setFifthError(randomTonic);
    };

    // Supabase save handler
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

    const handleSaveHitPoint = async () => {
        if (!hitPointCoordinate || !hitPointStrength || !hitPointCount || !hammeringType) {
            alert("타점 파라미터가 모두 계산되지 않았습니다.");
            return;
        }

        setIsSaving(true);
        setSaveStatus('idle');

        try {
            // Parse coordinate string "(x, y)"
            const coordMatch = hitPointCoordinate.match(/\(([\d.-]+),\s*([\d.-]+)\)/);
            const coordX = coordMatch ? parseFloat(coordMatch[1]) : 0;
            const coordY = coordMatch ? parseFloat(coordMatch[2]) : 0;

            // Map Korean values back to English/DB codes
            const mapTargetToEng = (kor: string | null) => {
                if (kor === "토닉") return "tonic";
                if (kor === "옥타브") return "octave";
                if (kor === "5도") return "fifth";
                return null;
            };

            const mapHammeringToEng = (kor: string) => {
                if (kor === "튕겨치기") return "SNAP";
                if (kor === "당겨치기") return "PULL";
                if (kor === "눌러치기") return "PRESS";
                return kor; // Fallback
            };

            const dbData = {
                tonic: fifthError,      // State 'fifthError' is Tonic label
                octave: octaveError,    // State 'octaveError' is Octave label
                fifth: tonicError,      // State 'tonicError' is Fifth label

                tuning_target: mapTargetToEng(tuningTarget),
                primary_target: mapTargetToEng(tuningTarget), // tuningTarget is the primary
                auxiliary_target: mapTargetToEng(auxiliaryTarget),
                is_compound: !!auxiliaryTarget,
                target_display: targetDisplay,

                intent: hitPointIntent,
                location: hitPointLocation,

                coordinate_x: coordX,
                coordinate_y: coordY,

                strength: parseFloat(hitPointStrength),
                hit_count: parseInt(hitPointCount),
                hammering_type: mapHammeringToEng(hammeringType)
            };

            const { error } = await supabase
                .from('hit_points')
                .insert([dbData]);

            if (error) throw error;

            setSaveStatus('success');
            // Reset status after 3 seconds
            setTimeout(() => setSaveStatus('idle'), 3000);

        } catch (error) {
            console.error('Error saving hit point:', error);
            setSaveStatus('error');
            alert('데이터 저장 중 오류가 발생했습니다.');
        } finally {
            setIsSaving(false);
        }
    };

    // Fetch recent hit points
    const fetchRecentHitPoints = async () => {
        try {
            setIsLoadingHitPoints(true);
            const { data, error } = await supabase
                .from("hit_points")
                .select("*")
                .order("created_at", { ascending: false })
                .limit(10);

            if (error) {
                console.error("데이터 불러오기 오류:", error);
            } else if (data) {
                setRecentHitPoints(data as HitPointData[]);
            }
        } catch (err) {
            console.error("데이터 불러오기 중 오류:", err);
        } finally {
            setIsLoadingHitPoints(false);
        }
    };

    // Initial fetch
    useEffect(() => {
        fetchRecentHitPoints();
    }, []);

    // Client-side hydration fix
    useEffect(() => {
        setIsClient(true);
        // Set initial width
        setRightPanelWidth(`${panelWidth}px`);
    }, [panelWidth]);

    // Refresh after save
    useEffect(() => {
        if (saveStatus === 'success') {
            fetchRecentHitPoints();
        }
    }, [saveStatus]);

    // Handle card click (expand/collapse)
    const handleHitPointCardClick = (hitPoint: HitPointData) => {
        const cardId = hitPoint.id!;
        if (expandedCards.has(cardId)) {
            setExpandedCards(new Set());
            setSelectedHitPoint(null);

            // Clear visualization
            setHitPointCoordinate("");
            setHitPointStrength("");
            setHitPointCount("");
            setHammeringType("");
            setHitPointIntent("");
            setHitPointLocation(null);
            setTargetDisplay("");
            setTuningTarget(null);
            setAuxiliaryTarget(null);
            setTonicError(0);
            setOctaveError(0);
            setFifthError(0);
        } else {
            setExpandedCards(new Set([cardId]));
            setSelectedHitPoint(hitPoint);

            // Populate states
            setTonicError(hitPoint.fifth);
            setOctaveError(hitPoint.octave);
            setFifthError(hitPoint.tonic);

            setHitPointCoordinate(`(${hitPoint.coordinate_x.toFixed(3)}, ${hitPoint.coordinate_y.toFixed(3)})`);
            setHitPointStrength(hitPoint.strength.toString());
            setHitPointCount(hitPoint.hit_count.toString());

            const korHammering = hammeringTypeMap[hitPoint.hammering_type || ""] || hitPoint.hammering_type || "";
            setHammeringType(korHammering);

            setHitPointLocation(hitPoint.location);
            setHitPointIntent(hitPoint.intent);
            setTargetDisplay(hitPoint.target_display);

            const mapEngToKor = (eng: string | null) => {
                if (eng === "fifth") return "5도";
                if (eng === "octave") return "옥타브";
                if (eng === "tonic") return "토닉";
                return null;
            };

            setTuningTarget(mapEngToKor(hitPoint.primary_target || hitPoint.tuning_target));
            setAuxiliaryTarget(mapEngToKor(hitPoint.auxiliary_target));
        }
    };

    // Handle outside click to collapse cards
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                cardsContainerRef.current &&
                !cardsContainerRef.current.contains(event.target as Node) &&
                expandedCards.size > 0
            ) {
                setExpandedCards(new Set());
                setSelectedHitPoint(null);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [expandedCards]);

    // Handle delete hit point
    const handleDeleteHitPoint = async (e: React.MouseEvent, hitPointId: string) => {
        e.stopPropagation();
        if (!confirm("이 타점 데이터를 삭제하시겠습니까?")) {
            return;
        }

        try {
            const { error } = await supabase
                .from("hit_points")
                .delete()
                .eq("id", hitPointId);

            if (error) {
                console.error("삭제 오류:", error);
                alert(`삭제 실패: ${error.message}`);
            } else {
                if (selectedHitPoint?.id === hitPointId) {
                    setSelectedHitPoint(null);
                }
                const newExpanded = new Set(expandedCards);
                newExpanded.delete(hitPointId);
                setExpandedCards(newExpanded);
                fetchRecentHitPoints();
            }
        } catch (err) {
            console.error("삭제 중 오류 발생:", err);
            alert("삭제 중 오류가 발생했습니다.");
        }
    };

    return (
        <div className="w-full h-screen flex flex-row" style={{ backgroundColor: '#000000' }}>
            {/* Left Panel - Tuning Error Input */}
            <div className="w-80 bg-gray-900 border-r border-gray-700 flex flex-col z-10 shadow-xl h-full overflow-y-auto">
                <div className="p-4 flex-1">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-lg font-bold text-gray-100">조율오차 입력</h2>
                        <button
                            onClick={() => {
                                // Generate random values between -30.0 and +30.0 with 1 decimal place
                                const random5do = parseFloat((Math.random() * 60 - 30).toFixed(1));
                                const randomOctave = parseFloat((Math.random() * 60 - 30).toFixed(1));
                                const randomTonic = parseFloat((Math.random() * 60 - 30).toFixed(1));

                                console.log('Generated random values:', {
                                    random5do,
                                    randomOctave,
                                    randomTonic
                                });

                                setTonicError(random5do);
                                setOctaveError(randomOctave);
                                setFifthError(randomTonic);
                            }}
                            className="w-8 h-8 rounded-full bg-red-600 text-white font-bold flex items-center justify-center hover:bg-red-700 transition-colors shadow-lg"
                            title="Randomize tuning errors"
                        >
                            R
                        </button>
                    </div>

                    <div className="space-y-2">
                        {/* Fifth Error (5도) */}
                        <div>
                            <label className={`block text-sm font-medium mb-1 transition-colors ${tuningTarget === "5도"
                                ? "text-red-400"
                                : auxiliaryTarget === "5도"
                                    ? "text-red-500/70"
                                    : "text-gray-300"
                                }`}>
                                5도 (Hz)
                            </label>
                            <input
                                type="text"
                                value={tonicError === 0 ? '' : tonicError}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    if (value === '' || value === '-' || value === '+') {
                                        setTonicError(0);
                                    } else {
                                        const parsed = parseFloat(value);
                                        if (!isNaN(parsed)) {
                                            setTonicError(parsed);
                                        }
                                    }
                                }}
                                className={`w-full px-2 py-1.5 border-2 rounded-lg text-center text-base font-semibold transition-all ${tuningTarget === "5도"
                                    ? "border-red-500 bg-red-900/30 text-red-300 focus:ring-2 focus:ring-red-500"
                                    : auxiliaryTarget === "5도"
                                        ? "border-red-500/50 bg-red-900/20 text-red-400/70 focus:ring-2 focus:ring-red-500/50"
                                        : "border-gray-600 bg-gray-800 text-gray-200 focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                                    }`}
                                placeholder="0"
                            />
                        </div>

                        {/* Octave Error */}
                        <div>
                            <label className={`block text-sm font-medium mb-1 transition-colors ${tuningTarget === "옥타브"
                                ? "text-red-400"
                                : auxiliaryTarget === "옥타브"
                                    ? "text-red-500/70"
                                    : "text-gray-300"
                                }`}>
                                옥타브 (Hz)
                            </label>
                            <input
                                type="text"
                                value={octaveError === 0 ? '' : octaveError}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    if (value === '' || value === '-' || value === '+') {
                                        setOctaveError(0);
                                    } else {
                                        const parsed = parseFloat(value);
                                        if (!isNaN(parsed)) {
                                            setOctaveError(parsed);
                                        }
                                    }
                                }}
                                className={`w-full px-3 py-2 border-2 rounded-lg text-center text-lg font-semibold transition-all ${tuningTarget === "옥타브"
                                    ? "border-red-500 bg-red-900/30 text-red-300 focus:ring-2 focus:ring-red-500"
                                    : auxiliaryTarget === "옥타브"
                                        ? "border-red-500/50 bg-red-900/20 text-red-400/70 focus:ring-2 focus:ring-red-500/50"
                                        : "border-gray-600 bg-gray-800 text-gray-200 focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                                    }`}
                                placeholder="0"
                            />
                        </div>

                        {/* Tonic Error (토닉) */}
                        <div>
                            <label className={`block text-sm font-medium mb-1 transition-colors ${tuningTarget === "토닉"
                                ? "text-red-400"
                                : auxiliaryTarget === "토닉"
                                    ? "text-red-500/70"
                                    : "text-gray-300"
                                }`}>
                                토닉 (Hz)
                            </label>
                            <input
                                type="text"
                                value={fifthError === 0 ? '' : fifthError}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    if (value === '' || value === '-' || value === '+') {
                                        setFifthError(0);
                                    } else {
                                        const parsed = parseFloat(value);
                                        if (!isNaN(parsed)) {
                                            setFifthError(parsed);
                                        }
                                    }
                                }}
                                className={`w-full px-3 py-2 border-2 rounded-lg text-center text-lg font-semibold transition-all ${tuningTarget === "토닉"
                                    ? "border-red-500 bg-red-900/30 text-red-300 focus:ring-2 focus:ring-red-500"
                                    : auxiliaryTarget === "토닉"
                                        ? "border-red-500/50 bg-red-900/20 text-red-400/70 focus:ring-2 focus:ring-red-500/50"
                                        : "border-gray-600 bg-gray-800 text-gray-200 focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                                    }`}
                                placeholder="0"
                            />
                        </div>
                    </div>

                    {/* Hit Point Parameters Section */}
                    <div className="mt-3 pt-3 border-t border-gray-700">
                        <h3 className="text-sm font-bold text-blue-400 mb-2">타점 파라미터</h3>

                        <div className="space-y-2 bg-gray-800/50 p-3 rounded-xl border border-gray-700">
                            {/* Location and Intention Row */}
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <div className="flex items-center justify-between mb-0.5">
                                        <label className="block text-xs text-gray-400">조율대상</label>
                                        {targetDisplay && (
                                            <span className="text-xs text-blue-400">자동 계산됨</span>
                                        )}
                                    </div>
                                    <input
                                        type="text"
                                        value={targetDisplay}
                                        readOnly
                                        className="w-full px-2 py-1 border border-gray-600 rounded text-sm text-center bg-gray-800 text-gray-200 font-semibold cursor-not-allowed"
                                        placeholder="조율대상"
                                    />
                                </div>
                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="block text-xs text-gray-400">의도</label>
                                        {hitPointIntent && (
                                            <span className="text-xs text-blue-400">자동 계산됨</span>
                                        )}
                                    </div>
                                    <input
                                        type="text"
                                        value={hitPointIntent}
                                        onChange={(e) => setHitPointIntent(e.target.value)}
                                        className="w-full px-2 py-1 border border-gray-600 rounded text-sm text-center bg-gray-800 text-gray-200"
                                        placeholder="의도"
                                    />
                                </div>
                            </div>

                            {/* Position Buttons */}
                            <div>
                                <label className="block text-xs text-gray-400 mb-0.5">
                                    위치
                                    {hitPointLocation && (
                                        <span className="float-right text-blue-400 text-xs">자동 계산됨</span>
                                    )}
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => setHitPointLocation("internal")}
                                        className={`px-2 py-1.5 rounded-lg text-sm font-medium transition-colors ${hitPointLocation === "internal"
                                            ? "bg-blue-600 text-white hover:bg-blue-700"
                                            : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                                            }`}
                                    >
                                        내부
                                    </button>
                                    <button
                                        onClick={() => setHitPointLocation("external")}
                                        className={`px-2 py-1.5 rounded-lg text-sm font-medium transition-colors ${hitPointLocation === "external"
                                            ? "bg-red-600 text-white hover:bg-red-700"
                                            : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                                            }`}
                                    >
                                        외부
                                    </button>
                                </div>
                            </div>

                            {/* Hit Point Coordinates */}
                            <div>
                                <div className="flex items-center justify-between mb-0.5">
                                    <label className="block text-xs text-gray-400">좌표</label>
                                    {hitPointCoordinate && (
                                        <span className="text-xs text-blue-400">자동 계산됨</span>
                                    )}
                                </div>
                                <input
                                    type="text"
                                    value={hitPointCoordinate}
                                    readOnly
                                    className="w-full px-2 py-1 border border-gray-600 rounded-lg text-sm text-center text-gray-200 bg-gray-800 font-semibold cursor-not-allowed"
                                    placeholder="자동으로 계산됩니다"
                                />
                            </div>

                            {/* Intensity and Timing */}
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <div className="flex items-center justify-between mb-0.5">
                                        <label className="block text-xs text-gray-400">강도</label>
                                        {hitPointStrength && (
                                            <span className="text-xs text-blue-400">자동 계산됨</span>
                                        )}
                                    </div>
                                    <input
                                        type="text"
                                        value={hitPointStrength}
                                        readOnly
                                        className="w-full px-2 py-1.5 border border-gray-600 rounded text-sm text-center text-gray-200 bg-gray-800 font-semibold cursor-not-allowed"
                                        placeholder="강도"
                                    />
                                </div>
                                <div>
                                    <div className="flex items-center justify-between mb-0.5">
                                        <label className="block text-xs text-gray-400">타수</label>
                                        {hitPointCount && (
                                            <span className="text-xs text-blue-400">자동 계산됨</span>
                                        )}
                                    </div>
                                    <input
                                        type="text"
                                        value={hitPointCount}
                                        readOnly
                                        className="w-full px-2 py-1.5 border border-gray-600 rounded text-sm text-center text-gray-200 bg-gray-800 font-semibold cursor-not-allowed"
                                        placeholder="타수"
                                    />
                                </div>
                            </div>

                            {/* Hammering Type */}
                            <div>
                                <div className="flex items-center justify-between mb-0.5">
                                    <label className="block text-xs text-gray-400">해머링 타입</label>
                                    {hammeringType && (
                                        <span className="text-xs text-blue-400">자동 계산됨</span>
                                    )}
                                </div>
                                <input
                                    type="text"
                                    value={hammeringType}
                                    readOnly
                                    className="w-full px-2 py-1 border border-gray-600 rounded-lg text-sm text-center text-gray-200 bg-gray-800 font-semibold cursor-not-allowed"
                                    placeholder="해머링 타입이 자동으로 계산됩니다"
                                />
                            </div>

                            {/* Save Button */}
                            <button
                                onClick={handleSaveHitPoint}
                                disabled={isSaving}
                                className={`w-full py-2 rounded-lg text-white font-bold text-base shadow-md transition-all mt-2 flex items-center justify-center gap-2 ${saveStatus === 'success'
                                    ? "bg-green-600 hover:bg-green-700"
                                    : saveStatus === 'error'
                                        ? "bg-red-600 hover:bg-red-700"
                                        : "bg-red-600 hover:bg-red-700"
                                    } ${isSaving ? "opacity-70 cursor-wait" : ""}`}
                            >
                                {isSaving ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        저장 중...
                                    </>
                                ) : saveStatus === 'success' ? (
                                    <>
                                        <span>✅</span> 저장 완료!
                                    </>
                                ) : saveStatus === 'error' ? (
                                    <>
                                        <span>⚠️</span> 저장 실패 (재시도)
                                    </>
                                ) : (
                                    "타점 입력"
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Center - 3D Tonefield */}
            <div className="flex-1 relative h-full" style={{ backgroundColor: '#000000' }}>
                <Canvas
                    gl={{ alpha: false }}
                    onCreated={({ gl }) => {
                        gl.setClearColor('#000000', 1);
                    }}
                >
                    <PerspectiveCamera makeDefault position={[2, 2, 2]} fov={50} />
                    <OrbitControls target={[0, 0, 0]} />
                    <CameraController viewMode={cameraView} />

                    <ambientLight intensity={0.4} />
                    <pointLight position={[10, 10, 10]} intensity={1} />
                    <pointLight position={[-10, 5, -10]} intensity={0.5} color="#ff00ff" />

                    {/* Coordinate grid and tuning area */}
                    <CoordinateGrid />

                    {/* Tonefield boundary lines - 초기: 투명도 80% 회색, 타점값에 따라 파란색(내부) 또는 빨간색(외부) */}
                    <TonefieldBoundaries hitPointLocation={hitPointLocation} />

                    {/* Tonefield mesh with 0.6 x 0.85 dimensions */}
                    <ToneFieldMesh tension={tension} wireframe={wireframe} />

                    {/* Hit point marker - only show when coordinates are calculated */}
                    {hitPointCoordinate && hitPointStrength && hitPointCount && hammeringType && (() => {
                        // Parse coordinates from string "(x, y)"
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



                {/* Fixed 2D Overlays - Bottom Center Grid (1x2) */}
                {hitPointCoordinate && (
                    <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex flex-row gap-3 items-center pointer-events-none">
                        {/* Tuning Errors Box - 좌측 */}
                        <div className="bg-black/60 backdrop-blur-md rounded-lg border border-gray-500/50 p-3 text-white shadow-xl w-40">
                            <div className="space-y-1 text-sm font-mono text-right">
                                {/* 5도 (Top) */}
                                <div className={`${tuningTarget === "5도" ? "text-red-400 font-bold" : auxiliaryTarget === "5도" ? "text-red-400/70" : "text-gray-300"}`}>
                                    {tonicError === 0 ? "0" : tonicError > 0 ? `+${tonicError}` : tonicError}
                                </div>
                                {/* 옥타브 (Middle) */}
                                <div className={`${tuningTarget === "옥타브" ? "text-red-400 font-bold" : auxiliaryTarget === "옥타브" ? "text-red-400/70" : "text-gray-300"}`}>
                                    {octaveError === 0 ? "0" : octaveError > 0 ? `+${octaveError}` : octaveError}
                                </div>
                                {/* 토닉 (Bottom) */}
                                <div className={`${tuningTarget === "토닉" ? "text-red-400 font-bold" : auxiliaryTarget === "토닉" ? "text-red-400/70" : "text-gray-300"}`}>
                                    {fifthError === 0 ? "0" : fifthError > 0 ? `+${fifthError}` : fifthError}
                                </div>
                            </div>
                            {targetDisplay && (
                                <div className="mt-2 pt-2 border-t border-white/10 flex justify-end items-center gap-2">
                                    <div className="text-sm font-bold text-yellow-400">{targetDisplay}</div>
                                    {hitPointIntent && (
                                        <div className="text-xs text-cyan-400">{hitPointIntent}</div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Hit Point Info Box - 우측 */}
                        <div className="bg-black/60 backdrop-blur-md rounded-lg border border-gray-500/50 p-3 text-white shadow-xl w-40">
                            <div className="flex flex-col gap-1 text-right">
                                {/* Row 1: Location */}
                                <div className="flex justify-end">
                                    <span className={`font-bold px-1.5 py-0.5 rounded text-xs ${hitPointLocation === "internal" ? "bg-blue-500/30 text-blue-400" : "bg-red-500/30 text-red-400"}`}>
                                        {hitPointLocation === "internal" ? "내부" : "외부"}
                                    </span>
                                </div>
                                {/* Row 2: Coordinates */}
                                <div className="text-xs font-mono text-cyan-400">
                                    {hitPointCoordinate}
                                </div>
                                {/* Row 3: Strength x Count (Type) */}
                                <div className="text-xs">
                                    <span className="font-mono font-bold text-white">{hitPointStrength} × {hitPointCount}</span>
                                    <span className="font-bold text-yellow-400 ml-1">({hammeringType})</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Floating Control Panel - Top Right */}
                <div className="absolute top-6 right-6">
                    {/* Toggle Button */}
                    {!controlsOpen && (
                        <button
                            onClick={() => setControlsOpen(true)}
                            className="w-10 h-10 rounded-full bg-black/80 backdrop-blur-md border border-white/10 text-white flex items-center justify-center hover:bg-black/90 transition-colors shadow-lg"
                            title="Open Controls"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                            </svg>
                        </button>
                    )}

                    {/* Controls Panel */}
                    {controlsOpen && (
                        <div className="w-64 p-4 bg-black/80 backdrop-blur-md rounded-xl border border-white/10 text-white shadow-2xl">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-lg font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                                    Controls
                                </h3>
                                <button
                                    onClick={() => setControlsOpen(false)}
                                    className="text-gray-400 hover:text-white transition-colors"
                                    title="Close Controls"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            <div className="space-y-4">
                                {/* Camera View Toggle */}
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-gray-300">Camera View</span>
                                    <button
                                        onClick={() => setCameraView(cameraView === 'perspective' ? 'top' : 'perspective')}
                                        className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 transition-all flex items-center justify-center shadow-lg hover:shadow-xl"
                                        title={cameraView === 'perspective' ? 'Switch to Top View' : 'Switch to Perspective View'}
                                    >
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            className="h-4 w-4 text-white"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                        >
                                            {cameraView === 'perspective' ? (
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                                            ) : (
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                                            )}
                                        </svg>
                                    </button>
                                </div>

                                {/* Tension Slider */}
                                <div className="space-y-1">
                                    <div className="flex justify-between text-xs text-gray-300">
                                        <span>Tension</span>
                                        <span className="font-mono text-cyan-300">{tension.toFixed(2)}</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.01"
                                        value={tension}
                                        onChange={(e) => setTension(parseFloat(e.target.value))}
                                        className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                                    />
                                </div>

                                {/* Wireframe Toggle */}
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-gray-300">Wireframe</span>
                                    <button
                                        onClick={() => setWireframe(!wireframe)}
                                        className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${wireframe
                                            ? "bg-cyan-500 text-black"
                                            : "bg-gray-700 text-gray-400 hover:bg-gray-600"
                                            }`}
                                    >
                                        {wireframe ? "ON" : "OFF"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Right Panel - Recent Hit Points */}
            <div className="relative flex-shrink-0" style={{ width: isClient ? rightPanelWidth : `${panelWidth}px` }}>
                <div className="bg-gray-900 p-6 rounded-lg shadow-lg transition-colors overflow-y-auto h-full">
                    <h2 className="text-2xl font-semibold mb-4 text-gray-100 flex items-center gap-2 flex-wrap">
                        최근 타점
                        <span className="text-sm font-normal px-2 py-1 rounded-full bg-gray-700 text-gray-300">
                            {recentHitPoints.length}
                        </span>
                    </h2>
                    <p className="text-sm text-gray-400 mb-4">
                        저장된 타점을 클릭하여 좌표계에 표시
                    </p>
                    <div ref={cardsContainerRef} className="space-y-3 max-h-[800px] overflow-y-auto">
                        {isLoadingHitPoints ? (
                            // Loading Skeletons
                            Array.from({ length: 5 }).map((_, i) => (
                                <div
                                    key={i}
                                    className="p-3 border-2 border-gray-700 rounded-lg bg-gray-800 animate-pulse"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="h-6 w-12 bg-gray-700 rounded"></div>
                                        <div className="h-8 w-8 bg-gray-700 rounded"></div>
                                        <div className="flex-1 h-6 bg-gray-700 rounded"></div>
                                        <div className="h-8 w-16 bg-gray-700 rounded"></div>
                                    </div>
                                </div>
                            ))
                        ) : recentHitPoints.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                                저장된 타점 데이터가 없습니다
                            </div>
                        ) : (
                            recentHitPoints.map((hitPoint) => {
                                const isExpanded = expandedCards.has(hitPoint.id!);
                                const isSelected = selectedHitPoint?.id === hitPoint.id;
                                return (
                                    <div
                                        key={hitPoint.id}
                                        onClick={() => handleHitPointCardClick(hitPoint)}
                                        className={`p-3 border-2 rounded-lg cursor-pointer transition-all ${isSelected
                                            ? "border-blue-500 bg-blue-900/20"
                                            : "border-gray-700 hover:border-blue-600 bg-gray-800"
                                            }`}
                                    >
                                        {isExpanded ? (
                                            // Expanded State: Responsive Grid
                                            <>
                                                <div className="grid grid-cols-3 items-stretch text-sm gap-4">
                                                    {/* Left: Tuning Errors */}
                                                    <div className="flex flex-col justify-center gap-3 border-r border-gray-700 pr-4 bg-gray-800/50 min-w-0">
                                                        {/* Fifth */}
                                                        <div className={`flex justify-between items-center ${hitPoint.primary_target === "fifth" || hitPoint.auxiliary_target === "fifth" ? "" : "opacity-40"} whitespace-nowrap`}>
                                                            <div className="flex items-center gap-1.5">
                                                                <span className={`text-xs ${hitPoint.primary_target === "fifth" || hitPoint.auxiliary_target === "fifth" ? "text-red-400 font-semibold" : "text-gray-500"}`}>5도</span>
                                                            </div>
                                                            <span className={`font-mono text-sm ${hitPoint.primary_target === "fifth" ? "text-red-400 font-bold" : hitPoint.auxiliary_target === "fifth" ? "text-orange-400 font-medium" : "text-gray-500"}`}>{hitPoint.fifth > 0 ? `+${Number(hitPoint.fifth).toFixed(1)}` : Number(hitPoint.fifth).toFixed(1)}Hz</span>
                                                        </div>
                                                        {/* Octave */}
                                                        <div className={`flex justify-between items-center ${hitPoint.primary_target === "octave" || hitPoint.auxiliary_target === "octave" ? "" : "opacity-40"} whitespace-nowrap`}>
                                                            <div className="flex items-center gap-1.5">
                                                                <span className={`text-xs ${hitPoint.primary_target === "octave" || hitPoint.auxiliary_target === "octave" ? "text-red-400 font-semibold" : "text-gray-500"}`}>옥타브</span>
                                                            </div>
                                                            <span className={`font-mono text-sm ${hitPoint.primary_target === "octave" ? "text-red-400 font-bold" : hitPoint.auxiliary_target === "octave" ? "text-orange-400 font-medium" : "text-gray-500"}`}>{hitPoint.octave > 0 ? `+${Number(hitPoint.octave).toFixed(1)}` : Number(hitPoint.octave).toFixed(1)}Hz</span>
                                                        </div>
                                                        {/* Tonic */}
                                                        <div className={`flex justify-between items-center ${hitPoint.primary_target === "tonic" || hitPoint.auxiliary_target === "tonic" ? "" : "opacity-40"} whitespace-nowrap`}>
                                                            <div className="flex items-center gap-1.5">
                                                                <span className={`text-xs font-bold ${hitPoint.primary_target === "tonic" || hitPoint.auxiliary_target === "tonic" ? "text-red-400" : "text-gray-500"}`}>토닉</span>
                                                            </div>
                                                            <span className={`font-mono ${hitPoint.primary_target === "tonic" ? "text-red-400 font-bold text-base" : hitPoint.auxiliary_target === "tonic" ? "text-orange-400 font-medium text-base" : "text-gray-500 text-sm"}`}>{hitPoint.tonic > 0 ? `+${Number(hitPoint.tonic).toFixed(1)}` : Number(hitPoint.tonic).toFixed(1)}Hz</span>
                                                        </div>
                                                    </div>
                                                    {/* Center: Diagnosis */}
                                                    <div className="flex flex-col justify-center items-center gap-4 border-r border-gray-700 px-4 bg-gray-800/30 min-w-0">
                                                        <div className="text-center">
                                                            <div className="text-[10px] text-gray-400 mb-1.5 uppercase tracking-wide">최적 조율 대상</div>
                                                            <div className="text-xl font-bold text-gray-100 tracking-tight whitespace-nowrap">
                                                                {hitPoint.target_display}
                                                            </div>
                                                        </div>
                                                        <div className={`flex items-center justify-center rounded-full px-4 py-1.5 border ${hitPoint.intent === "상향" ? "bg-gray-800/80 border-red-500/30" : "bg-gray-800/80 border-blue-500/30"}`}>
                                                            <span className={`font-bold text-base tracking-wide ${hitPoint.intent === "상향" ? "text-red-400" : "text-blue-400"}`}>
                                                                {hitPoint.intent}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    {/* Right: Instructions */}
                                                    <div className="flex flex-col justify-center gap-2 pl-4 bg-gray-800/50 min-w-0">
                                                        <div className={`flex justify-between items-center rounded px-3 py-2 border ${hitPoint.location === "internal" ? "bg-blue-900/20 border-blue-700/50" : "bg-red-900/20 border-red-700/50"}`}>
                                                            <span className="text-xs text-gray-400">타격 위치</span>
                                                            <span className={`font-bold text-sm ${hitPoint.location === "internal" ? "text-blue-300" : "text-red-300"}`}>
                                                                {hitPoint.location === "internal" ? "내부" : "외부"}
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-center items-center bg-gray-800/50 rounded px-2.5 py-1.5 border border-gray-700 overflow-hidden min-w-0">
                                                            <span className="text-gray-500 text-[10px] mr-1 flex-shrink-0">⌖</span>
                                                            <span className="text-sm font-bold font-mono text-gray-200 tracking-tight whitespace-nowrap flex-shrink-0">
                                                                {hitPoint.coordinate_x.toFixed(3)}, {hitPoint.coordinate_y.toFixed(3)}
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-center items-center bg-gray-800/60 border border-gray-700 rounded px-3 py-2">
                                                            <span className="font-bold text-sm text-gray-100 tracking-wide whitespace-nowrap">
                                                                {hitPoint.strength > 0 ? `+${hitPoint.strength}` : hitPoint.strength} × {hitPoint.hit_count}
                                                            </span>
                                                        </div>
                                                        {hitPoint.hammering_type && (
                                                            <div className="flex justify-center items-center bg-gray-800/50 border-2 border-gray-700 rounded px-3 py-2 whitespace-nowrap">
                                                                <span className="font-bold text-sm text-gray-300 tracking-wide">
                                                                    {hammeringTypeMap[hitPoint.hammering_type as string] || hitPoint.hammering_type}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </>
                                        ) : (
                                            // Collapsed State
                                            <div className="flex items-center gap-3 text-base">
                                                <div className="text-gray-100 font-semibold">
                                                    {hitPoint.target_display}
                                                </div>
                                                <div className="text-gray-300">
                                                    {hitPoint.intent}
                                                </div>
                                                <div className="text-gray-300">
                                                    {hitPoint.location === "external" ? "외부" : "내부"}
                                                </div>
                                                <div className="text-gray-300">
                                                    {hitPoint.strength >= 0 ? '+' : ''}{hitPoint.strength} × {hitPoint.hit_count}
                                                    {hitPoint.hammering_type && (
                                                        <span className="ml-1.5 text-xs font-medium text-gray-400">
                                                            ({hammeringTypeMap[hitPoint.hammering_type as string] || hitPoint.hammering_type})
                                                        </span>
                                                    )}
                                                </div>
                                                <button
                                                    onClick={(e) => handleDeleteHitPoint(e, hitPoint.id!)}
                                                    className="ml-auto px-3 py-1 text-sm font-medium text-red-400/50 hover:text-white hover:bg-red-600 rounded transition-colors border border-red-600/30 opacity-30 hover:opacity-100"
                                                    title="삭제"
                                                >
                                                    삭제
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
                {/* Drag Handle */}
                <div
                    onMouseDown={handleResizeMouseDown}
                    className="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize bg-transparent hover:bg-gray-600"
                    style={{ zIndex: 10 }}
                ></div>
            </div >
        </div>
    );
}


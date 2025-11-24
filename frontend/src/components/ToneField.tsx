"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, Text, Html } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { supabase } from "@/lib/supabase";
import Spaceship from "@/components/metaverse/objects/Spaceship";

import { Player } from "@/components/metaverse/objects/Player";
import { SndStoreScene } from "@/components/metaverse/scenes/SndStoreScene";
import { FerryBoatScene } from "@/components/metaverse/scenes/FerryBoatScene";
import { FerryBoat, Sun, FirstPersonCamera } from "@/components/metaverse/scenes/FerryBoatScene";

// 카메라 프리셋 타입 정의
type CameraPreset = 'top' | 'perspective' | 'front' | 'side' | 'isometric' | 'close';

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

// Helper function to get color based on error value
// Returns both color and brightness intensity
function getErrorColor(errorValue: number): { color: THREE.Color, brightness: number } {
    const absError = Math.abs(errorValue);
    const color = new THREE.Color();

    // Base Colors
    const safeColor = new THREE.Color(0, 1, 0); // Green for perfect zone
    const isPositive = errorValue > 0;
    const errorBaseColor = isPositive ? new THREE.Color(1, 0, 0) : new THREE.Color(0, 0, 1); // Red (+) or Blue (-)

    // 1. Perfect Zone (0 ~ 1 Hz): bright green
    if (absError <= 1.0) {
        return { color: safeColor, brightness: 1.0 };
    }

    // 2. Warning Zone (1 ~ 5 Hz)
    if (absError <= 5.0) {
        const t = (absError - 1.0) / 4.0; // 0.0 ~ 1.0 across the zone
        if (isPositive) {
            // Positive: mix green with red, keep full brightness
            const greenComp = 1.0 - (0.4 * t); // 1.0 -> 0.6
            const redComp = 0.4 * t; // 0.0 -> 0.4
            color.copy(safeColor).multiplyScalar(greenComp).add(errorBaseColor.clone().multiplyScalar(redComp));
            return { color: color, brightness: 1.0 };
        } else {
            // Negative: pure blue, decreasing brightness
            const brightness = 1.0 - (0.3 * t); // 1.0 -> 0.7 as error grows
            color.copy(errorBaseColor);
            return { color: color, brightness: brightness };
        }
    }

    // 3. Tension Zone (5 ~ 30 Hz): pure error color with brightness scaling
    const maxError = 30.0;
    const clampedError = Math.min(absError, maxError);
    const t = (clampedError - 5.0) / (maxError - 5.0); // 0.0 ~ 1.0
    let brightness: number;
    if (isPositive) {
        // Positive: increase brightness from 0.7 to 1.0
        brightness = 0.7 + (0.3 * t);
    } else {
        // Negative: decrease brightness from 0.7 to 0.3
        brightness = 0.7 - (0.4 * t);
    }
    color.copy(errorBaseColor);
    return { color: color, brightness: brightness };
}

function ToneFieldMesh({
    tension,
    wireframe,
    meshRef,
    tuningErrors,
    hitPointLocation,
    hitPointCoordinate
}: {
    tension: number;
    wireframe: boolean;
    meshRef: React.RefObject<THREE.Mesh | null>;
    tuningErrors?: {
        tonic: number;
        octave: number;
        fifth: number;
    };
    hitPointLocation?: "internal" | "external" | null;
    hitPointCoordinate?: string;
}) {

    // Parameters for the ellipse
    const geometry = useMemo(() => {
        // Create ellipse with 0.6 (X-axis) x 0.85 (Z-axis) dimensions
        // This creates the tonefield with the longer axis along Z
        return createTonefieldGeometry(0.6, 0.85, 64, 32);
    }, []);

    // 원본 z 값 저장 (딤플 반전을 위해)
    const originalZValues = useRef<Float32Array | null>(null);

    useEffect(() => {
        if (!meshRef.current) return;
        const geo = meshRef.current.geometry;
        const posAttr = geo.attributes.position;
        const colorAttr = geo.attributes.color;
        const count = posAttr.count;
        const color = new THREE.Color();

        // 원본 z 값 저장 (최초 1회만)
        if (!originalZValues.current) {
            originalZValues.current = new Float32Array(count);
            for (let i = 0; i < count; i++) {
                originalZValues.current[i] = posAttr.getZ(i);
            }
        }

        // 외부 타점일 때 딤플 방향 반전 (z 값 반전)
        const invertDimple = hitPointLocation === "external";

        // 원본 z 값에서 복원하거나 반전
        if (originalZValues.current) {
            for (let i = 0; i < count; i++) {
                const originalZ = originalZValues.current[i];
                const z = invertDimple ? -originalZ : originalZ;
                posAttr.setZ(i, z);
            }
        }

        // 메쉬 크기 정보
        const geometryWidth = 0.6;
        const geometryHeight = 0.85;

        // 🔍 디버깅: tuningErrors 값 로그
        console.log('🎨 ToneFieldMesh - tuningErrors:', tuningErrors);

        // 타점 좌표 파싱 (Directional Weighting용)
        let targetX = 0;
        let targetY = 0;
        let hasTarget = false;

        if (hitPointCoordinate) {
            const match = hitPointCoordinate.match(/\(([^,]+),\s*([^)]+)\)/);
            if (match) {
                targetX = parseFloat(match[1]);
                targetY = parseFloat(match[2]);
                hasTarget = true;
            }
        }

        // 🔍 디버깅: 타점 좌표 확인
        console.log('🎨 ToneFieldMesh - hitPointCoordinate:', hitPointCoordinate);
        console.log('🎨 ToneFieldMesh - Parsed Target:', { hasTarget, targetX, targetY });

        // 타점 벡터의 각도 (Target Angle)
        const targetAngle = hasTarget ? Math.atan2(targetY, targetX) : 0;

        for (let i = 0; i < count; i++) {
            const x = posAttr.getX(i);
            const y = posAttr.getY(i); // Y축이 평면상 세로축
            const z = posAttr.getZ(i); // Z축이 실제 높이값 (딤플, 이미 반전됨)

            // 정규화된 거리 계산 (딤플 영역 판별용)
            // ToneField.tsx에서는 XY 평면이므로 x, y 사용
            const r = Math.sqrt(Math.pow(x / (geometryWidth / 2), 2) + Math.pow(y / (geometryHeight / 2), 2));

            // A. 딤플 영역 (중심부): 매우 어두운 회색
            if (r < 0.35) {
                // 딤플은 매우 어두운 회색 (0.05 ~ 0.15 범위)
                const brightness = 0.05 + 0.1 * THREE.MathUtils.clamp(Math.abs(z) * 10, 0, 1);
                color.setRGB(brightness, brightness, brightness);
                colorAttr.setXYZ(i, color.r, color.g, color.b);
                continue;
            }

            // B. 도넛 영역 (장력 시각화): 타점 적응형 각도 확산 (Target-Adaptive Angular Spread)
            // ToneField.tsx 좌표계: y > 0 = 위쪽 (Octave), y < 0 = 아래쪽 (Tonic), x = 좌우 (Fifth)

            // 1. 타원형 비율 보정 (Elliptical Aspect Ratio Compensation)
            // 타원형(0.6 x 0.85)이므로, 각 축의 길이에 맞춰 정규화된 좌표로 각도를 계산해야 함
            // 이렇게 해야 5도(짧은 축) 영역이 옥타브(긴 축) 영역과 시각적으로 동등한 비율(%)을 차지하게 됨
            const normX = x / (geometryWidth / 2);  // x / 0.3
            const normY = y / (geometryHeight / 2); // y / 0.425
            const angle = Math.atan2(normY, normX);

            // Helper: 각도 차이 계산 함수
            const getAngleDiff = (a1: number, a2: number) => {
                let diff = Math.abs(a1 - a2);
                if (diff > Math.PI) diff = 2 * Math.PI - diff;
                return diff;
            };

            // 2. 각 영역의 중심축 각도 (Fixed Axes - Physically Correct)
            // 악기의 물리적 구조에 따라 축은 고정됨 (12시, 6시, 3시, 9시)
            const axisOctave = Math.PI / 2;   // 12시
            const axisTonic = -Math.PI / 2;   // 6시
            const axisFifthR = 0;             // 3시
            const axisFifthL = Math.PI;       // 9시

            // 3. 확산 계수 (Spread Factor) 계산
            // [Asymmetric Tension] 비대칭 장력 시각화
            // 양수(+): 과장력 -> 좁고(Focus) 날카로움
            // 음수(-): 저장력 -> 넓고(Wide) 부드러움 (1.5배 더 퍼짐)
            const errorSensitivity = 0.15;

            const getErrorSpread = (error: number) => {
                const absError = Math.abs(error);
                let spread = 1.0 / (1.0 + absError * errorSensitivity);

                // 음수 오차일 경우 Spread를 1.5배 넓힘 (헐렁함 표현)
                if (error < 0) {
                    spread *= 1.5;
                }

                // [Minimum Width Clamp] 최소 0.6 보장
                return Math.max(0.6, spread);
            };

            const spreadOctave = tuningErrors ? getErrorSpread(tuningErrors.octave) : 1.0;
            const spreadTonic = tuningErrors ? getErrorSpread(tuningErrors.tonic) : 1.0;
            const spreadFifth = tuningErrors ? getErrorSpread(tuningErrors.fifth) : 1.0;

            // [Error-Based Compression] 오차 기반 압축 (Sharpening)
            // 양수(+): Power를 높여서 경계면을 칼같이 만듦 (Hard Edge)
            // 음수(-): Power를 낮춰서 경계면을 부드럽게 만듦 (Soft Edge)
            const getSharpenFactor = (error: number) => {
                const absError = Math.abs(error);

                if (error >= 0) {
                    // Positive: High Sharpening (Pinpoint)
                    // 기본 1.0 + 오차 * 0.8 (강하게)
                    return 1.0 + (absError * 0.8);
                } else {
                    // Negative: Low Sharpening (Blurry)
                    // 기본 1.0 + 오차 * 0.2 (약하게)
                    return 1.0 + (absError * 0.2);
                }
            };

            const sharpOctave = tuningErrors ? getSharpenFactor(tuningErrors.octave) : 1.0;
            const sharpTonic = tuningErrors ? getSharpenFactor(tuningErrors.tonic) : 1.0;
            const sharpFifth = tuningErrors ? getSharpenFactor(tuningErrors.fifth) : 1.0;

            // 4. 각도 기반 가중치 계산 (Angular Falloff)
            // 중심축에서 멀어질수록 가중치가 줄어듦 (Cosine 유사 형태)

            const getAngularWeight = (currentAngle: number, axisAngle: number, spread: number, sharpen: number) => {
                let diff = Math.abs(currentAngle - axisAngle);
                if (diff > Math.PI) diff = 2 * Math.PI - diff;

                // 유효 각도 범위 설정 (기본 40도 * Spread)
                const maxAngle = (Math.PI / 4.5) * spread;

                if (diff > maxAngle) return 0;

                // 0(중심) -> 1.0, maxAngle(끝) -> 0.0 으로 부드럽게 감소
                const baseWeight = Math.cos((diff / maxAngle) * (Math.PI / 2));

                // [Sharpening] 오차가 클수록 가중치를 제곱하여 더 급격하게 떨어뜨림
                return Math.pow(baseWeight, sharpen);
            };

            let wOctave = getAngularWeight(angle, axisOctave, spreadOctave, sharpOctave);
            let wTonic = getAngularWeight(angle, axisTonic, spreadTonic, sharpTonic);
            // 5도는 좌우 양쪽 축 모두 고려
            let wFifth = Math.max(
                getAngularWeight(angle, axisFifthR, spreadFifth, sharpFifth),
                getAngularWeight(angle, axisFifthL, spreadFifth, sharpFifth)
            );

            // [Anti-Bleed] 침범 방지 (Dominance Logic)
            // 상/하단(Octave/Tonic)이 강하면 측면(Fifth)의 영향력을 줄임
            // 얼룩말 무늬 방지하되, 5도 영역이 아예 사라지지 않도록 완화
            const dominance = Math.max(wOctave, wTonic);
            if (dominance > 0.7) { // 임계값을 0.5 -> 0.7로 높임 (더 관대하게)
                // dominance가 0.7 ~ 1.0일 때 wFifth를 줄임
                wFifth *= (1.0 - dominance) * 3.0; // 감쇠 강도 조절
                wFifth = Math.max(0, wFifth);
            }

            // [Normalize Weights] 가중치 정규화 (빈 공간 채우기)
            // 합이 1.0이 되도록 조정하여 검은 구멍(Gap) 제거
            let totalW = wOctave + wTonic + wFifth;

            if (totalW > 0.001) {
                wOctave /= totalW;
                wTonic /= totalW;
                wFifth /= totalW;
                totalW = 1.0; // 정규화 후 totalW는 1.0으로 간주
            }

            // 안전장치: 가중치 합이 0이면(Gap 발생 시), 가장 가까운 영역의 색상을 사용 (Nearest Neighbor)
            // 이를 통해 검은색 구멍이 생기는 것을 방지하고 항상 유효한 오차 색상을 보여줌
            if (totalW <= 0.001) {
                // 각 영역까지의 거리 계산
                const dOctave = getAngleDiff(angle, axisOctave);
                const dTonic = getAngleDiff(angle, axisTonic);
                const dFifth = Math.min(getAngleDiff(angle, axisFifthR), getAngleDiff(angle, axisFifthL));

                let fallbackError = 0;
                if (dOctave <= dTonic && dOctave <= dFifth) {
                    fallbackError = tuningErrors ? tuningErrors.octave : 0;
                } else if (dTonic <= dOctave && dTonic <= dFifth) {
                    fallbackError = tuningErrors ? tuningErrors.tonic : 0;
                } else {
                    fallbackError = tuningErrors ? tuningErrors.fifth : 0;
                }

                const { color: fbColor, brightness: fbBrightness } = getErrorColor(fallbackError);

                // 스포트라이트 적용 (원형 강조 효과)
                let finalBrightness = fbBrightness;
                if (hasTarget) {
                    // 타점에서의 거리 계산 (순수 원형 거리)
                    const dx = x - targetX;
                    const dy = y - targetY;
                    const distance = Math.sqrt(dx * dx + dy * dy);

                    // 최대 영향 범위
                    const maxDistance = 0.4;

                    // 거리에 따른 밝기 감쇠 (0~1 범위로 정규화)
                    const normalizedDist = Math.min(distance / maxDistance, 1.0);

                    // 더 강한 그라디언트 (지수 높여서 중심부 더 강조)
                    const gradientFactor = 1.0 - Math.pow(normalizedDist, 2.0);

                    // 밝기 조절: 타점 근처는 더 밝게(1.6배), 멀어질수록 원래 밝기로
                    const spotlightBrightness = 1.6;
                    finalBrightness = fbBrightness * (1.0 + (spotlightBrightness - 1.0) * gradientFactor);
                }

                color.copy(fbColor).multiplyScalar(finalBrightness);
                colorAttr.setXYZ(i, color.r, color.g, color.b);
                continue;
            }

            // 1. 오차 값(Value) 자체를 먼저 믹싱
            let mixedError = 0;
            if (tuningErrors) {
                mixedError = (tuningErrors.octave * wOctave +
                    tuningErrors.tonic * wTonic +
                    tuningErrors.fifth * wFifth) / totalW;
            }

            // 2. 섞인 최종 값을 색상으로 변환
            // (+값과 -값이 만나서 0에 가까워지면 자동으로 초록색이 됨)
            const { color: baseColor, brightness } = getErrorColor(mixedError);

            // 3. 스포트라이트 효과 적용 (원형 강조 효과)
            // 타점 좌표 중심으로 원형으로 밝게 강조, 멀어질수록 그라디언트로 어둡게
            let finalBrightness = brightness;

            if (hasTarget) {
                // 타점에서의 거리 계산 (순수 원형 거리)
                const dx = x - targetX;
                const dy = y - targetY;
                const distance = Math.sqrt(dx * dx + dy * dy);

                // 최대 영향 범위
                const maxDistance = 0.4;

                // 거리에 따른 밝기 감쇠 (0~1 범위로 정규화)
                const normalizedDist = Math.min(distance / maxDistance, 1.0);

                // 더 강한 그라디언트 (지수 높여서 중심부 더 강조)
                const gradientFactor = 1.0 - Math.pow(normalizedDist, 2.0);

                // 밝기 조절: 타점 근처는 더 밝게(1.6배), 멀어질수록 원래 밝기로
                const spotlightBrightness = 1.6;
                finalBrightness = brightness * (1.0 + (spotlightBrightness - 1.0) * gradientFactor);
            }

            // 밝기 적용 (색상 * 최종 밝기)
            color.copy(baseColor).multiplyScalar(finalBrightness);

            colorAttr.setXYZ(i, color.r, color.g, color.b);

            // 🔍 디버깅: 일부 버텍스 색상 샘플링
            if (i % 200 === 0) {
                console.log(`  버텍스 ${i}: MixedError:${mixedError.toFixed(2)}Hz Brightness:${finalBrightness.toFixed(2)}`);
            }
        }

        console.log('🎨 ===== 색상 계산 완료 =====');

        colorAttr.needsUpdate = true;
        posAttr.needsUpdate = true;

        // 노말 재계산 (z 값이 변경되었으므로)
        geo.computeVertexNormals();
    }, [geometry, tuningErrors, meshRef, hitPointLocation, hitPointCoordinate]);  // hitPointCoordinate 추가

    useFrame((state) => {
        if (!meshRef.current) return;
        // Optional: Subtle breathing animation
        // meshRef.current.scale.setScalar(1 + 0.005 * Math.sin(state.clock.elapsedTime));
    });

    return (
        <mesh ref={meshRef} geometry={geometry}>
            <meshBasicMaterial
                vertexColors={true}  // 항상 vertexColors 사용
                wireframe={wireframe}
                side={THREE.DoubleSide}
                color={wireframe ? undefined : undefined}  // color 속성 제거하여 vertexColors만 사용
                transparent={false}
                opacity={1}
            />
        </mesh>
    );
}

// Double click handler component
function DoubleClickHandler({
    onDoubleClick,
    meshRef
}: {
    onDoubleClick: (x: number, y: number) => void;
    meshRef: React.RefObject<THREE.Mesh | null>;
}) {
    const { camera, raycaster, scene, gl } = useThree();
    const [mouse] = useState(() => new THREE.Vector2());

    useEffect(() => {
        const handleDoubleClick = (event: MouseEvent) => {
            // Prevent default behavior
            event.preventDefault();
            event.stopPropagation();

            // Get canvas element
            const canvas = gl.domElement;
            const rect = canvas.getBoundingClientRect();

            // Calculate normalized device coordinates (-1 to +1)
            mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

            // Update raycaster
            raycaster.setFromCamera(mouse, camera);

            // Check intersection with tonefield mesh
            if (meshRef.current) {
                const intersects = raycaster.intersectObject(meshRef.current);

                if (intersects.length > 0) {
                    const point = intersects[0].point;
                    const x = point.x;
                    const y = point.y;

                    // Check if point is within ellipse boundary
                    // Ellipse: (x/0.3)^2 + (y/0.425)^2 <= 1
                    const radiusX = 0.3;
                    const radiusY = 0.425;
                    const ellipseValue = (x * x) / (radiusX * radiusX) + (y * y) / (radiusY * radiusY);

                    if (ellipseValue <= 1.0) {
                        // Point is within tonefield boundary
                        onDoubleClick(x, y);
                    }
                }
            }
        };

        const canvas = gl.domElement;
        canvas.addEventListener('dblclick', handleDoubleClick);

        return () => {
            canvas.removeEventListener('dblclick', handleDoubleClick);
        };
    }, [camera, raycaster, scene, gl, mouse, meshRef, onDoubleClick]);

    return null;
}

// Component for tonefield boundary lines
function TonefieldBoundaries({ hitPointLocation }: { hitPointLocation: "internal" | "external" | null }) {
    // 모든 경우에 투명도 80% 흰색 사용
    const color = 0xffffff; // White
    const opacity = 0.8;

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



// Component for location text in dimple center
function LocationText({ hitPointLocation }: { hitPointLocation: "internal" | "external" | null }) {
    if (!hitPointLocation) return null;

    // 딤플 중앙 위치 (정확히 0, 0, z 위치)
    // 외부일 때는 딤플이 반전되므로 z 위치도 조정
    // 딤플 높이는 약 0.04이므로, 메쉬 위로 약간 띄움
    const dimpleCenterZ = hitPointLocation === "external" ? -0.05 : 0.05;

    return (
        <Html
            position={[0, 0, dimpleCenterZ]}
            center
            zIndexRange={[100, 0]}
            style={{
                pointerEvents: 'none',
                whiteSpace: 'nowrap',
                userSelect: 'none'
            }}
        >
            <div className="text-gray-400/40 text-2xl font-bold drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                {hitPointLocation === "internal" ? "In" : "Out"}
            </div>
        </Html>
    );
}

// Component for animated ring around hit point
function AnimatedRing({ position, color }: { position: [number, number, number]; color: string }) {
    const innerRingRef = useRef<THREE.Mesh>(null);
    const outerRingRef = useRef<THREE.Mesh>(null);

    useFrame((state) => {
        const time = state.clock.elapsedTime;

        // Inner ring animation
        if (innerRingRef.current) {
            const innerScale = 1 + 0.4 * Math.sin(time * 4);
            innerRingRef.current.scale.setScalar(innerScale);
            innerRingRef.current.rotation.z = time * 3;
            const innerMaterial = innerRingRef.current.material as THREE.MeshBasicMaterial;
            innerMaterial.opacity = 0.8 + 0.2 * Math.sin(time * 4);
        }

        // Outer ring animation (반대 위상으로 펄싱)
        if (outerRingRef.current) {
            const outerScale = 1 + 0.3 * Math.sin(time * 4 + Math.PI);
            outerRingRef.current.scale.setScalar(outerScale);
            outerRingRef.current.rotation.z = -time * 2;
            const outerMaterial = outerRingRef.current.material as THREE.MeshBasicMaterial;
            outerMaterial.opacity = 0.6 + 0.4 * Math.sin(time * 4 + Math.PI);
        }
    });

    return (
        <group position={position}>
            {/* Inner ring - 30파이 쇠망치 크기에 맞춤 */}
            <mesh ref={innerRingRef}>
                <ringGeometry args={[0.03, 0.045, 32]} />
                <meshBasicMaterial
                    color={color}
                    transparent
                    opacity={1.0}
                    side={THREE.DoubleSide}
                />
            </mesh>
            {/* Outer ring - 30파이 쇠망치 크기에 맞춤 */}
            <mesh ref={outerRingRef}>
                <ringGeometry args={[0.055, 0.07, 32]} />
                <meshBasicMaterial
                    color={color}
                    transparent
                    opacity={1.0}
                    side={THREE.DoubleSide}
                />
            </mesh>
        </group>
    );
}

// Component for hit point marker visualization
function HitPointMarker({
    x,
    y,
    strength,
    count,
    hammeringType,
    intent,
    location,
    isUIVisible
}: {
    x: number;
    y: number;
    strength?: string;
    count?: string;
    hammeringType?: string;
    intent?: string;
    location?: "internal" | "external" | null;
    isUIVisible?: boolean;
}) {
    // Convert 2D tonefield coordinates to 3D world coordinates
    // x maps to X-axis, y maps to Y-axis (XY plane)
    const worldX = x;
    const worldY = y;
    const worldZ = 0.002; // Slightly above the tonefield surface

    // Check if we have full information to show label
    const hasFullInfo = strength && count && hammeringType;

    // 의도에 따른 색상 설정
    // -30 오차 색상과 동일한 진한 색상 사용
    // 상향 → 순수 빨간색 (#FF0000), 하향 → 순수 파란색 (#0000FF)
    const markerColor = intent === "상향" ? "#FF0000" : intent === "하향" ? "#0000FF" : "#FF0066";
    // 외부에서 하향 타격일 때 고리는 빨간색, 그 외에는 intent에 따라 결정
    const ringColor = (location === "external" && intent === "하향")
        ? "#FF0000"
        : intent === "상향"
            ? "#FF0000"
            : intent === "하향"
                ? "#0000FF"
                : "#00FFFF";

    return (
        <group>
            {/* Hit point marker - 30파이 쇠망치 크기 (타원형) */}
            <mesh position={[worldX, worldY, worldZ]} scale={[1.0, 1.0, 0.3]}>
                <sphereGeometry args={[0.025, 16, 16]} />
                <meshStandardMaterial color={markerColor} emissive={markerColor} emissiveIntensity={1.0} />
            </mesh>

            {/* Animated ring around hit point */}
            <AnimatedRing position={[worldX, worldY, worldZ]} color={ringColor} />

            {/* Info label using HTML overlay - only show if we have full info and UI is visible */}
            {hasFullInfo && isUIVisible && (
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
            )}
        </group>
    );
}

// Component for coordinate grid and tuning area in 3D space
function CoordinateGrid({ isUIVisible }: { isUIVisible?: boolean }) {
    return (
        <group>
            {/* Coordinate plane at z=0 (XY plane) */}
            {/* gridHelper is by default in XZ plane, rotate 90deg around X-axis to make it XY plane */}
            {isUIVisible && (
                <gridHelper
                    args={[2, 8, '#666666', '#333333']}
                    position={[0, 0, 0]}
                    rotation={[Math.PI / 2, 0, 0]}
                />
            )}

            {/* Tuning Box - 정사각형 외곽선과 축 레이블을 그룹화 */}
            {isUIVisible && (
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
                        fillOpacity={0.3}
                        anchorX="center"
                        anchorY="middle"
                    >
                        -1
                    </Text>
                    <Text
                        position={[0, -0.6, 0.02]}
                        fontSize={0.04}
                        color="#808080"
                        fillOpacity={0.3}
                        anchorX="center"
                        anchorY="middle"
                    >
                        0
                    </Text>
                    <Text
                        position={[0.5, -0.6, 0.02]}
                        fontSize={0.04}
                        color="#808080"
                        fillOpacity={0.3}
                        anchorX="center"
                        anchorY="middle"
                    >
                        1
                    </Text>

                    {/* 하단 꼭지점 - 토닉 (T) - 톤필드 하단 꼭지점 바로 아래 (간격: 0.04) */}
                    {isUIVisible && (
                        <Text
                            position={[0, -0.465, 0.02]}
                            fontSize={0.05}
                            color="#CCCCCC"
                            fillOpacity={0.8}
                            anchorX="center"
                            anchorY="middle"
                        >
                            T
                        </Text>
                    )}

                    {/* 상단 꼭지점 - 옥타브 (O) - 톤필드 상단 꼭지점 바로 위 (간격: 0.04) */}
                    {isUIVisible && (
                        <Text
                            position={[0, 0.465, 0.02]}
                            fontSize={0.05}
                            color="#CCCCCC"
                            fillOpacity={0.8}
                            anchorX="center"
                            anchorY="middle"
                        >
                            O
                        </Text>
                    )}

                    {/* 3시 방향 - RF (Right Fifth) - 톤필드 우측 꼭지점 바로 우측 (간격: 0.04) */}
                    {isUIVisible && (
                        <Text
                            position={[0.34, 0, 0.02]}
                            fontSize={0.05}
                            color="#CCCCCC"
                            fillOpacity={0.8}
                            anchorX="center"
                            anchorY="middle"
                        >
                            RF
                        </Text>
                    )}

                    {/* 9시 방향 - LF (Left Fifth) - 톤필드 좌측 꼭지점 바로 좌측 (간격: 0.04) */}
                    {isUIVisible && (
                        <Text
                            position={[-0.34, 0, 0.02]}
                            fontSize={0.05}
                            color="#CCCCCC"
                            fillOpacity={0.8}
                            anchorX="center"
                            anchorY="middle"
                        >
                            LF
                        </Text>
                    )}

                    {/* 대각선 지점 표시 - SP1, SP2, SP3, SP4 */}
                    {isUIVisible && (
                        <>
                            {/* SP1 (1사분면, 45도 방향) - 대각선 위쪽 (바깥쪽) */}
                            <Text
                                position={[0.212 + 0.028, 0.300 + 0.028, 0.02]}
                                fontSize={0.05}
                                color="#CCCCCC"
                                fillOpacity={0.8}
                                anchorX="center"
                                anchorY="middle"
                            >
                                SP1
                            </Text>

                            {/* SP2 (2사분면, 135도 방향) - 대각선 위쪽 (바깥쪽) */}
                            <Text
                                position={[-0.212 - 0.028, 0.300 + 0.028, 0.02]}
                                fontSize={0.05}
                                color="#CCCCCC"
                                fillOpacity={0.8}
                                anchorX="center"
                                anchorY="middle"
                            >
                                SP2
                            </Text>

                            {/* SP3 (3사분면, 225도 방향) - 대각선 아래쪽 (바깥쪽) */}
                            <Text
                                position={[-0.212 - 0.028, -0.300 - 0.028, 0.02]}
                                fontSize={0.05}
                                color="#CCCCCC"
                                fillOpacity={0.8}
                                anchorX="center"
                                anchorY="middle"
                            >
                                SP3
                            </Text>

                            {/* SP4 (4사분면, 315도 방향) - 대각선 아래쪽 (바깥쪽) */}
                            <Text
                                position={[0.212 + 0.028, -0.300 - 0.028, 0.02]}
                                fontSize={0.05}
                                color="#CCCCCC"
                                fillOpacity={0.8}
                                anchorX="center"
                                anchorY="middle"
                            >
                                SP4
                            </Text>
                        </>
                    )}

                    {/* 사분면 표시 - 바깥쪽 좌표선 근처 */}
                    {/* 1사분면 (우측 상단) - 바깥방향 대각선 이동 */}
                    <Text
                        position={[0.45, 0.45, 0.02]}
                        fontSize={0.036}
                        color="#808080"
                        fillOpacity={0.5}
                        anchorX="center"
                        anchorY="middle"
                    >
                        1
                    </Text>

                    {/* 2사분면 (좌측 상단) - 바깥방향 대각선 이동 */}
                    <Text
                        position={[-0.45, 0.45, 0.02]}
                        fontSize={0.036}
                        color="#808080"
                        fillOpacity={0.5}
                        anchorX="center"
                        anchorY="middle"
                    >
                        2
                    </Text>

                    {/* 3사분면 (좌측 하단) - 바깥방향 대각선 이동 */}
                    <Text
                        position={[-0.45, -0.45, 0.02]}
                        fontSize={0.036}
                        color="#808080"
                        fillOpacity={0.5}
                        anchorX="center"
                        anchorY="middle"
                    >
                        3
                    </Text>

                    {/* 4사분면 (우측 하단) - 바깥방향 대각선 이동 */}
                    <Text
                        position={[0.45, -0.45, 0.02]}
                        fontSize={0.036}
                        color="#808080"
                        fillOpacity={0.5}
                        anchorX="center"
                        anchorY="middle"
                    >
                        4
                    </Text>

                    {/* Y-axis labels (left side) */}
                    <Text
                        position={[0.6, -0.425, 0.02]}
                        fontSize={0.04}
                        color="#808080"
                        fillOpacity={0.3}
                        anchorX="left"
                        anchorY="middle"
                    >
                        -1
                    </Text>
                    <Text
                        position={[0.6, 0, 0.02]}
                        fontSize={0.04}
                        color="#808080"
                        fillOpacity={0.3}
                        anchorX="left"
                        anchorY="middle"
                    >
                        0
                    </Text>
                    <Text
                        position={[0.6, 0.425, 0.02]}
                        fontSize={0.04}
                        color="#808080"
                        fillOpacity={0.3}
                        anchorX="left"
                        anchorY="middle"
                    >
                        1
                    </Text>
                </group>
            )}

            {/* Coordinate axes */}
            {isUIVisible && (
                <axesHelper args={[1.2]} />
            )}
        </group>
    );
}

// 카메라 프리셋 위치 정의 (ToneField.tsx용 - Z축이 위쪽)
const CAMERA_PRESETS_LOCAL: Record<CameraPreset, { position: [number, number, number], lookAt?: [number, number, number] }> = {
    top: {
        position: [0, 0, 1.5],  // Z축이 위쪽이므로 (0, 0, 1.5)
        lookAt: [0, 0, 0]
    },
    perspective: {
        position: [2, 2, 2],
        lookAt: [0, 0, 0]
    },
    front: {
        position: [0, 0.5, 2],  // 앞에서 (Y축이 앞뒤)
        lookAt: [0, 0, 0]
    },
    side: {
        position: [2, 0.5, 0],  // 옆에서 (X축이 좌우)
        lookAt: [0, 0, 0]
    },
    isometric: {
        position: [1.5, 1.5, 1.5],
        lookAt: [0, 0, 0]
    },
    close: {
        position: [0, 0.8, 1.2],  // 가까운 시점
        lookAt: [0, 0, 0]
    }
};

// Camera controller component
function CameraController({ viewMode }: { viewMode: CameraPreset }) {
    const { camera } = useThree();

    useEffect(() => {
        const preset = CAMERA_PRESETS_LOCAL[viewMode];
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

// 나룻배 탑승 모드 카메라 컨트롤러
function FerryBoatCameraController({ boatRef }: { boatRef: React.RefObject<THREE.Group | null> }) {
    const { camera } = useThree();

    useFrame(() => {
        if (!boatRef.current) return;

        // 카메라를 나룻배 앞쪽에 배치 (나룻배 앞쪽에 앉아서 바깥 방향을 보는 시점)
        // 나룻배 앞쪽(z축 음수 방향), 약간 위쪽에 카메라 위치
        const cameraOffset = new THREE.Vector3(0, 0.3, -0.5); // z를 음수로 변경하여 앞쪽에 배치
        cameraOffset.applyQuaternion(boatRef.current.quaternion);
        camera.position.copy(boatRef.current.position).add(cameraOffset);

        // 카메라가 나룻배가 바라보는 방향(운전 방향)을 보도록 회전
        // 나룻배의 회전을 그대로 사용하되, 약간의 수평 조정
        camera.rotation.copy(boatRef.current.rotation);
    });

    return null;
}

// 행성 1: 하모닉스 진동 시각화
function HarmonicVibrationPlanet({ position }: { position: [number, number, number] }) {
    const groupRef = useRef<THREE.Group>(null);
    const ringsRef = useRef<THREE.Mesh[]>([]);

    useFrame((state) => {
        if (!groupRef.current) return;
        const time = state.clock.elapsedTime;

        // 행성 회전
        groupRef.current.rotation.y = time * 0.2;

        // 진동하는 링들
        ringsRef.current.forEach((ring, i) => {
            if (ring) {
                const frequency = 1 + i * 0.5; // 각 링마다 다른 주파수
                const amplitude = 0.1 + i * 0.05;
                const scale = 1 + Math.sin(time * frequency) * amplitude;
                ring.scale.setScalar(scale);

                // 링의 투명도도 진동
                const material = ring.material as THREE.MeshStandardMaterial;
                material.opacity = 0.6 + Math.sin(time * frequency * 1.5) * 0.3;
            }
        });
    });

    return (
        <group ref={groupRef} position={position}>
            {/* 행성 본체 */}
            <mesh>
                <sphereGeometry args={[0.8, 32, 32]} />
                <meshStandardMaterial
                    color="#4a90e2"
                    emissive="#1a3a5c"
                    emissiveIntensity={0.3}
                />
            </mesh>

            {/* 진동하는 링들 (하모닉스 파동) */}
            {[1, 2, 3, 4].map((i) => (
                <mesh
                    key={i}
                    ref={(el) => { if (el) ringsRef.current[i - 1] = el; }}
                    rotation={[Math.PI / 2, 0, 0]}
                >
                    <torusGeometry args={[0.8 + i * 0.2, 0.02, 16, 32]} />
                    <meshStandardMaterial
                        color="#6bb3ff"
                        emissive="#4a90e2"
                        emissiveIntensity={0.5}
                        transparent
                        opacity={0.6}
                    />
                </mesh>
            ))}

            {/* 파동 효과 (수직 파동) */}
            {[0, 1, 2].map((i) => (
                <mesh
                    key={`wave-${i}`}
                    rotation={[0, (i * Math.PI) / 3, 0]}
                >
                    <torusGeometry args={[0.9, 0.03, 16, 32]} />
                    <meshStandardMaterial
                        color="#8bc5ff"
                        emissive="#6bb3ff"
                        emissiveIntensity={0.4}
                        transparent
                        opacity={0.5}
                    />
                </mesh>
            ))}
        </group>
    );
}

// 행성 2: AI 디지털 강국
function DigitalKingdomPlanet({ position }: { position: [number, number, number] }) {
    const groupRef = useRef<THREE.Group>(null);
    const gridRef = useRef<THREE.Mesh>(null);

    useFrame((state) => {
        if (!groupRef.current) return;
        const time = state.clock.elapsedTime;

        // 행성 회전
        groupRef.current.rotation.y = time * 0.15;

        // 그리드 애니메이션
        if (gridRef.current) {
            const material = gridRef.current.material as THREE.MeshStandardMaterial;
            material.emissiveIntensity = 0.3 + Math.sin(time * 2) * 0.2;
        }
    });

    return (
        <group ref={groupRef} position={position}>
            {/* 행성 본체 */}
            <mesh>
                <sphereGeometry args={[0.6, 32, 32]} />
                <meshStandardMaterial
                    color="#1a1a2e"
                    emissive="#0a0a1a"
                    emissiveIntensity={0.2}
                />
            </mesh>

            {/* 디지털 그리드 패턴 */}
            <mesh ref={gridRef}>
                <sphereGeometry args={[0.61, 16, 16]} />
                <meshStandardMaterial
                    color="#00ff00"
                    emissive="#00ff00"
                    emissiveIntensity={0.3}
                    wireframe
                    transparent
                    opacity={0.6}
                />
            </mesh>

            {/* 네트워크 라인들 */}
            {[0, 1, 2, 3, 4, 5].map((i) => {
                const angle = (i / 6) * Math.PI * 2;
                return (
                    <mesh
                        key={i}
                        rotation={[0, angle, Math.PI / 2]}
                    >
                        <torusGeometry args={[0.65, 0.01, 8, 16]} />
                        <meshStandardMaterial
                            color="#00ffff"
                            emissive="#00ffff"
                            emissiveIntensity={0.4}
                            transparent
                            opacity={0.7}
                        />
                    </mesh>
                );
            })}

            {/* 데이터 스트림 (빠르게 움직이는 점들) */}
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => {
                const angle = (i / 10) * Math.PI * 2;
                return (
                    <mesh
                        key={`data-${i}`}
                        position={[
                            Math.cos(angle) * 0.7,
                            Math.sin(angle) * 0.7,
                            0
                        ]}
                    >
                        <sphereGeometry args={[0.02, 8, 8]} />
                        <meshStandardMaterial
                            color="#00ff00"
                            emissive="#00ff00"
                            emissiveIntensity={1.0}
                        />
                    </mesh>
                );
            })}
        </group>
    );
}

// 행성 3: 동양 무협지 풍 누각
function AncientPavilionPlanet({ position }: { position: [number, number, number] }) {
    const groupRef = useRef<THREE.Group>(null);

    useFrame((state) => {
        if (!groupRef.current) return;
        // 살짝 회전
        groupRef.current.rotation.y = state.clock.elapsedTime * 0.05;
    });

    return (
        <group ref={groupRef} position={position}>
            {/* 행성 본체 (땅) */}
            <mesh>
                <sphereGeometry args={[0.5, 32, 32]} />
                <meshStandardMaterial
                    color="#3d2817"
                    emissive="#1a0f08"
                    emissiveIntensity={0.1}
                />
            </mesh>

            {/* 누각 - 1층 */}
            <group position={[0, 0.5, 0]}>
                {/* 기둥들 */}
                {[0, 1, 2, 3].map((i) => {
                    const angle = (i / 4) * Math.PI * 2;
                    return (
                        <mesh
                            key={`pillar-1-${i}`}
                            position={[Math.cos(angle) * 0.15, 0, Math.sin(angle) * 0.15]}
                        >
                            <cylinderGeometry args={[0.02, 0.02, 0.3, 8]} />
                            <meshStandardMaterial color="#8B4513" />
                        </mesh>
                    );
                })}

                {/* 1층 지붕 */}
                <mesh position={[0, 0.2, 0]}>
                    <coneGeometry args={[0.2, 0.15, 8]} />
                    <meshStandardMaterial color="#8B0000" />
                </mesh>

                {/* 1층 바닥 */}
                <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                    <cylinderGeometry args={[0.18, 0.18, 0.02, 16]} />
                    <meshStandardMaterial color="#654321" />
                </mesh>
            </group>

            {/* 누각 - 2층 */}
            <group position={[0, 0.75, 0]}>
                {[0, 1, 2, 3].map((i) => {
                    const angle = (i / 4) * Math.PI * 2;
                    return (
                        <mesh
                            key={`pillar-2-${i}`}
                            position={[Math.cos(angle) * 0.12, 0, Math.sin(angle) * 0.12]}
                        >
                            <cylinderGeometry args={[0.015, 0.015, 0.25, 8]} />
                            <meshStandardMaterial color="#8B4513" />
                        </mesh>
                    );
                })}

                <mesh position={[0, 0.15, 0]}>
                    <coneGeometry args={[0.15, 0.12, 8]} />
                    <meshStandardMaterial color="#8B0000" />
                </mesh>

                <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                    <cylinderGeometry args={[0.13, 0.13, 0.02, 16]} />
                    <meshStandardMaterial color="#654321" />
                </mesh>
            </group>

            {/* 누각 - 3층 (최상층) */}
            <group position={[0, 1.0, 0]}>
                {[0, 1, 2, 3].map((i) => {
                    const angle = (i / 4) * Math.PI * 2;
                    return (
                        <mesh
                            key={`pillar-3-${i}`}
                            position={[Math.cos(angle) * 0.1, 0, Math.sin(angle) * 0.1]}
                        >
                            <cylinderGeometry args={[0.012, 0.012, 0.2, 8]} />
                            <meshStandardMaterial color="#8B4513" />
                        </mesh>
                    );
                })}

                <mesh position={[0, 0.12, 0]}>
                    <coneGeometry args={[0.12, 0.1, 8]} />
                    <meshStandardMaterial color="#8B0000" />
                </mesh>

                <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                    <cylinderGeometry args={[0.1, 0.1, 0.02, 16]} />
                    <meshStandardMaterial color="#654321" />
                </mesh>
            </group>

            {/* 지붕 장식 (용머리 같은 것) */}
            <mesh position={[0, 1.2, 0]}>
                <sphereGeometry args={[0.03, 8, 8]} />
                <meshStandardMaterial color="#FFD700" emissive="#FFA500" emissiveIntensity={0.3} />
            </mesh>
        </group>
    );
}

// Space Background Component - 우주1 배경 (별, 먼지, 행성, 블랙홀)
function SpaceBackground() {
    const starsRef = useRef<THREE.Points>(null);
    const dustRef = useRef<THREE.Points>(null);

    // 별 생성 (성능 최적화: 2000 -> 1000으로 감소)
    const starsGeometry = useMemo(() => {
        const geometry = new THREE.BufferGeometry();
        const vertices = [];
        const colors = [];
        const starCount = 1000; // 성능 최적화: 절반으로 감소

        for (let i = 0; i < starCount; i++) {
            // 구형 분포로 별 배치 (멀리 있는 별들)
            const radius = 5 + Math.random() * 15; // 5~20 범위
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);

            const x = radius * Math.sin(phi) * Math.cos(theta);
            const y = radius * Math.sin(phi) * Math.sin(theta);
            const z = radius * Math.cos(phi);

            vertices.push(x, y, z);

            // 별의 밝기와 색상 (대부분 흰색, 일부는 파란색/노란색)
            const brightness = 0.5 + Math.random() * 0.5;
            const colorType = Math.random();
            if (colorType < 0.7) {
                // 흰색 별
                colors.push(brightness, brightness, brightness);
            } else if (colorType < 0.85) {
                // 파란색 별
                colors.push(0.7, 0.8, brightness);
            } else {
                // 노란색 별
                colors.push(brightness, brightness, 0.7);
            }
        }

        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

        return geometry;
    }, []);

    // 먼지 입자 생성 (성능 최적화: 500 -> 300으로 감소)
    const dustGeometry = useMemo(() => {
        const geometry = new THREE.BufferGeometry();
        const vertices = [];
        const colors = [];
        const dustCount = 300; // 성능 최적화: 감소

        for (let i = 0; i < dustCount; i++) {
            // 더 넓은 범위에 먼지 배치
            const radius = 3 + Math.random() * 20;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);

            const x = radius * Math.sin(phi) * Math.cos(theta);
            const y = radius * Math.sin(phi) * Math.sin(theta);
            const z = radius * Math.cos(phi);

            vertices.push(x, y, z);

            // 먼지는 매우 어둡고 약간의 색상
            const brightness = 0.1 + Math.random() * 0.2;
            colors.push(brightness * 0.8, brightness * 0.9, brightness);
        }

        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

        return geometry;
    }, []);

    // 별 애니메이션 (느린 회전) - 성능 최적화: 조건부 업데이트
    useFrame((state, delta) => {
        // 매 프레임이 아닌 델타타임 기반으로 업데이트하여 부드러운 애니메이션 유지
        if (starsRef.current) {
            starsRef.current.rotation.y += 0.0001 * delta * 60; // 60fps 기준으로 정규화
        }
        if (dustRef.current) {
            dustRef.current.rotation.y -= 0.00005 * delta * 60;
        }
    });

    return (
        <group>
            {/* 별들 */}
            <points ref={starsRef} geometry={starsGeometry}>
                <pointsMaterial
                    size={0.02}
                    vertexColors
                    transparent
                    opacity={0.8}
                    sizeAttenuation={true}
                />
            </points>

            {/* 우주1 먼지 */}
            <points ref={dustRef} geometry={dustGeometry}>
                <pointsMaterial
                    size={0.01}
                    vertexColors
                    transparent
                    opacity={0.3}
                    sizeAttenuation={true}
                />
            </points>

            {/* 멀리서 보이는 행성들 */}
            {/* 행성 1 - 하모닉스 진동 시각화 */}
            <HarmonicVibrationPlanet position={[-8, 6, -12]} />

            {/* 행성 2 - AI 디지털 강국 */}
            <DigitalKingdomPlanet position={[10, -5, -15]} />

            {/* 행성 3 - 동양 무협지 풍 누각 */}
            <AncientPavilionPlanet position={[-12, -8, -10]} />

            {/* 블랙홀 - 중앙에서 멀리 */}
            <group position={[15, -12, -20]}>
                {/* 블랙홀 본체 (매우 어두운 구) */}
                <mesh>
                    <sphereGeometry args={[1.2, 32, 32]} />
                    <meshStandardMaterial
                        color="#000000"
                        emissive="#000000"
                        emissiveIntensity={0}
                    />
                </mesh>

                {/* 블랙홀 주변 빛의 왜곡 효과 (어두운 고리) */}
                <mesh rotation={[Math.PI / 4, 0, 0]}>
                    <torusGeometry args={[1.5, 0.1, 16, 32]} />
                    <meshStandardMaterial
                        color="#1a1a2e"
                        emissive="#0a0a1a"
                        emissiveIntensity={0.5}
                        transparent
                        opacity={0.6}
                    />
                </mesh>

                {/* 블랙홀 주변 가스 구름 */}
                <mesh>
                    <sphereGeometry args={[1.8, 32, 32]} />
                    <meshStandardMaterial
                        color="#0a0a1a"
                        emissive="#000000"
                        emissiveIntensity={0.1}
                        transparent
                        opacity={0.2}
                    />
                </mesh>
            </group>

            {/* 블랙홀 2 - 다른 위치 */}
            <group position={[-18, 8, -25]}>
                <mesh>
                    <sphereGeometry args={[0.9, 32, 32]} />
                    <meshStandardMaterial
                        color="#000000"
                        emissive="#000000"
                        emissiveIntensity={0}
                    />
                </mesh>
                <mesh rotation={[Math.PI / 3, 0, 0]}>
                    <torusGeometry args={[1.2, 0.08, 16, 32]} />
                    <meshStandardMaterial
                        color="#1a1a2e"
                        emissive="#0a0a1a"
                        emissiveIntensity={0.4}
                        transparent
                        opacity={0.5}
                    />
                </mesh>
            </group>

            {/* 혜성들 (성능 최적화: 5 -> 3으로 감소) */}
            {[0, 1, 2].map((i) => (
                <Comet key={i} index={i} />
            ))}

            {/* 희미한 연기들 (성능 최적화: 6 -> 4로 감소) */}
            {[0, 1, 2, 3].map((i) => (
                <SpaceSmoke key={i} index={i} />
            ))}

            {/* 플라즈마 구름들 (성능 최적화: 4 -> 2로 감소) */}
            {[0, 1].map((i) => (
                <PlasmaCloud key={i} index={i} />
            ))}
        </group>
    );
}

// 혜성 컴포넌트
function Comet({ index }: { index: number }) {
    const cometRef = useRef<THREE.Group>(null);
    const trailRef = useRef<THREE.Points>(null);

    // 각 혜성마다 다른 초기 위치와 속도
    const initialAngle = useMemo(() => (index / 5) * Math.PI * 2, [index]);
    const speed = useMemo(() => 0.1 + (index % 3) * 0.05, [index]);
    const radius = useMemo(() => 8 + (index % 2) * 4, [index]);

    useFrame((state) => {
        if (!cometRef.current || !trailRef.current) return;
        const time = state.clock.elapsedTime;

        // 타원형 궤도로 이동
        const angle = initialAngle + time * speed;
        const prevAngle = initialAngle + (time - 0.016) * speed;

        cometRef.current.position.x = Math.cos(angle) * radius;
        cometRef.current.position.y = Math.sin(angle * 0.6) * 3;
        cometRef.current.position.z = Math.sin(angle) * radius - 12;

        // 혜성이 이동 방향을 향하도록 회전
        const prevX = Math.cos(prevAngle) * radius;
        const prevZ = Math.sin(prevAngle) * radius - 12;
        const dirX = cometRef.current.position.x - prevX;
        const dirZ = cometRef.current.position.z - prevZ;
        cometRef.current.rotation.y = Math.atan2(dirX, dirZ);

        // 꼬리 위치 업데이트
        const positions = trailRef.current.geometry.attributes.position.array as Float32Array;
        const trailLength = 20;
        for (let i = trailLength - 1; i > 0; i--) {
            positions[i * 3] = positions[(i - 1) * 3];
            positions[i * 3 + 1] = positions[(i - 1) * 3 + 1];
            positions[i * 3 + 2] = positions[(i - 1) * 3 + 2];
        }
        positions[0] = 0;
        positions[1] = 0;
        positions[2] = 0;
        trailRef.current.geometry.attributes.position.needsUpdate = true;
    });

    // 혜성 꼬리 (입자)
    const trailGeometry = useMemo(() => {
        const geometry = new THREE.BufferGeometry();
        const vertices = [];
        const colors = [];
        const trailLength = 20;

        for (let i = 0; i < trailLength; i++) {
            vertices.push(0, 0, 0);
            const brightness = 1 - (i / trailLength) * 0.8;
            colors.push(brightness, brightness * 0.9, brightness * 0.7);
        }

        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        return geometry;
    }, []);

    return (
        <group ref={cometRef}>
            {/* 혜성 본체 */}
            <mesh>
                <sphereGeometry args={[0.08, 8, 8]} />
                <meshStandardMaterial
                    color="#ffffff"
                    emissive="#aaccff"
                    emissiveIntensity={0.8}
                />
            </mesh>

            {/* 혜성 꼬리 */}
            <points ref={trailRef} geometry={trailGeometry}>
                <pointsMaterial
                    size={0.05}
                    vertexColors
                    transparent
                    opacity={0.6}
                    sizeAttenuation={true}
                />
            </points>
        </group>
    );
}

// 우주1 연기 컴포넌트
function SpaceSmoke({ index }: { index: number }) {
    const smokeRef = useRef<THREE.Group>(null);

    const initialPos = useMemo(() => {
        const angle = (index / 6) * Math.PI * 2;
        const radius = 5 + Math.random() * 10;
        return {
            x: Math.cos(angle) * radius,
            y: (Math.random() - 0.5) * 8,
            z: Math.sin(angle) * radius - 10
        };
    }, [index]);

    useFrame((state) => {
        if (!smokeRef.current) return;
        const time = state.clock.elapsedTime;

        // 부드럽게 움직이는 연기
        smokeRef.current.position.x = initialPos.x + Math.sin(time * 0.2 + index) * 2;
        smokeRef.current.position.y = initialPos.y + Math.cos(time * 0.15 + index) * 1.5;
        smokeRef.current.position.z = initialPos.z + Math.sin(time * 0.1 + index) * 1;

        // 연기가 확산되는 효과
        const scale = 1 + Math.sin(time * 0.3 + index) * 0.3;
        smokeRef.current.scale.setScalar(scale);
    });

    return (
        <group ref={smokeRef} position={[initialPos.x, initialPos.y, initialPos.z]}>
            {/* 연기 입자들 */}
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
                const angle = (i / 8) * Math.PI * 2;
                const dist = 0.1 + (i % 3) * 0.05;
                return (
                    <mesh
                        key={i}
                        position={[
                            Math.cos(angle) * dist,
                            (i % 2) * 0.1,
                            Math.sin(angle) * dist
                        ]}
                    >
                        <sphereGeometry args={[0.03, 8, 8]} />
                        <meshStandardMaterial
                            color="#4a4a4a"
                            transparent
                            opacity={0.2}
                            emissive="#2a2a2a"
                            emissiveIntensity={0.1}
                        />
                    </mesh>
                );
            })}
        </group>
    );
}

// 플라즈마 구름 컴포넌트
function PlasmaCloud({ index }: { index: number }) {
    const plasmaRef = useRef<THREE.Group>(null);

    const initialPos = useMemo(() => {
        const angle = (index / 4) * Math.PI * 2;
        const radius = 6 + Math.random() * 8;
        return {
            x: Math.cos(angle) * radius,
            y: (Math.random() - 0.5) * 6,
            z: Math.sin(angle) * radius - 14
        };
    }, [index]);

    useFrame((state) => {
        if (!plasmaRef.current) return;
        const time = state.clock.elapsedTime;

        // 플라즈마가 움직이는 효과
        plasmaRef.current.position.x = initialPos.x + Math.sin(time * 0.4 + index) * 1.5;
        plasmaRef.current.position.y = initialPos.y + Math.cos(time * 0.3 + index) * 1;
        plasmaRef.current.position.z = initialPos.z + Math.sin(time * 0.25 + index) * 0.8;

        // 플라즈마가 펄싱하는 효과
        const scale = 1 + Math.sin(time * 0.8 + index) * 0.2;
        plasmaRef.current.scale.setScalar(scale);
    });

    return (
        <group ref={plasmaRef} position={[initialPos.x, initialPos.y, initialPos.z]}>
            {/* 플라즈마 입자들 */}
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => {
                const angle = (i / 10) * Math.PI * 2;
                const dist = 0.15 + (i % 4) * 0.03;
                return (
                    <mesh
                        key={i}
                        position={[
                            Math.cos(angle) * dist,
                            (i % 3) * 0.08 - 0.1,
                            Math.sin(angle) * dist
                        ]}
                    >
                        <sphereGeometry args={[0.04, 8, 8]} />
                        <meshStandardMaterial
                            color={i % 2 === 0 ? "#ff00ff" : "#00ffff"}
                            emissive={i % 2 === 0 ? "#ff00ff" : "#00ffff"}
                            emissiveIntensity={0.6}
                            transparent
                            opacity={0.7}
                        />
                    </mesh>
                );
            })}
        </group>
    );
}

export function ToneField() {
    const [tension, setTension] = useState(0.5);
    const [wireframe, setWireframe] = useState(true); // 초기값: 3D 메쉬 활성화
    // 카메라 프리셋 순서 정의
    const CAMERA_PRESETS: CameraPreset[] = ['top', 'perspective', 'front', 'side', 'isometric', 'close'];

    const [cameraView, setCameraView] = useState<CameraPreset>('top'); // Changed to 'top'
    const [isUIVisible, setIsUIVisible] = useState(true); // UI 표시/숨김 상태
    const [showSpace, setShowSpace] = useState(false); // 우주1 표시 상태 (숨기기 모드에서 새로운 세계 버튼으로 활성화)
    const [inMetaverse, setInMetaverse] = useState(false); // 매장 차원 표시 상태
    const [inSpaceGameMode, setInSpaceGameMode] = useState(false); // 우주선 탑승 게임 모드 상태
    const [spaceshipPosition, setSpaceshipPosition] = useState<[number, number, number]>([0, 0, 0]); // 우주선 위치 상태
    const [spaceshipRotation, setSpaceshipRotation] = useState<[number, number, number]>([0, 0, 0]); // 우주선 회전 상태
    const [spaceshipVelocity, setSpaceshipVelocity] = useState<number>(0); // 우주선 속도 상태
    const [inFerryBoatMode, setInFerryBoatMode] = useState(false); // 나룻배 탑승 모드 상태
    const ferryBoatRef = useRef<THREE.Group>(null); // 나룻배 ref (우주1의 FerryBoat)
    const ferryBoatCameraRef = useRef<THREE.Group>(null); // 나룻배 카메라 ref (1인칭 시점용)
    const [isFullscreen, setIsFullscreen] = useState(false); // 전체화면 상태
    const containerRef = useRef<HTMLDivElement>(null); // 전체화면을 위한 ref
    const orbitControlsRef = useRef<OrbitControlsImpl>(null); // OrbitControls ref

    // Mesh ref for double click detection
    const toneFieldMeshRef = useRef<THREE.Mesh>(null);

    // Tuning error states
    const [tonicError, setTonicError] = useState(0);
    const [octaveError, setOctaveError] = useState(0);
    const [fifthError, setFifthError] = useState(0);

    // 주사위 아이콘 클릭 애니메이션 상태
    const [diceRolling, setDiceRolling] = useState(false);

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

    // ESC 키로 우주선 게임 모드 및 나룻배 모드 종료
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                if (inFerryBoatMode) {
                    setInFerryBoatMode(false);
                    setIsUIVisible(false);
                } else if (inSpaceGameMode) {
                    setInSpaceGameMode(false);
                    setIsUIVisible(false);
                }
            }
        };

        if (inSpaceGameMode || inFerryBoatMode) {
            document.addEventListener('keydown', handleKeyDown);
            return () => {
                document.removeEventListener('keydown', handleKeyDown);
            };
        }
    }, [inSpaceGameMode, inFerryBoatMode]);

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

    // Reset all states to initial values
    const handleReset = () => {
        // Tuning errors
        setTonicError(0);
        setOctaveError(0);
        setFifthError(0);

        // Hit point parameters
        setTuningTarget(null);
        setAuxiliaryTarget(null);
        setTargetDisplay("");
        setHitPointIntent("");
        setHitPointLocation(null);
        setHitPointCoordinate("");
        setHitPointStrength("");
        setHitPointCount("");
        setHammeringType("");

        // Camera view - 1번째 시점(top)으로 리셋
        setCameraView('top');

        // OrbitControls 리셋 (카메라 시점 초기화)
        if (orbitControlsRef.current) {
            orbitControlsRef.current.reset();
        }

        // Selected hit point
        setSelectedHitPoint(null);
        setExpandedCards(new Set());

        // Tension and wireframe (optional - keep current or reset to defaults)
        // setTension(0.5);
        // setWireframe(true);
    };

    // 카메라 프리셋 순환: 클릭할 때마다 다음 프리셋으로 이동
    const handleCameraReset = () => {
        const currentIndex = CAMERA_PRESETS.indexOf(cameraView);
        const nextIndex = (currentIndex + 1) % CAMERA_PRESETS.length;
        setCameraView(CAMERA_PRESETS[nextIndex]);
    };

    // Handle double click on tonefield
    const handleDoubleClick = (x: number, y: number) => {
        // Set hit point coordinate
        setHitPointCoordinate(`(${x.toFixed(3)}, ${y.toFixed(3)})`);

        // If tuning errors exist, auto-calculate other parameters
        // Otherwise, just set the coordinate and let user input manually
        if (tonicError !== 0 || octaveError !== 0 || fifthError !== 0) {
            // The existing useEffect will automatically calculate other parameters
            // based on tuning errors and location
            // We just need to set location if not already set
            if (!hitPointLocation) {
                // Determine location based on Y coordinate
                // Y > 0: external (옥타브 방향), Y < 0: internal (토닉 방향)
                setHitPointLocation(y >= 0 ? "external" : "internal");
            }
        } else {
            // No tuning errors, just set coordinate
            // User can manually set other parameters
        }
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

    // 전체화면 진입/해제 함수 (크로스 브라우저 호환)
    const toggleFullscreen = async () => {
        console.log('전체화면 버튼 클릭됨');
        try {
            // 현재 전체화면 상태 확인 (크로스 브라우저)
            const isCurrentlyFullscreen = !!(
                document.fullscreenElement ||
                (document as any).webkitFullscreenElement ||
                (document as any).mozFullScreenElement ||
                (document as any).msFullscreenElement
            );

            console.log('현재 전체화면 상태:', isCurrentlyFullscreen);

            if (!isCurrentlyFullscreen) {
                console.log('전체화면 진입 시도');
                // 전체화면 진입 - document.documentElement 사용 (더 안정적)
                const element = document.documentElement;

                if (element.requestFullscreen) {
                    console.log('requestFullscreen 사용');
                    await element.requestFullscreen();
                    console.log('전체화면 진입 성공');
                } else if ((element as any).webkitRequestFullscreen) {
                    console.log('webkitRequestFullscreen 사용');
                    await (element as any).webkitRequestFullscreen();
                    console.log('전체화면 진입 성공');
                } else if ((element as any).mozRequestFullScreen) {
                    console.log('mozRequestFullScreen 사용');
                    await (element as any).mozRequestFullScreen();
                    console.log('전체화면 진입 성공');
                } else if ((element as any).msRequestFullscreen) {
                    console.log('msRequestFullscreen 사용');
                    await (element as any).msRequestFullscreen();
                    console.log('전체화면 진입 성공');
                } else {
                    console.error('전체화면 API를 지원하지 않는 브라우저입니다.');
                    alert('이 브라우저는 전체화면을 지원하지 않습니다.');
                }
            } else {
                console.log('전체화면 해제 시도');
                // 전체화면 해제 (크로스 브라우저)
                if (document.exitFullscreen) {
                    console.log('exitFullscreen 사용');
                    await document.exitFullscreen();
                    console.log('전체화면 해제 성공');
                } else if ((document as any).webkitExitFullscreen) {
                    console.log('webkitExitFullscreen 사용');
                    await (document as any).webkitExitFullscreen();
                    console.log('전체화면 해제 성공');
                } else if ((document as any).mozCancelFullScreen) {
                    console.log('mozCancelFullScreen 사용');
                    await (document as any).mozCancelFullScreen();
                    console.log('전체화면 해제 성공');
                } else if ((document as any).msExitFullscreen) {
                    console.log('msExitFullscreen 사용');
                    await (document as any).msExitFullscreen();
                    console.log('전체화면 해제 성공');
                }
            }
        } catch (error) {
            console.error('전체화면 전환 오류:', error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            alert('전체화면 전환 중 오류가 발생했습니다: ' + errorMessage);
        }
    };

    // 전체화면 상태 변경 감지 (크로스 브라우저)
    useEffect(() => {
        const handleFullscreenChange = () => {
            const isFullscreen = !!(
                document.fullscreenElement ||
                (document as any).webkitFullscreenElement ||
                (document as any).mozFullScreenElement ||
                (document as any).msFullscreenElement
            );
            setIsFullscreen(isFullscreen);
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
        document.addEventListener('mozfullscreenchange', handleFullscreenChange);
        document.addEventListener('MSFullscreenChange', handleFullscreenChange);

        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
            document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
            document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
        };
    }, []);

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

    // 매장 차원 진입 시 SndStoreScene 렌더링
    if (inMetaverse) {
        return <SndStoreScene
            key="snd-store-scene"
            onExit={() => {
                setInMetaverse(false);
                setIsUIVisible(false);
            }}
            onFerryBoat={() => {
                setInMetaverse(false);
                setInFerryBoatMode(true);
            }}
        />;
    }

    // 나룻배 모드는 이제 우주1에서 FerryBoat 시점으로 전환 (별도 씬으로 이동하지 않음)

    return (
        <div ref={containerRef} className="w-full h-screen relative" style={{ backgroundColor: '#000000' }}>
            {/* Left HUD - Tuning Error Input */}
            {isUIVisible && (
                <div className="absolute top-4 left-4 z-10 w-80 max-h-[calc(100vh-2rem)] overflow-y-auto bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl transition-all duration-300">
                    <div className="p-4">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-lg font-bold text-gray-100 drop-shadow-md">조율오차 입력</h2>
                            <button
                                onClick={() => {
                                    // 클릭 애니메이션 시작
                                    setDiceRolling(true);

                                    const random5do = parseFloat((Math.random() * 60 - 30).toFixed(1));
                                    const randomOctave = parseFloat((Math.random() * 60 - 30).toFixed(1));
                                    const randomTonic = parseFloat((Math.random() * 60 - 30).toFixed(1));

                                    setTonicError(random5do);
                                    setOctaveError(randomOctave);
                                    setFifthError(randomTonic);

                                    // 애니메이션 종료 (300ms 후)
                                    setTimeout(() => {
                                        setDiceRolling(false);
                                    }, 300);
                                }}
                                className="w-8 h-8 rounded-full bg-black/80 backdrop-blur-md border border-white/10 text-white flex items-center justify-center hover:bg-black/90 transition-colors shadow-lg relative overflow-visible"
                                title="조율오차 랜덤 입력"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-5 w-5"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth={2}
                                    style={{
                                        transform: diceRolling ? 'rotate(360deg) scale(1.3)' : 'rotate(0deg) scale(1)',
                                        transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                                    }}
                                >
                                    {/* 주사위 아이콘 */}
                                    <rect x="4" y="4" width="16" height="16" rx="2" />
                                    <circle cx="8" cy="8" r="1" fill="currentColor" />
                                    <circle cx="16" cy="8" r="1" fill="currentColor" />
                                    <circle cx="12" cy="12" r="1" fill="currentColor" />
                                    <circle cx="8" cy="16" r="1" fill="currentColor" />
                                    <circle cx="16" cy="16" r="1" fill="currentColor" />
                                </svg>
                            </button>
                        </div>

                        <div className="space-y-2">
                            {/* Fifth Error (5도) */}
                            <div className={tuningTarget !== "5도" && auxiliaryTarget !== "5도" ? "opacity-60 hover:opacity-100 transition-opacity" : ""}>
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
                                    className={`w-full px-2 py-1.5 border-2 rounded-lg text-center text-base font-semibold transition-all bg-black/50 backdrop-blur-sm ${tuningTarget === "5도"
                                        ? "border-red-500 text-red-300 focus:ring-2 focus:ring-red-500"
                                        : auxiliaryTarget === "5도"
                                            ? "border-red-500/50 text-red-400/70 focus:ring-2 focus:ring-red-500/50"
                                            : "border-gray-600 text-gray-200 focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                                        }`}
                                    placeholder="0"
                                />
                            </div>

                            {/* Octave Error */}
                            <div className={tuningTarget !== "옥타브" && auxiliaryTarget !== "옥타브" ? "opacity-60 hover:opacity-100 transition-opacity" : ""}>
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
                                    className={`w-full px-3 py-2 border-2 rounded-lg text-center text-lg font-semibold transition-all bg-black/50 backdrop-blur-sm ${tuningTarget === "옥타브"
                                        ? "border-red-500 text-red-300 focus:ring-2 focus:ring-red-500"
                                        : auxiliaryTarget === "옥타브"
                                            ? "border-red-500/50 text-red-400/70 focus:ring-2 focus:ring-red-500/50"
                                            : "border-gray-600 text-gray-200 focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                                        }`}
                                    placeholder="0"
                                />
                            </div>

                            {/* Tonic Error (토닉) */}
                            <div className={tuningTarget !== "토닉" && auxiliaryTarget !== "토닉" ? "opacity-60 hover:opacity-100 transition-opacity" : ""}>
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
                                    className={`w-full px-3 py-2 border-2 rounded-lg text-center text-lg font-semibold transition-all bg-black/50 backdrop-blur-sm ${tuningTarget === "토닉"
                                        ? "border-red-500 text-red-300 focus:ring-2 focus:ring-red-500"
                                        : auxiliaryTarget === "토닉"
                                            ? "border-red-500/50 text-red-400/70 focus:ring-2 focus:ring-red-500/50"
                                            : "border-gray-600 text-gray-200 focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                                        }`}
                                    placeholder="0"
                                />
                            </div>
                        </div>

                        {/* Hit Point Parameters Section */}
                        <div className="mt-3 pt-3 border-t border-gray-700/50">
                            <h3 className="text-sm font-bold text-blue-400 mb-2 drop-shadow-sm">타점 파라미터</h3>

                            <div className="space-y-2 bg-black/30 p-3 rounded-xl border border-gray-700/50 backdrop-blur-sm">
                                {/* Location and Intention Row */}
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <div className="flex items-center justify-between mb-0.5">
                                            <label className="block text-xs text-gray-400">조율대상</label>
                                            {targetDisplay && (
                                                <span className="text-xs text-blue-400">자동</span>
                                            )}
                                        </div>
                                        <input
                                            type="text"
                                            value={targetDisplay}
                                            readOnly
                                            className="w-full px-2 py-1 border border-gray-600/50 rounded text-sm text-center bg-black/40 text-gray-200 font-semibold cursor-not-allowed"
                                            placeholder="조율대상"
                                        />
                                    </div>
                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                            <label className="block text-xs text-gray-400">의도</label>
                                            {hitPointIntent && (
                                                <span className="text-xs text-blue-400">자동</span>
                                            )}
                                        </div>
                                        <input
                                            type="text"
                                            value={hitPointIntent}
                                            onChange={(e) => setHitPointIntent(e.target.value)}
                                            className="w-full px-2 py-1 border border-gray-600/50 rounded text-sm text-center bg-black/40 text-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                            placeholder="의도"
                                        />
                                    </div>
                                </div>

                                {/* Position Buttons */}
                                <div>
                                    <label className="block text-xs text-gray-400 mb-0.5">
                                        위치
                                        {hitPointLocation && (
                                            <span className="float-right text-blue-400 text-xs">자동</span>
                                        )}
                                    </label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            onClick={() => setHitPointLocation("internal")}
                                            className={`px-2 py-1.5 rounded-lg text-sm font-medium transition-all backdrop-blur-sm ${hitPointLocation === "internal"
                                                ? "bg-gray-500/80 text-white hover:bg-gray-500"
                                                : "bg-gray-700/50 text-gray-300 hover:bg-gray-600/50"
                                                }`}
                                        >
                                            내부
                                        </button>
                                        <button
                                            onClick={() => setHitPointLocation("external")}
                                            className={`px-2 py-1.5 rounded-lg text-sm font-medium transition-all backdrop-blur-sm ${hitPointLocation === "external"
                                                ? "bg-gray-500/80 text-white hover:bg-gray-500"
                                                : "bg-gray-700/50 text-gray-300 hover:bg-gray-600/50"
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
                                            <span className="text-xs text-blue-400">자동</span>
                                        )}
                                    </div>
                                    <input
                                        type="text"
                                        value={hitPointCoordinate}
                                        readOnly
                                        className="w-full px-2 py-1 border border-gray-600/50 rounded-lg text-sm text-center text-gray-200 bg-black/40 font-semibold cursor-not-allowed font-mono"
                                        placeholder="자동으로 계산됩니다"
                                    />
                                </div>

                                {/* Intensity and Timing */}
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <div className="flex items-center justify-between mb-0.5">
                                            <label className="block text-xs text-gray-400">강도</label>
                                            {hitPointStrength && (
                                                <span className="text-xs text-blue-400">자동</span>
                                            )}
                                        </div>
                                        <input
                                            type="text"
                                            value={hitPointStrength}
                                            readOnly
                                            className="w-full px-2 py-1.5 border border-gray-600/50 rounded text-sm text-center text-gray-200 bg-black/40 font-semibold cursor-not-allowed"
                                            placeholder="강도"
                                        />
                                    </div>
                                    <div>
                                        <div className="flex items-center justify-between mb-0.5">
                                            <label className="block text-xs text-gray-400">타수</label>
                                            {hitPointCount && (
                                                <span className="text-xs text-blue-400">자동</span>
                                            )}
                                        </div>
                                        <input
                                            type="text"
                                            value={hitPointCount}
                                            readOnly
                                            className="w-full px-2 py-1.5 border border-gray-600/50 rounded text-sm text-center text-gray-200 bg-black/40 font-semibold cursor-not-allowed"
                                            placeholder="타수"
                                        />
                                    </div>
                                </div>

                                {/* Hammering Type */}
                                <div>
                                    <div className="flex items-center justify-between mb-0.5">
                                        <label className="block text-xs text-gray-400">해머링 타입</label>
                                        {hammeringType && (
                                            <span className="text-xs text-blue-400">자동</span>
                                        )}
                                    </div>
                                    <input
                                        type="text"
                                        value={hammeringType}
                                        readOnly
                                        className="w-full px-2 py-1 border border-gray-600/50 rounded-lg text-sm text-center text-gray-200 bg-black/40 font-semibold cursor-not-allowed"
                                        placeholder="자동 계산"
                                    />
                                </div>

                                {/* Save Button */}
                                <button
                                    onClick={handleSaveHitPoint}
                                    disabled={isSaving}
                                    className={`w-full py-2 rounded-lg text-white font-bold text-base shadow-md transition-all mt-2 flex items-center justify-center gap-2 backdrop-blur-sm ${saveStatus === 'success'
                                        ? "bg-green-600/80 hover:bg-green-700/90"
                                        : saveStatus === 'error'
                                            ? "bg-red-600/80 hover:bg-red-700/90"
                                            : "bg-red-600/80 hover:bg-red-700/90"
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
                                            <span>⚠️</span> 저장 실패
                                        </>
                                    ) : (
                                        "타점 입력"
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Center - 3D Tonefield (Full Screen Background) */}
            <div className="absolute inset-0 z-0">
                <Canvas
                    gl={{ alpha: false }}
                    dpr={[1, 2]} // 성능 최적화: 고해상도 디스플레이에서도 최대 2배까지만
                    performance={{ min: 0.5 }} // 성능이 50% 이하로 떨어지면 자동으로 품질 조정
                    onCreated={({ gl }) => {
                        gl.setClearColor('#000000', 1);
                    }}
                >
                    <PerspectiveCamera makeDefault position={[2, 2, 2]} fov={50} />
                    {/* 게임 모드 및 나룻배 모드일 때는 OrbitControls 비활성화 */}
                    {!inSpaceGameMode && !inFerryBoatMode && <OrbitControls ref={orbitControlsRef} target={[0, 0, 0]} />}
                    {!inSpaceGameMode && !inFerryBoatMode && <CameraController viewMode={cameraView} />}
                    {/* 나룻배 탑승 모드 카메라 컨트롤러 - 우주1의 FerryBoat 1인칭 시점 */}
                    {inFerryBoatMode && (
                        <>
                            {/* 카메라 그룹 (나룻배에 부착될 카메라) */}
                            <group ref={ferryBoatCameraRef} />
                            <FirstPersonCamera cameraRef={ferryBoatCameraRef} boatRef={ferryBoatRef} />
                        </>
                    )}

                    <ambientLight intensity={0.4} />
                    <pointLight position={[10, 10, 10]} intensity={1} />
                    <pointLight position={[-10, 5, -10]} intensity={0.5} color="#ff00ff" />

                    {/* Space Background - 숨기기 모드에서 새로운 세계 버튼을 눌렀을 때만 표시 */}
                    {!isUIVisible && showSpace && <SpaceBackground />}

                    {/* 우주1에 이동한 FerryBoat (우주2에서 이동) - 우주1에서만 표시 */}
                    {!isUIVisible && showSpace && (
                        <FerryBoat cameraRef={ferryBoatCameraRef} boatRef={ferryBoatRef} />
                    )}

                    {/* 우주1에 이동한 태양 (우주2에서 이동) - 우주1에서만 표시 */}
                    {!isUIVisible && showSpace && (
                        <Sun position={[0, 50, -100]} />
                    )}

                    {/* 우주선 - 우주1에서 톤필드 위에 착륙 (0,0,0 지점에 고정) */}
                    {!isUIVisible && showSpace && (
                        <Spaceship
                            position={inSpaceGameMode ? spaceshipPosition : [0, 0, 0]}
                            rotation={inSpaceGameMode ? spaceshipRotation : undefined}
                            velocity={inSpaceGameMode ? spaceshipVelocity : 0}
                        />
                    )}



                    {/* 탑승 버튼 - 우주선 바로 위에 표시 (0,0,0 지점에 고정) */}
                    {!isUIVisible && showSpace && !inSpaceGameMode && !inFerryBoatMode && (
                        <Html position={[0, 0.06, 0]} center>
                            <button
                                onClick={() => {
                                    setInSpaceGameMode(true);
                                    setIsUIVisible(false);
                                    setSpaceshipPosition([0, 0, 0]); // 우주선 위치 초기화
                                    setSpaceshipRotation([0, 0, 0]); // 우주선 회전 초기화
                                }}
                                className="cyberpunk-button"
                                style={{
                                    pointerEvents: 'auto',
                                    whiteSpace: 'nowrap'
                                }}
                            >
                                BOARD
                            </button>
                        </Html>
                    )}

                    {/* 우주선 게임 모드 - Player 컴포넌트 활성화 (나룻배 모드일 때는 비활성화) */}
                    {!isUIVisible && showSpace && inSpaceGameMode && !inFerryBoatMode && (
                        <Player
                            initialPosition={[0, 0, 0]}
                            onPositionChange={(position) => setSpaceshipPosition(position)}
                            onRotationChange={(rotation) => setSpaceshipRotation(rotation)}
                            onVelocityChange={(velocity) => setSpaceshipVelocity(velocity)}
                            isSpaceshipMode={true}
                        />
                    )}

                    {/* Coordinate grid and tuning area */}
                    <CoordinateGrid isUIVisible={isUIVisible && !showSpace} />

                    {/* Tonefield boundary lines - 초기: 투명도 80% 회색, 타점값에 따라 파란색(내부) 또는 빨간색(외부) */}
                    <TonefieldBoundaries hitPointLocation={hitPointLocation} />

                    {/* Location text in dimple center (hide in space mode) */}
                    {!showSpace && <LocationText hitPointLocation={hitPointLocation} />}

                    {/* Tonefield mesh with 0.6 x 0.85 dimensions */}
                    <ToneFieldMesh
                        tension={tension}
                        wireframe={wireframe}
                        meshRef={toneFieldMeshRef}
                        tuningErrors={{
                            tonic: fifthError,
                            octave: octaveError,
                            fifth: tonicError
                        }}
                        hitPointLocation={hitPointLocation}
                        hitPointCoordinate={hitPointCoordinate}
                    />


                    {/* Double click handler */}
                    <DoubleClickHandler
                        onDoubleClick={handleDoubleClick}
                        meshRef={toneFieldMeshRef}
                    />


                    {/* Hit point marker - show when coordinates are set (but hide in space mode) */}
                    {hitPointCoordinate && !showSpace && (() => {
                        // Parse coordinates from string "(x, y)"
                        const match = hitPointCoordinate.match(/\(([^,]+),\s*([^)]+)\)/);
                        if (match) {
                            const x = parseFloat(match[1]);
                            const y = parseFloat(match[2]);
                            return (
                                <HitPointMarker
                                    x={x}
                                    y={y}
                                    strength={hitPointStrength || undefined}
                                    count={hitPointCount || undefined}
                                    hammeringType={hammeringType || undefined}
                                    intent={hitPointIntent || undefined}
                                    location={hitPointLocation || undefined}
                                    isUIVisible={isUIVisible}
                                />
                            );
                        }
                        return null;
                    })()}
                </Canvas>



                {/* Fixed 2D Overlays - Bottom Right: Tuning Errors (above Hit Point Info) */}
                {isUIVisible && hitPointCoordinate && (
                    <div className="absolute bottom-6 right-6 pointer-events-none flex flex-col gap-3 items-end">
                        {/* Tuning Errors Box */}
                        <div className="bg-black/60 backdrop-blur-md rounded-lg border border-gray-500/50 px-3 py-2 text-white shadow-xl w-auto min-w-fit flex flex-col justify-center">
                            <div className="space-y-1 text-sm font-mono">
                                {/* 5도 (Top) */}
                                <div className={`${tuningTarget === "5도" ? "text-red-400 font-bold" : auxiliaryTarget === "5도" ? "text-red-400/70" : "text-gray-300"} ${tuningTarget !== "5도" && auxiliaryTarget !== "5도" ? "opacity-40" : ""}`}>
                                    {tonicError === 0 ? "0" : tonicError > 0 ? `+${tonicError}` : tonicError}
                                </div>
                                {/* 옥타브 (Middle) */}
                                <div className={`${tuningTarget === "옥타브" ? "text-red-400 font-bold" : auxiliaryTarget === "옥타브" ? "text-red-400/70" : "text-gray-300"} ${tuningTarget !== "옥타브" && auxiliaryTarget !== "옥타브" ? "opacity-40" : ""}`}>
                                    {octaveError === 0 ? "0" : octaveError > 0 ? `+${octaveError}` : octaveError}
                                </div>
                                {/* 토닉 (Bottom) */}
                                <div className={`${tuningTarget === "토닉" ? "text-red-400 font-bold" : auxiliaryTarget === "토닉" ? "text-red-400/70" : "text-gray-300"} ${tuningTarget !== "토닉" && auxiliaryTarget !== "토닉" ? "opacity-40" : ""}`}>
                                    {fifthError === 0 ? "0" : fifthError > 0 ? `+${fifthError}` : fifthError}
                                </div>
                            </div>
                        </div>

                        {/* Fixed 2D Overlays - Bottom Right: Hit Point Info */}
                        {hitPointCoordinate && (
                            <div className="pointer-events-none">
                                {/* Hit Point Info Box */}
                                <div className="bg-black/60 backdrop-blur-md rounded-lg border border-gray-500/50 p-3 text-white shadow-xl w-40 flex flex-col gap-2 text-right">
                                    {/* Row 1: Location */}
                                    <div className="flex justify-end">
                                        <span className={`font-bold px-1.5 py-0.5 rounded text-xs ${hitPointLocation === "internal" ? "bg-gray-500/30 text-gray-300" : hitPointLocation === "external" ? "bg-gray-500/30 text-gray-300" : "bg-gray-500/30 text-gray-400"}`}>
                                            {hitPointLocation === "internal" ? "내부" : hitPointLocation === "external" ? "외부" : ""}
                                        </span>
                                    </div>
                                    {/* Row 2: 조율대상 + 의도 */}
                                    {targetDisplay && (
                                        <div className="flex justify-end items-center gap-2">
                                            <div className="text-sm font-bold text-yellow-400">{targetDisplay}</div>
                                            {hitPointIntent && (
                                                <div className="text-xs text-white">{hitPointIntent}</div>
                                            )}
                                        </div>
                                    )}
                                    {/* Row 3: 타법(강도*타수) */}
                                    {hitPointStrength && hitPointCount && hammeringType && (
                                        <div className="text-xs">
                                            <span className="font-bold text-yellow-400">{hammeringType}({hitPointStrength}*{hitPointCount})</span>
                                        </div>
                                    )}
                                    {/* Row 4: 좌표 */}
                                    {hitPointCoordinate && (
                                        <div className="text-xs font-mono text-white">
                                            {hitPointCoordinate}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* UI Toggle Button - 우측 상단, UI 숨김 모드일 때만 표시 */}
                {!isUIVisible && (
                    <>
                        {/* 레벨 2 (우주1)일 때는 나가기 버튼만 표시 */}
                        {showSpace ? (
                            <>
                                {/* 나룻배 탑승 버튼 - 깃발 모양 (board 버튼 왼쪽) - 우주1에서만 표시 */}
                                {!inSpaceGameMode && !inFerryBoatMode && !isUIVisible && showSpace && (
                                    <button
                                        onClick={() => {
                                            setInFerryBoatMode(true);
                                        }}
                                        className="absolute top-6 right-20 w-10 h-10 rounded-full bg-black/80 backdrop-blur-md border border-white/30 text-white/70 flex items-center justify-center hover:bg-black/90 hover:border-white/50 hover:text-white transition-all shadow-lg opacity-70 hover:opacity-100 z-[100]"
                                        title="나룻배 탑승 (우주1의 FerryBoat 시점, ESC로 종료)"
                                    >
                                        {/* 깃발 아이콘 */}
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                                        </svg>
                                    </button>
                                )}
                                {/* 뒤로가기 버튼 */}
                                <button
                                    onClick={() => {
                                        if (showSpace) {
                                            if (inFerryBoatMode) {
                                                // 나룻배 모드에서 나가기
                                                setInFerryBoatMode(false);
                                                setIsUIVisible(false);
                                            } else if (inSpaceGameMode) {
                                                // 게임 모드에서 나가기
                                                setInSpaceGameMode(false);
                                                setIsUIVisible(false);
                                            } else {
                                                // 우주1에서 나가기 - 숨기기 모드 레벨 1로 이동
                                                setShowSpace(false);
                                                setIsUIVisible(false);
                                            }
                                        }
                                    }}
                                    className="absolute top-6 right-6 w-10 h-10 rounded-full bg-black/80 backdrop-blur-md border border-white/10 text-white flex items-center justify-center hover:bg-black/90 transition-colors shadow-lg opacity-70 hover:opacity-100 z-[100]"
                                    title={inFerryBoatMode ? "나룻배 모드 종료 (ESC)" : inSpaceGameMode ? "게임 모드 종료 (ESC)" : "나가기"}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        {/* 열린 문 아이콘 */}
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4h8v16H4V4z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4l6 6M4 20l6-6" />
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4h8v16h-8" />
                                        <circle cx="10" cy="12" r="1" fill="currentColor" />
                                    </svg>
                                </button>
                            </>
                        ) : (
                            <>
                                {/* 레벨 1: 기준점 - 다시보기 버튼 (우측 상단 고정) */}
                                <button
                                    onClick={() => {
                                        setIsUIVisible(true);
                                        setShowSpace(false); // 다시보기 시 우주1도 숨김
                                    }}
                                    className="absolute top-6 right-6 w-10 h-10 rounded-full bg-black/80 backdrop-blur-md border border-white/10 text-white flex items-center justify-center hover:bg-black/90 transition-colors shadow-lg opacity-70 hover:opacity-100 z-[100]"
                                    title="UI 보기"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                </button>

                                {/* 기준점 좌측: 우주1, 매장 아이콘 (가로 배치) */}
                                <div className="absolute top-6 right-20 flex items-center gap-3 z-[100]">
                                    {/* 우주1 버튼 */}
                                    <button
                                        onClick={() => {
                                            setShowSpace(true); // 우주1 열기
                                        }}
                                        className="w-10 h-10 rounded-full bg-black/80 backdrop-blur-md border border-blue-500/30 text-blue-400/70 flex items-center justify-center hover:bg-black/90 hover:border-blue-400/50 hover:text-blue-300 transition-all shadow-lg opacity-70 hover:opacity-100"
                                        title="우주1 열기"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </button>

                                    {/* Store Dimension Button */}
                                    <button
                                        onClick={() => {
                                            setInMetaverse(true); // 매장 차원 열기
                                        }}
                                        className="w-10 h-10 rounded-full bg-black/80 backdrop-blur-md border border-purple-500/30 text-purple-400/70 flex items-center justify-center hover:bg-black/90 hover:border-purple-400/50 hover:text-purple-300 transition-all shadow-lg opacity-70 hover:opacity-100"
                                        title="Snd Store (Metaverse)"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                        </svg>
                                    </button>

                                </div>

                                {/* 기준점 아래: 주사위 버튼 (조율오차 박스의 주사위 아이콘과 동일) */}
                                <button
                                    onClick={() => {
                                        // 클릭 애니메이션 시작
                                        setDiceRolling(true);

                                        const random5do = parseFloat((Math.random() * 60 - 30).toFixed(1));
                                        const randomOctave = parseFloat((Math.random() * 60 - 30).toFixed(1));
                                        const randomTonic = parseFloat((Math.random() * 60 - 30).toFixed(1));

                                        setTonicError(random5do);
                                        setOctaveError(randomOctave);
                                        setFifthError(randomTonic);

                                        // 애니메이션 종료 (300ms 후)
                                        setTimeout(() => {
                                            setDiceRolling(false);
                                        }, 300);
                                    }}
                                    className="absolute top-20 right-6 w-10 h-10 rounded-full bg-black/80 backdrop-blur-md border border-white/10 text-white flex items-center justify-center hover:bg-black/90 transition-colors shadow-lg opacity-70 hover:opacity-100 z-[100]"
                                    title="조율오차 랜덤 입력"
                                >
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        className="h-5 w-5"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                        strokeWidth={2}
                                        style={{
                                            transform: diceRolling ? 'rotate(360deg) scale(1.3)' : 'rotate(0deg) scale(1)',
                                            transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                                        }}
                                    >
                                        {/* 주사위 아이콘 */}
                                        <rect x="4" y="4" width="16" height="16" rx="2" />
                                        <circle cx="8" cy="8" r="1" fill="currentColor" />
                                        <circle cx="16" cy="8" r="1" fill="currentColor" />
                                        <circle cx="12" cy="12" r="1" fill="currentColor" />
                                        <circle cx="8" cy="16" r="1" fill="currentColor" />
                                        <circle cx="16" cy="16" r="1" fill="currentColor" />
                                    </svg>
                                </button>

                                {/* 좌표 마크 숨기기 버튼 - 주사위 버튼 아래에 배치 */}
                                <button
                                    onClick={() => {
                                        setHitPointCoordinate(""); // 좌표만 초기화 (장력 표시는 유지)
                                    }}
                                    disabled={!hitPointCoordinate} // 좌표가 없으면 비활성화
                                    className={`absolute top-32 right-6 w-10 h-10 rounded-full bg-black/80 backdrop-blur-md border flex items-center justify-center transition-all shadow-lg z-[100] ${hitPointCoordinate
                                        ? 'border-orange-500/30 text-orange-400 hover:bg-black/90 hover:border-orange-400/50 hover:text-orange-300 opacity-70 hover:opacity-100'
                                        : 'border-gray-500/30 text-gray-500/50 cursor-not-allowed opacity-30'
                                        }`}
                                    title={hitPointCoordinate ? "좌표 마크 숨기기" : "표시된 좌표 없음"}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </>
                        )}
                    </>
                )}

            </div>

            {/* Right HUD - Recent Hit Points */}
            {isUIVisible && (
                <div className="absolute top-4 right-4 z-10 w-80 max-h-[calc(100vh-2rem)] overflow-y-auto bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl transition-all duration-300 flex flex-col">
                    <div className="p-4 flex-1 overflow-hidden flex flex-col">
                        <h2 className="text-lg font-semibold mb-2 text-gray-100 flex items-center gap-2 flex-wrap drop-shadow-md">
                            최근 타점
                            <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-gray-700/50 text-gray-300 border border-gray-600/30">
                                {recentHitPoints.length}
                            </span>
                        </h2>
                        <div ref={cardsContainerRef} className="space-y-2 overflow-y-auto pr-1 custom-scrollbar">
                            {isLoadingHitPoints ? (
                                // Loading Skeletons
                                Array.from({ length: 3 }).map((_, i) => (
                                    <div
                                        key={i}
                                        className="p-3 border border-gray-700/50 rounded-lg bg-black/20 animate-pulse"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="h-6 w-12 bg-gray-700/50 rounded"></div>
                                            <div className="flex-1 h-6 bg-gray-700/50 rounded"></div>
                                        </div>
                                    </div>
                                ))
                            ) : recentHitPoints.length === 0 ? (
                                <div className="text-center py-8 text-gray-500/80 text-sm">
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
                                            className={`p-3 border rounded-lg cursor-pointer transition-all backdrop-blur-sm ${isSelected
                                                ? "border-blue-500/50 bg-blue-900/30 shadow-[0_0_15px_rgba(59,130,246,0.2)]"
                                                : "border-gray-700/50 hover:border-blue-500/30 bg-black/30 hover:bg-black/50"
                                                }`}
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                {/* Left: ID & Time */}
                                                <div className="flex flex-col min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${hitPoint.location === "internal"
                                                            ? "bg-gray-700/50 text-gray-300"
                                                            : "bg-gray-600/50 text-gray-200"
                                                            }`}>
                                                            {hitPoint.location === "internal" ? "내부" : "외부"}
                                                        </span>
                                                    </div>
                                                    {/* Target Display */}
                                                    <div className="text-sm font-bold text-blue-400 mt-1 truncate">
                                                        {hitPoint.target_display}
                                                        {hitPoint.intent && (
                                                            <span className="ml-1.5 text-xs font-normal text-gray-400">
                                                                {hitPoint.intent}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Right: Hammering Info */}
                                                <div className="text-right flex-shrink-0">
                                                    <div className="text-xs font-bold text-blue-400">
                                                        {hammeringTypeMap[hitPoint.hammering_type || ""] || hitPoint.hammering_type}
                                                    </div>
                                                    <div className="text-xs text-gray-400 font-mono mt-0.5">
                                                        {hitPoint.strength} × {hitPoint.hit_count}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Expanded Details */}
                                            {isExpanded && (
                                                <div className="mt-3 pt-2 border-t border-gray-700/50 space-y-2 animate-fadeIn">
                                                    {/* Tuning Errors Grid */}
                                                    <div className="grid grid-cols-3 gap-1 text-center bg-black/20 rounded-lg p-2">
                                                        <div>
                                                            <div className="text-[10px] text-gray-500">5도</div>
                                                            <div className={`text-xs font-mono ${hitPoint.primary_target === 'fifth' || hitPoint.tuning_target === 'fifth' ? 'text-red-400 font-bold' : 'text-gray-300'}`}>
                                                                {hitPoint.tonic > 0 ? '+' : ''}{hitPoint.tonic}
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <div className="text-[10px] text-gray-500">옥타브</div>
                                                            <div className={`text-xs font-mono ${hitPoint.primary_target === 'octave' || hitPoint.tuning_target === 'octave' ? 'text-red-400 font-bold' : 'text-gray-300'}`}>
                                                                {hitPoint.octave > 0 ? '+' : ''}{hitPoint.octave}
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <div className="text-[10px] text-gray-500">토닉</div>
                                                            <div className={`text-xs font-mono ${hitPoint.primary_target === 'tonic' || hitPoint.tuning_target === 'tonic' ? 'text-red-400 font-bold' : 'text-gray-300'}`}>
                                                                {hitPoint.fifth > 0 ? '+' : ''}{hitPoint.fifth}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Coordinates */}
                                                    <div className="flex justify-between items-center text-xs px-1">
                                                        <span className="text-gray-500">좌표</span>
                                                        <span className="font-mono text-gray-300">
                                                            ({hitPoint.coordinate_x.toFixed(3)}, {hitPoint.coordinate_y.toFixed(3)})
                                                        </span>
                                                    </div>

                                                    {/* Delete Button */}
                                                    <button
                                                        onClick={(e) => handleDeleteHitPoint(e, hitPoint.id!)}
                                                        className="w-full mt-2 py-1.5 bg-red-900/30 hover:bg-red-900/50 text-red-400 text-xs rounded transition-colors flex items-center justify-center gap-1 group"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                        </svg>
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
                </div>
            )}
            {/* Bottom Control Dock */}
            {isUIVisible && (
                <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex items-center gap-4 z-50 px-6 py-3 bg-black/40 backdrop-blur-md rounded-full border border-white/10 shadow-2xl transition-all duration-300 hover:bg-black/60">
                    {/* Camera View Toggle - 프리셋 순환 */}
                    <button
                        onClick={handleCameraReset}
                        className="p-2 rounded-full text-gray-300 hover:text-white hover:bg-white/10 transition-all relative group"
                        title="카메라 시점 변경 (클릭 시 다음 프리셋으로 이동)"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        <span className="absolute -top-10 left-1/2 transform -translate-x-1/2 px-2 py-1 bg-black/80 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                            {cameraView === 'top' ? '탑뷰' :
                                cameraView === 'perspective' ? '3D 뷰' :
                                    cameraView === 'front' ? '정면' :
                                        cameraView === 'side' ? '측면' :
                                            cameraView === 'isometric' ? '등축' :
                                                cameraView === 'close' ? '근접' : '카메라'}
                        </span>
                    </button>

                    <div className="w-px h-6 bg-gray-600/50"></div>

                    {/* Wireframe Toggle */}
                    <button
                        onClick={() => setWireframe(!wireframe)}
                        className={`p-2 rounded-full transition-all relative group ${wireframe ? "text-blue-400 bg-blue-500/10" : "text-gray-300 hover:text-white hover:bg-white/10"}`}
                        title="와이어프레임 토글"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                        <span className="absolute -top-10 left-1/2 transform -translate-x-1/2 px-2 py-1 bg-black/80 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                            와이어프레임
                        </span>
                    </button>

                    {/* Reset Button */}
                    <button
                        onClick={handleReset}
                        className="p-2 rounded-full text-gray-300 hover:text-red-400 hover:bg-red-500/10 transition-all relative group"
                        title="초기화"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        <span className="absolute -top-10 left-1/2 transform -translate-x-1/2 px-2 py-1 bg-black/80 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                            초기화
                        </span>
                    </button>

                    {/* UI Toggle (Hide) */}
                    <button
                        onClick={() => {
                            setIsUIVisible(false);
                            setShowSpace(false); // 숨기기 모드 진입 시 우주1은 숨김
                        }}
                        className="p-2 rounded-full text-gray-300 hover:text-white hover:bg-white/10 transition-all relative group"
                        title="UI 숨기기"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                        <span className="absolute -top-10 left-1/2 transform -translate-x-1/2 px-2 py-1 bg-black/80 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                            UI 숨기기
                        </span>
                    </button>
                </div>
            )}

            {/* 우주선 게임 모드 조작 안내 */}
            {!isUIVisible && showSpace && inSpaceGameMode && (
                <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-40 pointer-events-none">
                    <div className="bg-black/50 backdrop-blur-sm px-6 py-3 rounded-full border border-white/10 text-white/70 text-sm flex items-center gap-4 shadow-lg">
                        <span className="flex flex-col items-center gap-1">
                            <span className="px-1.5 py-0.5 bg-white/10 rounded text-xs font-mono border border-white/20">WASD</span>
                            <span>Move</span>
                        </span>
                        <span className="w-px h-6 bg-white/20"></span>
                        <span className="flex flex-col items-center gap-1">
                            <span className="px-1.5 py-0.5 bg-white/10 rounded text-xs font-mono border border-white/20">MOUSE</span>
                            <span>Look</span>
                        </span>
                        <span className="w-px h-6 bg-white/20"></span>
                        <span className="flex flex-col items-center gap-1">
                            <span className="px-1.5 py-0.5 bg-white/10 rounded text-xs font-mono border border-white/20">C</span>
                            <span>Camera</span>
                        </span>
                        <span className="w-px h-6 bg-white/20"></span>
                        <span className="flex flex-col items-center gap-1">
                            <span className="px-1.5 py-0.5 bg-white/10 rounded text-xs font-mono border border-white/20">ESC</span>
                            <span>Exit</span>
                        </span>
                    </div>
                </div>
            )}

            {/* 나룻배 탑승 모드 안내 */}
            {!isUIVisible && showSpace && inFerryBoatMode && (
                <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-40 pointer-events-none">
                    <div className="bg-black/50 backdrop-blur-sm px-6 py-3 rounded-full border border-red-500/30 text-red-300/70 text-sm flex items-center gap-4 shadow-lg">
                        <span className="flex flex-col items-center gap-1">
                            <span className="text-lg">🚢</span>
                            <span>나룻배 여행 중</span>
                        </span>
                        <span className="w-px h-6 bg-red-500/20"></span>
                        <span className="flex flex-col items-center gap-1">
                            <span className="px-1.5 py-0.5 bg-red-500/10 rounded text-xs font-mono border border-red-500/20">ESC</span>
                            <span>나가기</span>
                        </span>
                    </div>
                </div>
            )}

        </div>
    );
}


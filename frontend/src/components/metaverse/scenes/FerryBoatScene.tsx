"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Stars, Sparkles } from "@react-three/drei";
import { useRef, useEffect, useMemo } from "react";
import * as THREE from "three";

// 나룻배 컴포넌트 (1인칭 시점용)
function FerryBoat({ cameraRef, boatRef }: { cameraRef: React.RefObject<THREE.Group>; boatRef: React.RefObject<THREE.Group> }) {
    const oar1Ref = useRef<THREE.Group>(null);
    const oar2Ref = useRef<THREE.Group>(null);
    const angleRef = useRef(0);
    const lastTimeRef = useRef(0);

    // 나무 재질 속성 (참나무 색상, 거친 표면)
    const woodMaterialProps = {
        color: 0x8b5a2b, // 짙은 참나무 색
        roughness: 0.8, // 거친 표면
        metalness: 0.1, // 금속성 낮음
    };

    // 선체 지오메트리 생성 (LatheGeometry 사용)
    const hullGeometry = useMemo(() => {
        const hullPoints: THREE.Vector2[] = [];
        for (let i = 0; i <= 10; i++) {
            const x = Math.sin(i * 0.2) * 1.5;
            const y = i * 0.4 - 1.5;
            hullPoints.push(new THREE.Vector2(x, y));
        }
        return new THREE.LatheGeometry(hullPoints, 32, 0, Math.PI);
    }, []);

    // 노 애니메이션
    useFrame((state) => {
        const time = state.clock.elapsedTime;
        
        // 노를 부드럽게 움직이는 애니메이션
        if (oar1Ref.current) {
            oar1Ref.current.rotation.z = Math.sin(time * 1.2) * 0.3 + Math.PI / 4;
        }
        if (oar2Ref.current) {
            oar2Ref.current.rotation.z = Math.sin(time * 1.2 + Math.PI) * 0.3 + Math.PI / 4;
        }
    });

    useFrame((state) => {
        if (!boatRef.current || !cameraRef.current) return;

        // 부드럽게 유영하는 애니메이션
        const time = state.clock.elapsedTime;
        const deltaTime = time - lastTimeRef.current;
        lastTimeRef.current = time;

        // 속도 스펙트럼: 여러 주파수를 조합하여 넓은 속도 범위 생성
        const speedVariation =
            Math.sin(time * 0.1) * 0.3 +
            Math.sin(time * 0.3) * 0.2 +
            Math.sin(time * 0.7) * 0.15 +
            Math.sin(time * 1.5) * 0.1;

        const baseSpeed = 0.425;
        const speed = baseSpeed + speedVariation;

        // 각도를 속도에 따라 누적
        angleRef.current += speed * deltaTime;
        const angle = angleRef.current;

        // 원형 경로로 이동 (더 넓은 범위)
        const radius = 20;
        boatRef.current.position.x = Math.cos(angle) * radius;
        boatRef.current.position.y = Math.sin(angle * 0.5) * 5 + 8;
        boatRef.current.position.z = Math.sin(angle) * radius;

        // 배가 이동 방향을 향하도록 회전
        boatRef.current.rotation.y = angle + Math.PI / 2;

        // 살짝 흔들리는 효과
        const shakeIntensity = Math.abs(speedVariation) * 0.3;
        boatRef.current.rotation.z = Math.sin(time * 2) * (0.1 + shakeIntensity);
        boatRef.current.rotation.x = Math.cos(time * 1.5) * (0.05 + shakeIntensity * 0.5);

        // 카메라를 나룻배에 부착 (1인칭 시점)
        // 나룻배 중앙 좌석 위치에 카메라 위치 (고정)
        const cameraOffset = new THREE.Vector3(0, 0.2, 0);
        cameraOffset.applyQuaternion(boatRef.current.quaternion);
        cameraRef.current.position.copy(boatRef.current.position).add(cameraOffset);
        
        // 카메라 회전은 나룻배의 기본 회전 + 마우스 룩어라운드 회전이 합쳐짐
        // (FirstPersonCamera에서 처리)
    });

    return (
        <group ref={boatRef} position={[20, 8, 0]}>
            {/* 선체 (Hull) - LatheGeometry 사용 */}
            <mesh
                geometry={hullGeometry}
                rotation={[Math.PI / 2, 0, Math.PI / 2]}
                scale={[2, 1, 1]}
            >
                <meshStandardMaterial {...woodMaterialProps} />
            </mesh>

            {/* 내부 늑골 (Ribs) */}
            {[-1.5, -0.9, -0.3, 0.3, 0.9, 1.5].map((x, i) => (
                <mesh
                    key={`rib-${i}`}
                    position={[x, 0, 0]}
                    rotation={[-Math.PI / 2, 0, Math.PI / 2]}
                >
                    <torusGeometry args={[1.4, 0.05, 8, 32, Math.PI]} />
                    <meshStandardMaterial {...woodMaterialProps} />
                </mesh>
            ))}

            {/* 중앙 좌석 (Thwart) */}
            <mesh position={[0, 0.2, 0]}>
                <boxGeometry args={[0.8, 0.1, 2.8]} />
                <meshStandardMaterial {...woodMaterialProps} />
            </mesh>

            {/* 바닥판 (Floorboards) */}
            <mesh position={[0, -0.3, 0]}>
                <boxGeometry args={[3.5, 0.05, 2.5]} />
                <meshStandardMaterial {...woodMaterialProps} />
            </mesh>

            {/* 노 (Oars) - 좌측 */}
            <group ref={oar1Ref} position={[-0.5, 0.4, 1]} rotation={[0, 0, Math.PI / 4]}>
                <mesh>
                    <cylinderGeometry args={[0.05, 0.05, 3, 16]} />
                    <meshStandardMaterial {...woodMaterialProps} />
                </mesh>
                <mesh position={[0, -1.5, 0]}>
                    <boxGeometry args={[0.1, 0.6, 0.4]} />
                    <meshStandardMaterial {...woodMaterialProps} />
                </mesh>
            </group>

            {/* 노 (Oars) - 우측 */}
            <group ref={oar2Ref} position={[0.5, 0.4, 1]} rotation={[0, 0, -Math.PI / 4]}>
                <mesh>
                    <cylinderGeometry args={[0.05, 0.05, 3, 16]} />
                    <meshStandardMaterial {...woodMaterialProps} />
                </mesh>
                <mesh position={[0, -1.5, 0]}>
                    <boxGeometry args={[0.1, 0.6, 0.4]} />
                    <meshStandardMaterial {...woodMaterialProps} />
                </mesh>
            </group>

            {/* 돛대 (선택적 - 우주 나룻배 느낌 유지) */}
            <mesh position={[0, 0.5, 0]}>
                <cylinderGeometry args={[0.02, 0.02, 1.2, 8]} />
                <meshStandardMaterial
                    color="#654321"
                    metalness={0.5}
                    roughness={0.5}
                />
            </mesh>

            {/* 메인 돛 */}
            <mesh position={[0, 0.8, -0.2]} rotation={[0, 0, 0.1]}>
                <planeGeometry args={[0.6, 0.8]} />
                <meshStandardMaterial
                    color="#F5F5DC"
                    transparent
                    opacity={0.9}
                    side={THREE.DoubleSide}
                />
            </mesh>

            {/* 작은 돛 (앞쪽) */}
            <mesh position={[0, 0.6, 0.6]} rotation={[0, 0, -0.15]}>
                <planeGeometry args={[0.4, 0.5]} />
                <meshStandardMaterial
                    color="#FFFACD"
                    transparent
                    opacity={0.85}
                    side={THREE.DoubleSide}
                />
            </mesh>

            {/* 깃발 */}
            <mesh position={[0, 1.2, 0]} rotation={[0, 0, 0]}>
                <planeGeometry args={[0.3, 0.4]} />
                <meshStandardMaterial
                    color="#FF0000"
                    side={THREE.DoubleSide}
                />
            </mesh>
        </group>
    );
}

// 1인칭 카메라 컨트롤러
function FirstPersonCamera({ 
    cameraRef, 
    boatRef 
}: { 
    cameraRef: React.RefObject<THREE.Group>; 
    boatRef: React.RefObject<THREE.Group> 
}) {
    const { camera } = useThree();
    const lookEuler = useRef(new THREE.Euler(0, 0, 0, 'YXZ'));
    const PI_2 = Math.PI / 2;
    const sensitivity = 0.003; // 마우스 감도
    const isPointerLocked = useRef(false);

    useEffect(() => {
        if (!camera) return;

        // 초기 룩어라운드 회전 설정
        lookEuler.current.set(0, 0, 0, 'YXZ');
        
        // 포인터 락 요청
        const requestPointerLock = () => {
            const canvas = document.querySelector('canvas');
            if (canvas) {
                canvas.requestPointerLock = canvas.requestPointerLock || 
                    (canvas as any).mozRequestPointerLock || 
                    (canvas as any).webkitRequestPointerLock;
                canvas.requestPointerLock();
            }
        };

        // 포인터 락 상태 변경 감지
        const onPointerLockChange = () => {
            isPointerLocked.current = document.pointerLockElement !== null;
        };

        const onPointerLockError = () => {
            console.warn('Pointer lock failed');
        };

        // 포인터 락 이벤트 리스너
        document.addEventListener('pointerlockchange', onPointerLockChange);
        document.addEventListener('mozpointerlockchange', onPointerLockChange);
        document.addEventListener('webkitpointerlockchange', onPointerLockChange);
        document.addEventListener('pointerlockerror', onPointerLockError);

        // 마우스 움직임 처리 (포인터 락 사용)
        const onMouseMove = (event: MouseEvent) => {
            if (!cameraRef.current || !boatRef.current || !isPointerLocked.current || !camera) return;

            // 포인터 락 모드에서는 movementX/Y 사용
            // movementX/Y가 undefined일 수 있으므로 안전하게 처리
            const movementX = event.movementX ?? (event as any).mozMovementX ?? (event as any).webkitMovementX ?? 0;
            const movementY = event.movementY ?? (event as any).mozMovementY ?? (event as any).webkitMovementY ?? 0;
            
            const deltaX = movementX * sensitivity;
            const deltaY = movementY * sensitivity;

            // 룩어라운드 회전 누적 (상대 회전)
            lookEuler.current.y -= deltaX;
            lookEuler.current.x -= deltaY;
            lookEuler.current.x = Math.max(-PI_2, Math.min(PI_2, lookEuler.current.x));
        };

        // 마우스 움직임 감지
        document.addEventListener('mousemove', onMouseMove);

        // 클릭 시 포인터 락 활성화
        const canvas = document.querySelector('canvas');
        const handleCanvasClick = () => {
            requestPointerLock();
        };
        
        if (canvas) {
            canvas.addEventListener('click', handleCanvasClick);
        }

        // 초기 포인터 락 시도
        requestPointerLock();

        return () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('pointerlockchange', onPointerLockChange);
            document.removeEventListener('mozpointerlockchange', onPointerLockChange);
            document.removeEventListener('webkitpointerlockchange', onPointerLockChange);
            document.removeEventListener('pointerlockerror', onPointerLockError);
            if (canvas) {
                canvas.removeEventListener('click', handleCanvasClick);
            }
            // 포인터 락 해제
            if (document.pointerLockElement) {
                document.exitPointerLock();
            }
        };
    }, [cameraRef, boatRef, camera]);

    useFrame(() => {
        if (cameraRef.current && boatRef.current && camera) {
            // 카메라 위치는 나룻배에 고정
            camera.position.copy(cameraRef.current.position);
            
            // 카메라 회전 = 나룻배 회전 + 마우스 룩어라운드 회전
            const boatQuaternion = boatRef.current.quaternion.clone();
            const lookQuaternion = new THREE.Quaternion().setFromEuler(lookEuler.current);
            
            // 나룻배의 회전에 룩어라운드 회전을 곱함 (나룻배 회전을 먼저 적용)
            camera.quaternion.copy(boatQuaternion.multiply(lookQuaternion));
        }
    });

    return null;
}

// 태양 컴포넌트 (밝은 광원)
function Sun({ position }: { position: [number, number, number] }) {
    const sunRef = useRef<THREE.Mesh>(null);
    const glowRef = useRef<THREE.Mesh>(null);
    
    // 태양 회전 애니메이션
    useFrame(() => {
        if (sunRef.current) {
            sunRef.current.rotation.y += 0.001;
        }
        if (glowRef.current) {
            glowRef.current.rotation.y -= 0.0005;
        }
    });

    return (
        <group position={position}>
            {/* 태양 외부 발광 효과 (더 큰 구체) */}
            <mesh ref={glowRef}>
                <sphereGeometry args={[8, 32, 32]} />
                <meshBasicMaterial
                    color="#ffaa00"
                    transparent
                    opacity={0.3}
                    side={THREE.BackSide}
                />
            </mesh>
            
            {/* 태양 본체 */}
            <mesh ref={sunRef}>
                <sphereGeometry args={[6, 32, 32]} />
                <meshBasicMaterial
                    color="#ffdd00"
                    emissive="#ffaa00"
                    emissiveIntensity={2}
                />
            </mesh>
            
            {/* 태양 코로나 효과 (입자) */}
            <Sparkles
                count={200}
                scale={15}
                size={3}
                speed={0.4}
                opacity={0.8}
                color="#ffaa00"
                position={[0, 0, 0]}
            />
            
            {/* 태양에서 나오는 강한 조명 (주 광원) */}
            <pointLight
                position={[0, 0, 0]}
                intensity={3}
                color="#ffdd00"
                distance={500}
                decay={1}
            />
            
            {/* 태양에서 나오는 방향성 조명 (더 넓은 범위) */}
            <directionalLight
                position={[0, 0, 0]}
                intensity={2}
                color="#ffdd00"
                castShadow={false}
            />
        </group>
    );
}

// 나룻배 씬 메인 컴포넌트
export function FerryBoatScene({ onExit }: { onExit: () => void }) {
    const cameraRef = useRef<THREE.Group>(null);
    const boatRef = useRef<THREE.Group>(null);

    // ESC 키로 나가기 및 마우스 스크롤 방지
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                // 포인터 락 해제
                if (document.pointerLockElement) {
                    document.exitPointerLock();
                }
                onExit();
            }
        };

        // 마우스 스크롤 방지 (씬 진입 시 즉시 적용)
        const handleWheel = (event: WheelEvent) => {
            event.preventDefault();
            event.stopPropagation();
        };

        // html과 body 모두에 스크롤바 숨기기 및 스크롤 방지
        const html = document.documentElement;
        const body = document.body;
        
        const originalHtmlOverflow = html.style.overflow;
        const originalHtmlHeight = html.style.height;
        const originalBodyOverflow = body.style.overflow;
        const originalBodyHeight = body.style.height;
        const originalBodyPosition = body.style.position;
        
        // html과 body 모두에 스크롤 방지 적용
        html.style.overflow = 'hidden';
        html.style.height = '100%';
        body.style.overflow = 'hidden';
        body.style.height = '100%';
        body.style.position = 'fixed';
        body.style.width = '100%';

        // 스크롤 방지 즉시 적용
        document.addEventListener('wheel', handleWheel, { passive: false });
        document.addEventListener('touchmove', handleWheel, { passive: false });
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('wheel', handleWheel);
            document.removeEventListener('touchmove', handleWheel);
            document.removeEventListener('keydown', handleKeyDown);
            
            // 원래 스타일 복원
            html.style.overflow = originalHtmlOverflow;
            html.style.height = originalHtmlHeight;
            body.style.overflow = originalBodyOverflow;
            body.style.height = originalBodyHeight;
            body.style.position = originalBodyPosition;
            body.style.width = '';
        };
    }, [onExit]);

    return (
        <div 
            className="w-full h-full relative bg-black" 
            style={{ 
                overflow: 'hidden',
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                zIndex: 9999,
                cursor: 'none'
            }}
        >
            {/* 나가기 버튼 */}
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    onExit();
                }}
                className="absolute top-6 right-6 z-50 w-10 h-10 rounded-full bg-white/5 backdrop-blur-md border border-white/10 text-white/80 hover:bg-white/10 hover:text-white transition-all flex items-center justify-center"
                title="나가기 (우주차원 레벨 1로 복귀)"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4h8v16H4V4z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4l6 6M4 20l6-6" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4h8v16h-8" />
                    <circle cx="10" cy="12" r="1" fill="currentColor" />
                </svg>
            </button>

            {/* 안내 메시지 */}
            <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-40 pointer-events-none">
                <div className="bg-black/50 backdrop-blur-sm px-6 py-3 rounded-full border border-white/10 text-white/70 text-sm flex items-center gap-4 shadow-lg">
                    <span className="flex flex-col items-center gap-1">
                        <span className="px-1.5 py-0.5 bg-white/10 rounded text-xs font-mono border border-white/20">CLICK</span>
                        <span>Lock Cursor</span>
                    </span>
                    <span className="w-px h-6 bg-white/20"></span>
                    <span className="flex flex-col items-center gap-1">
                        <span className="px-1.5 py-0.5 bg-white/10 rounded text-xs font-mono border border-white/20">MOUSE</span>
                        <span>Look Around</span>
                    </span>
                    <span className="w-px h-6 bg-white/20"></span>
                    <span className="flex flex-col items-center gap-1">
                        <span className="px-1.5 py-0.5 bg-white/10 rounded text-xs font-mono border border-white/20">ESC</span>
                        <span>Exit</span>
                    </span>
                </div>
            </div>

            {/* UI Overlay */}
            <div className="absolute top-8 left-8 text-white/50 pointer-events-none">
                <h1 className="text-2xl font-light tracking-[0.2em] mb-1 text-white/80">Ferry Boat Journey</h1>
                <p className="text-xs font-mono tracking-widest">우주를 유영하는 나룻배</p>
            </div>

            <Canvas 
                dpr={[1, 2]} 
                camera={{ position: [0, 0, 0], fov: 75 }}
                style={{ cursor: 'none' }}
            >
                {/* 우주 배경색 */}
                <color attach="background" args={['#000011']} />

                {/* 우주 별들 */}
                <Stars 
                    radius={200} 
                    depth={100} 
                    count={10000} 
                    factor={4} 
                    saturation={0.5} 
                    fade 
                    speed={0.3}
                />

                {/* 밝은 태양 (주 광원) - 우주 멀리 떨어진 곳에 배치 */}
                <Sun position={[0, 50, -100]} />

                {/* 우주 환경 조명 (태양 광원 보조) */}
                <ambientLight intensity={0.6} color="#ffeedd" />
                <pointLight position={[50, 50, 50]} intensity={0.5} color="#ffdd00" />
                <pointLight position={[-50, 30, -50]} intensity={0.4} color="#ffaa00" />
                <directionalLight position={[0, 50, -100]} intensity={1.5} color="#ffdd00" />

                {/* 카메라 그룹 (나룻배에 부착될 카메라) */}
                <group ref={cameraRef} />

                {/* 나룻배 */}
                <FerryBoat cameraRef={cameraRef} boatRef={boatRef} />

                {/* 1인칭 카메라 컨트롤러 */}
                <FirstPersonCamera cameraRef={cameraRef} boatRef={boatRef} />
            </Canvas>
        </div>
    );
}


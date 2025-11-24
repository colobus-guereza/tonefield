"use client";

import { useEffect, useState, useRef } from "react";
import Spline3DScene from "../../Spline3DScene";

export function SndStoreScene({ onExit, onFerryBoat }: { onExit: () => void; onFerryBoat?: () => void }) {
    const [isMounted, setIsMounted] = useState(false);

    // 컴포넌트가 마운트된 후에만 Spline을 렌더링하여 기존 Canvas와의 충돌 방지
    useEffect(() => {
        // 여러 프레임을 기다려서 기존 Canvas가 완전히 언마운트된 후 Spline을 렌더링
        let frameCount = 0;
        const maxFrames = 3; // 3프레임 대기 (약 50ms)

        const checkFrame = () => {
            frameCount++;
            if (frameCount >= maxFrames) {
                setIsMounted(true);
            } else {
                requestAnimationFrame(checkFrame);
            }
        };

        requestAnimationFrame(checkFrame);

        return () => {
            setIsMounted(false);
        };
    }, []);

    const splineRef = useRef<any>(null);
    const cabezaRef = useRef<any>(null);
    const cuerpoRef = useRef<any>(null);
    const mousePos = useRef({ x: 0, y: 0 });
    const lastMouseMove = useRef<number>(Date.now());
    const isIdleMode = useRef<boolean>(true);
    const isMouseMoving = useRef<boolean>(false);
    const animationFrameRef = useRef<number | null>(null);
    const cuerpoInitialY = useRef<number>(0);
    const targetRotation = useRef({ y: 0, x: 0 }); // 목표 회전값 저장

    function onLoad(splineApp: any) {
        splineRef.current = splineApp;
        console.log('Spline loaded:', splineApp);

        // 객체 참조 저장
        cabezaRef.current = splineApp.findObjectByName('Cabeza');
        cuerpoRef.current = splineApp.findObjectByName('Cuerpo');

        if (cabezaRef.current) {
            console.log('✅ Cabeza found');
            // 초기 회전값 저장
            targetRotation.current = {
                y: cabezaRef.current.rotation.y,
                x: cabezaRef.current.rotation.x
            };
        }
        if (cuerpoRef.current) {
            console.log('✅ Cuerpo found');
            // Cuerpo의 초기 Y 위치 저장
            cuerpoInitialY.current = cuerpoRef.current.position.y;
        }

        // Idle 애니메이션 시작
        startIdleAnimation();
    }

    // 마우스 움직임 추적
    useEffect(() => {
        let mouseMoveTimeout: NodeJS.Timeout | null = null;

        const handleMouseMove = (e: MouseEvent) => {
            // 화면 중앙을 기준으로 -1 ~ 1 범위로 정규화
            mousePos.current = {
                x: (e.clientX / window.innerWidth) * 2 - 1,
                y: -(e.clientY / window.innerHeight) * 2 + 1
            };

            // 마우스가 움직이는 중
            isMouseMoving.current = true;
            lastMouseMove.current = Date.now();
            isIdleMode.current = false;

            // 마우스 움직임이 멈췄는지 감지 (100ms 동안 움직임 없으면 멈춘 것으로 간주)
            if (mouseMoveTimeout) {
                clearTimeout(mouseMoveTimeout);
            }
            mouseMoveTimeout = setTimeout(() => {
                isMouseMoving.current = false;
                // 마우스가 멈추면 현재 회전값을 목표값으로 고정
                if (cabezaRef.current) {
                    targetRotation.current = {
                        y: cabezaRef.current.rotation.y,
                        x: cabezaRef.current.rotation.x
                    };
                }
            }, 100);
        };

        window.addEventListener('mousemove', handleMouseMove);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            if (mouseMoveTimeout) {
                clearTimeout(mouseMoveTimeout);
            }
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, []);

    // Idle 애니메이션 (상태 기반)
    const startIdleAnimation = () => {
        let time = 0;

        const animate = () => {
            time += 0.016; // ~60fps

            // 마우스가 2초 이상 멈췄는지 확인
            const timeSinceLastMove = Date.now() - lastMouseMove.current;
            if (timeSinceLastMove > 2000 && !isIdleMode.current) {
                isIdleMode.current = true;
            }

            // Cabeza (머리) - 상태에 따라 다른 동작
            if (cabezaRef.current) {
                if (isIdleMode.current) {
                    // Idle 모드: 더 큰 움직임으로 자연스러운 룩어라운드
                    const idleY = Math.sin(time * 0.3) * 0.15 + Math.sin(time * 0.7) * 0.08;
                    const idleX = Math.cos(time * 0.4) * 0.1 + Math.sin(time * 0.9) * 0.05;
                    const idleZ = Math.sin(time * 0.5) * 0.06;

                    // 부드럽게 Idle 상태로 전환
                    cabezaRef.current.rotation.y += (idleY - cabezaRef.current.rotation.y) * 0.03;
                    cabezaRef.current.rotation.x += (idleX - cabezaRef.current.rotation.x) * 0.03;
                    cabezaRef.current.rotation.z += (idleZ - cabezaRef.current.rotation.z) * 0.03;
                } else if (isMouseMoving.current) {
                    // 커서 추적 모드: 마우스가 실제로 움직일 때만 목표값 업데이트
                    targetRotation.current = {
                        y: mousePos.current.x * 0.4,
                        x: mousePos.current.y * 0.3
                    };

                    // 목표값을 향해 부드럽게 이동
                    cabezaRef.current.rotation.y += (targetRotation.current.y - cabezaRef.current.rotation.y) * 0.2;
                    cabezaRef.current.rotation.x += (targetRotation.current.x - cabezaRef.current.rotation.x) * 0.2;
                }
                // else: 마우스가 멈춘 상태 - 완전히 정지 (아무것도 하지 않음)
            }

            // Cuerpo (몸) - 항상 숨쉬기 효과
            if (cuerpoRef.current) {
                // 숨쉬기 (느린 상하 움직임) - 초기 위치 기준
                const breathingY = Math.sin(time * 0.6) * 0.03; // 조금 더 큰 움직임

                // 미세한 좌우 흔들림
                const swayX = Math.sin(time * 0.35) * 0.015;
                const swayZ = Math.cos(time * 0.45) * 0.012;

                // 초기 위치 기준으로 움직임 적용
                const targetY = cuerpoInitialY.current + breathingY;
                cuerpoRef.current.position.y += (targetY - cuerpoRef.current.position.y) * 0.08;
                cuerpoRef.current.rotation.z += (swayZ - cuerpoRef.current.rotation.z) * 0.06;
                cuerpoRef.current.rotation.x += (swayX - cuerpoRef.current.rotation.x) * 0.06;
            }

            animationFrameRef.current = requestAnimationFrame(animate);
        };

        animate();
    };

    return (
        <div className="w-full h-full relative bg-black">
            <button onClick={onExit} className="absolute top-6 right-6 z-50 w-10 h-10 rounded-full bg-white/5 backdrop-blur-md border border-white/10 text-white/80 hover:bg-white/10 hover:text-white transition-all flex items-center justify-center" title="나가기">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>

            {/* Spline 3D 씬만 렌더링 - 마운트된 후에만 렌더링 */}
            {isMounted && (
                <div className="absolute inset-0">
                    <Spline3DScene
                        key="spline-scene"
                        sceneUrl="https://prod.spline.design/uPwoQmk-wHzflf13/scene.splinecode"
                        width="100%"
                        height="100%"
                        onLoad={onLoad}
                    />
                </div>
            )}
        </div>
    );
}

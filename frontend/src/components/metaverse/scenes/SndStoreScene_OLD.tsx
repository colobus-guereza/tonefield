"use client";

import { Canvas } from "@react-three/fiber";
import { Center, RoundedBox, Stars } from "@react-three/drei";
import * as THREE from "three";
import { Player } from "../objects/Player";
import SpacePterosaur from "../objects/SpacePterosaur";

// 간단한 책상 컴포넌트
function Desk({ position }: { position: [number, number, number] }) {
    return (
        <group position={position}>
            {/* 책상 상판 */}
            <mesh position={[0, 0.4, 0]}>
                <boxGeometry args={[2, 0.05, 1]} />
                <meshStandardMaterial color="#8B4513" roughness={0.6} />
            </mesh>
            {/* 책상 다리 4개 */}
            <mesh position={[-0.9, 0.2, -0.4]}>
                <boxGeometry args={[0.05, 0.4, 0.05]} />
                <meshStandardMaterial color="#654321" />
            </mesh>
            <mesh position={[0.9, 0.2, -0.4]}>
                <boxGeometry args={[0.05, 0.4, 0.05]} />
                <meshStandardMaterial color="#654321" />
            </mesh>
            <mesh position={[-0.9, 0.2, 0.4]}>
                <boxGeometry args={[0.05, 0.4, 0.05]} />
                <meshStandardMaterial color="#654321" />
            </mesh>
            <mesh position={[0.9, 0.2, 0.4]}>
                <boxGeometry args={[0.05, 0.4, 0.05]} />
                <meshStandardMaterial color="#654321" />
            </mesh>
        </group>
    );
}

// 간단한 의자 컴포넌트
function Chair({ position }: { position: [number, number, number] }) {
    return (
        <group position={position}>
            {/* 의자 좌석 */}
            <RoundedBox args={[0.5, 0.05, 0.5]} radius={0.02} position={[0, 0.25, 0]}>
                <meshStandardMaterial color="#4a4a4a" />
            </RoundedBox>
            {/* 의자 등받이 */}
            <mesh position={[0, 0.5, -0.2]}>
                <boxGeometry args={[0.5, 0.5, 0.05]} />
                <meshStandardMaterial color="#4a4a4a" />
            </mesh>
            {/* 의자 다리 4개 */}
            <mesh position={[-0.2, 0.1, -0.2]}>
                <cylinderGeometry args={[0.02, 0.02, 0.2]} />
                <meshStandardMaterial color="#333" />
            </mesh>
            <mesh position={[0.2, 0.1, -0.2]}>
                <cylinderGeometry args={[0.02, 0.02, 0.2]} />
                <meshStandardMaterial color="#333" />
            </mesh>
            <mesh position={[-0.2, 0.1, 0.2]}>
                <cylinderGeometry args={[0.02, 0.02, 0.2]} />
                <meshStandardMaterial color="#333" />
            </mesh>
            <mesh position={[0.2, 0.1, 0.2]}>
                <cylinderGeometry args={[0.02, 0.02, 0.2]} />
                <meshStandardMaterial color="#333" />
            </mesh>
        </group>
    );
}

// 도시 배경 컴포넌트
function CityBackground() {
    const buildings = [];
    for (let i = 0; i < 20; i++) {
        const width = 0.3 + Math.random() * 0.4;
        const height = 1 + Math.random() * 3;
        const x = -5 + i * 0.5;
        buildings.push(
            <mesh key={i} position={[x, height / 2, -8]}>
                <boxGeometry args={[width, height, 0.1]} />
                <meshStandardMaterial color={`#${Math.floor(Math.random() * 0x333333 + 0x333333).toString(16)}`} />
            </mesh>
        );
    }
    return <group>{buildings}</group>;
}

// Snd 오프라인 매장 (메타버스 공간) - 최적화된 우주 라운지 버전 (FPS 모드)
export function SndStoreScene({ onExit, onFerryBoat }: { onExit: () => void; onFerryBoat?: () => void }) {
    return (
        <div className="w-full h-full relative bg-black">
            {/* Ferry Boat Button */}
            <button
                onClick={() => {
                    // 나룻배 버튼 클릭 시 나룻배 씬으로 전환
                    if (onFerryBoat) {
                        onFerryBoat();
                    }
                }}
                className="absolute top-6 right-20 z-50 w-10 h-10 rounded-full bg-white/5 backdrop-blur-md border border-white/10 text-white/80 hover:bg-white/10 hover:text-white transition-all flex items-center justify-center"
                title="나룻배 타고 우주 여행"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    {/* 깃발 아이콘 - 국기 모양 */}
                    {/* 깃발 막대 (짧게) */}
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 3v8" />
                    {/* 깃발 (넓은 직사각형 형태) */}
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 3h12v6H4z" fill="currentColor" />
                </svg>
            </button>

            {/* Exit Button */}
            <button
                onClick={onExit}
                className="absolute top-6 right-6 z-50 w-10 h-10 rounded-full bg-white/5 backdrop-blur-md border border-white/10 text-white/80 hover:bg-white/10 hover:text-white transition-all flex items-center justify-center"
                title="나가기 (ESC 후 클릭)"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    {/* 열린 문 아이콘 */}
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4h8v16H4V4z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4l6 6M4 20l6-6" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4h8v16h-8" />
                    <circle cx="10" cy="12" r="1" fill="currentColor" />
                </svg>
            </button>

            {/* Control Instructions Overlay */}
            <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-40 pointer-events-none">
                <div className="bg-black/50 backdrop-blur-sm px-6 py-3 rounded-full border border-white/10 text-white/70 text-sm flex items-center gap-4 shadow-lg">
                    <span className="flex flex-col items-center gap-1">
                        <span className="px-1.5 py-0.5 bg-white/10 rounded text-xs font-mono border border-white/20">CLICK</span>
                        <span>to Start</span>
                    </span>
                    <span className="w-px h-6 bg-white/20"></span>
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
                        <span className="px-1.5 py-0.5 bg-white/10 rounded text-xs font-mono border border-white/20">ESC</span>
                        <span>Exit Control</span>
                    </span>
                </div>
            </div>

            <Canvas dpr={[1, 2]} camera={{ position: [0, 1.5, 5], fov: 50 }}>

                {/* 우주 배경색 */}
                <color attach="background" args={['#000011']} />

                {/* 우주 별들 */}
                <Stars 
                    radius={100} 
                    depth={50} 
                    count={5000} 
                    factor={4} 
                    saturation={0.5} 
                    fade 
                    speed={0.5}
                />

                {/* 우주 환경 조명 */}
                <ambientLight intensity={0.6} color="#ffffff" />
                <pointLight position={[10, 10, 10]} intensity={1.0} color="#ffffff" />
                <pointLight position={[-10, 5, -10]} intensity={0.8} color="#00aaff" />
                <pointLight position={[0, 20, 0]} intensity={0.5} color="#ffffff" />
                <directionalLight position={[5, 10, 5]} intensity={0.8} color="#ffffff" />

                {/* 우주 익룡 - 우주선 옆에 고정 배치 (우주선 위치: [0, 2, 0], 스케일: 0.03) */}
                <SpacePterosaur position={[0.15, 2, 0]} scale={2.5} speed={0.6} />

                {/* 도시 배경 (우주에서 멀리 보이는 느낌) */}
                <CityBackground />

                {/* 사무실 공간 */}
                <Center>
                    <group>
                        {/* 책상 */}
                        <Desk position={[0, 0, 0]} />
                        {/* 의자 */}
                        <Chair position={[0, 0, 0.6]} />
                    </group>
                </Center>

                {/* 사무실 바닥 (카펫) */}
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
                    <planeGeometry args={[10, 10]} />
                    <meshStandardMaterial color="#c8a882" roughness={0.9} />
                </mesh>

                {/* 사무실 벽 (뒤쪽) */}
                <mesh position={[0, 2.5, -5]}>
                    <planeGeometry args={[10, 5]} />
                    <meshStandardMaterial color="#f5f5dc" />
                </mesh>

                {/* 창문 (도시가 보이는) */}
                <mesh position={[0, 2.5, -4.99]}>
                    <planeGeometry args={[4, 2.5]} />
                    <meshStandardMaterial color="#87ceeb" transparent opacity={0.3} />
                </mesh>
                {/* 창문 프레임 */}
                <mesh position={[0, 2.5, -4.98]}>
                    <boxGeometry args={[4.2, 2.7, 0.1]} />
                    <meshStandardMaterial color="#8B7355" />
                </mesh>
                <mesh position={[0, 2.5, -4.98]}>
                    <boxGeometry args={[0.1, 2.7, 0.1]} />
                    <meshStandardMaterial color="#8B7355" />
                </mesh>

                {/* FPS 플레이어 컨트롤 */}
                <Player />

            </Canvas>

            {/* UI Overlay */}
            <div className="absolute bottom-8 left-8 text-white/50 pointer-events-none">
                <h1 className="text-2xl font-light tracking-[0.2em] mb-1 text-white/80">Snd VOID</h1>
                <p className="text-xs font-mono tracking-widest">FPS MODE ACTIVATED</p>
            </div>
        </div>
    );
}

"use client";

import { useEffect, useState } from "react";
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
                    />
                </div>
            )}
        </div>
    );
}

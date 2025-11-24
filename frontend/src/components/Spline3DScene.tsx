"use client";

import Spline from '@splinetool/react-spline';

interface Spline3DSceneProps {
    sceneUrl: string;
    width?: string;
    height?: string;
    className?: string;
}

export default function Spline3DScene({
    sceneUrl,
    width = '100%',
    height = '500px',
    className = '',
    onLoad
}: Spline3DSceneProps & { onLoad?: (spline: any) => void }) {
    return (
        <div
            style={{
                width,
                height,
                position: 'relative'
            }}
            className={className}
        >
            <Spline scene={sceneUrl} onLoad={onLoad} />
        </div>
    );
}



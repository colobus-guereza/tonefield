"use client";

import { ToneField3D } from "@/components/ToneField3D";
import { useState } from "react";

export default function EmbedPage() {
  // URL 파라미터에서 설정 읽기
  const [params] = useState(() => {
    if (typeof window === 'undefined') return {};
    const urlParams = new URLSearchParams(window.location.search);
    return {
      tension: parseFloat(urlParams.get('tension') || '0.5'),
      wireframe: urlParams.get('wireframe') !== 'false',
      cameraView: (urlParams.get('cameraView') || 'top') as 'perspective' | 'top',
      hitPointLocation: urlParams.get('hitPointLocation') as "internal" | "external" | null,
      hitPointCoordinate: urlParams.get('hitPointCoordinate') || undefined,
      hitPointStrength: urlParams.get('hitPointStrength') || undefined,
      hitPointCount: urlParams.get('hitPointCount') || undefined,
      hammeringType: urlParams.get('hammeringType') || undefined,
    };
  });

  return (
    <div style={{ width: '100vw', height: '100vh', margin: 0, padding: 0 }}>
      <ToneField3D
        tension={params.tension}
        wireframe={params.wireframe}
        cameraView={params.cameraView}
        hitPointLocation={params.hitPointLocation}
        hitPointCoordinate={params.hitPointCoordinate}
        hitPointStrength={params.hitPointStrength}
        hitPointCount={params.hitPointCount}
        hammeringType={params.hammeringType}
        width="100%"
        height="100%"
      />
    </div>
  );
}


"use client";

import { ToneField } from "@/components/ToneField";

export default function Home() {
  return (
    <main className="relative w-full h-screen overflow-hidden text-white" style={{ backgroundColor: '#000000' }}>
      {/* 3D Scene Background */}
      <div className="absolute inset-0 z-0">
        <ToneField />
      </div>


    </main>
  );
}

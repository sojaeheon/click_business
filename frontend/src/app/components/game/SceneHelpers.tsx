/// <reference types="@react-three/fiber" />
import React, { useRef, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { SHARED_STATE, CONFIG } from "./constants";

// ─── WorldBounds: 카메라 자동 팔로우 + 이동 제한 ──────────────
export function WorldBounds({ autoCamera = true }: { autoCamera?: boolean }) {
    const { controls, camera } = useThree();
    useFrame(() => {
        if (!controls) return;
        const limit = CONFIG.CAMERA.boundLimit;
        // @ts-ignore
        const t = controls.target;
        if (!t) return;
        if (autoCamera && camera.zoom > CONFIG.CAMERA.minZoom + 1) {
            t.lerp(SHARED_STATE.playerPos, 0.05);
        }
        // 주의: controls.update() 호출 ❌ - MapControls 자체 loop와 충돌
        t.x = THREE.MathUtils.clamp(t.x, -limit, limit);
        t.z = THREE.MathUtils.clamp(t.z, -limit, limit);
    });
    return null;
}

// ─── WaterPlane: 로우폴리 파도 애니메이션 ──────────────────────
// geometry를 useMemo로 직접 생성해서 ref 없이 useFrame에서 직접 조작
export function WaterPlane() {
    const meshRef = useRef<THREE.Mesh>(null);
    const GRID = 40;
    const SIZE = 300;

    // geometry를 직접 생성 (ref 대신 useMemo)
    const geometry = useMemo(() => {
        return new THREE.PlaneGeometry(SIZE, SIZE, GRID, GRID);
    }, []);

    useFrame(({ clock }) => {
        if (!meshRef.current) return;
        const geo = meshRef.current.geometry as THREE.PlaneGeometry;
        const pos = geo.attributes.position as THREE.BufferAttribute;
        const t = clock.getElapsedTime();

        for (let i = 0; i <= GRID; i++) {
            for (let j = 0; j <= GRID; j++) {
                const idx = i * (GRID + 1) + j;
                const x = pos.getX(idx);
                const y = pos.getY(idx);
                const wave =
                    Math.sin(x * 0.15 + t * 0.8) * 0.3 +
                    Math.sin(y * 0.12 + t * 1.1) * 0.22 +
                    Math.sin((x + y) * 0.08 + t * 0.55) * 0.15;
                pos.setZ(idx, wave);
            }
        }
        pos.needsUpdate = true;
        geo.computeVertexNormals();
    });

    return (
        <mesh
            ref={meshRef}
            geometry={geometry}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, -0.5, 0]}
        >
            <meshStandardMaterial
                color="#1a70b0"
                transparent
                opacity={0.85}
                roughness={0.08}
                metalness={0.15}
            />
        </mesh>
    );
}

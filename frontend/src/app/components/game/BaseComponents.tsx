/// <reference types="@react-three/fiber" />
import React, { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

// ─── EnvModel: GLTF 모델 로더 (클론 + 그림자) ──────────────
export function EnvModel({
    url,
    position = [0, 0, 0],
    rotation = [0, 0, 0],
    scale = 1,
}: {
    url: string;
    position?: [number, number, number];
    rotation?: [number, number, number];
    scale?: number | [number, number, number];
}) {
    const { scene } = useGLTF(url);
    const cloned = useMemo(() => {
        const c = scene.clone(true);
        c.traverse((child: any) => {
            if ((child as THREE.Mesh).isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                const mat = child.material as THREE.MeshStandardMaterial;
                if (mat?.color && mat.color.r === 1 && mat.color.g === 1 && mat.color.b === 1 && !mat.map) {
                    mat.color.set("#c0a060");
                }
            }
        });
        return c;
    }, [scene]);
    return <primitive object={cloned} position={position} rotation={rotation} scale={scale} />;
}

// ─── HoverableGroup: hover 시 커서 변경 + 클릭 ──────────────
export function HoverableGroup({ children, onClick, ...props }: any) {
    return (
        <group
            {...props}
            onPointerOver={(e: any) => { e.stopPropagation(); document.body.style.cursor = "pointer"; }}
            onPointerOut={(e: any) => { e.stopPropagation(); document.body.style.cursor = "auto"; }}
            onClick={(e: any) => { e.stopPropagation(); if (onClick) onClick(); }}
        >
            {children}
        </group>
    );
}

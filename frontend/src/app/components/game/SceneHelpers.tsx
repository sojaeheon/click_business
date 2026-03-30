/// <reference types="@react-three/fiber" />
import React, { useRef, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { SHARED_STATE, CONFIG } from "./constants";

// ─── WorldBounds: 카메라 화면 이탈 제한 ──────────────
export function WorldBounds() {
    const { controls } = useThree();
    useFrame(() => {
        if (!controls) return;
        const limit = CONFIG.CAMERA.boundLimit;
        // @ts-ignore
        const t = controls.target;
        if (!t) return;

        // 🚨 카메라 트래킹(캐릭터 따라가기) 로직 완전 삭제 (유저 스크롤/드래그 씹힘 방지) 🚨

        // 주의: controls.update() 호출 ❌ - MapControls 자체 loop와 충돌
        t.x = THREE.MathUtils.clamp(t.x, -limit, limit);
        t.z = THREE.MathUtils.clamp(t.z, -limit, limit);
    });
    return null;
}



import React from 'react'
import { useGLTF, useAnimations } from '@react-three/drei'

export function ConveyorBelt({ isAnimating = false, ...props }) {
  const group = React.useRef()

  const { nodes, materials, animations } = useGLTF('/models/props/animated_conveyer_belt.glb?v=2')
  const { actions } = useAnimations(animations, group)

  React.useEffect(() => {
    console.log("ConveyorBelt nodes keys:", Object.keys(nodes));
    const actionName = Object.keys(actions)[0];
    if (!actionName || !actions[actionName]) return;
    if (isAnimating) {
      actions[actionName].reset().play();
    } else {
      actions[actionName].stop();
    }
  }, [actions, isAnimating]);

  return (
    <group ref={group} {...props} dispose={null}>
      <group name="Sketchfab_Scene">
        <group name="Sketchfab_model" rotation={[-Math.PI / 2, 0, 0]}>
          <group name="conveyer_belt_fbx" rotation={[Math.PI / 2, 0, 0]} scale={0.01}>
            <group name="Object_2">
              <group name="RootNode">
                <group name="Cube003" position={[452.534, 111.173, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={36.989}>
                  {(nodes.Cube003_Material007_0?.geometry || nodes['Gold_Bar']?.geometry) && <mesh position={[0, 0, 0.8]} name="Cube003_Material007_0" geometry={nodes.Cube003_Material007_0?.geometry || nodes['Gold_Bar']?.geometry} material={(materials['resource'] || materials['Material.007'])} />}
                </group>
                <group name="Cube004" position={[452.534, 111.173, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={36.989}>
                  {nodes.Cube004_Material007_0?.geometry && <mesh position={[0, 0, 0.8]} name="Cube004_Material007_0" geometry={nodes.Cube004_Material007_0.geometry} material={(materials['resource'] || materials['Material.007'])} />}
                </group>
                <group name="Cube005" position={[452.534, 111.173, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={36.989}>
                  {nodes.Cube005_Material007_0?.geometry && <mesh position={[0, 0, 0.8]} name="Cube005_Material007_0" geometry={nodes.Cube005_Material007_0.geometry} material={(materials['resource'] || materials['Material.007'])} />}
                </group>
                <group name="Cube002" position={[452.534, 111.173, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={36.989}>
                  {nodes.Cube002_Material007_0?.geometry && <mesh position={[0, 0, 0.8]} name="Cube002_Material007_0" geometry={nodes.Cube002_Material007_0.geometry} material={(materials['resource'] || materials['Material.007'])} />}
                </group>
                <group name="Cube010" position={[452.534, 111.173, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={36.989}>
                  {nodes.Cube010_Material007_0?.geometry && <mesh position={[0, 0, 0.8]} name="Cube010_Material007_0" geometry={nodes.Cube010_Material007_0.geometry} material={(materials['resource'] || materials['Material.007'])} />}
                </group>
                <group name="Plane001" rotation={[-Math.PI / 2, 0, 0]} scale={100}>
                  {nodes.Plane001_Material003_0?.geometry && <mesh name="Plane001_Material003_0" geometry={nodes.Plane001_Material003_0.geometry} material={materials['Material.003']} />}
                </group>
                <group name="Cube" position={[0, 52.461, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[322.35, 44.433, 44.308]}>
                  {nodes.Cube_Material004_0?.geometry && <mesh name="Cube_Material004_0" geometry={nodes.Cube_Material004_0.geometry} material={materials['Material.004']} />}
                </group>
                <group name="Cube001" position={[474.489, 124.114, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[100, 100, 126.921]}>
                  {nodes.Cube001_Material002_0?.geometry && <mesh name="Cube001_Material002_0" geometry={nodes.Cube001_Material002_0.geometry} material={materials['Material.002']} />}
                </group>
                <group name="Plane002" position={[154.749, -6.854, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={2425.458}>
                  {nodes.Plane002_Material009_0?.geometry && <mesh name="Plane002_Material009_0" geometry={nodes.Plane002_Material009_0.geometry} material={materials['Material.009']} />}
                </group>
                <group name="Cylinder" position={[-234.132, 43.029, -67.956]} scale={26.858}>
                  {nodes.Cylinder_Material005_0?.geometry && <mesh name="Cylinder_Material005_0" geometry={nodes.Cylinder_Material005_0.geometry} material={materials['Material.005']} />}
                </group>
                <group name="Cylinder001" position={[247.218, 43.029, -67.956]} scale={26.858}>
                  {nodes.Cylinder001_Material005_0?.geometry && <mesh name="Cylinder001_Material005_0" geometry={nodes.Cylinder001_Material005_0.geometry} material={materials['Material.005']} />}
                </group>

                <group name="Cylinder002" position={[246.499, 32.796, 143.644]} rotation={[-Math.PI / 2, 0, 0]} scale={[45.978, 45.978, 51.538]}>
                  {nodes.Cylinder002_Material005_0?.geometry && <mesh name="Cylinder002_Material005_0" geometry={nodes.Cylinder002_Material005_0.geometry} material={materials['Material.005']} />}
                </group>
                <group name="Cylinder003" position={[-234.885, 32.796, 143.644]} rotation={[-Math.PI / 2, 0, 0]} scale={[45.978, 45.978, 51.538]}>
                  {nodes.Cylinder003_Material005_0?.geometry && <mesh name="Cylinder003_Material005_0" geometry={nodes.Cylinder003_Material005_0.geometry} material={materials['Material.005']} />}
                </group>
                <group name="Cylinder004" position={[246.499, 32.796, -136.922]} rotation={[-Math.PI / 2, 0, 0]} scale={[45.978, 45.978, 51.538]}>
                  {nodes.Cylinder004_Material005_0?.geometry && <mesh name="Cylinder004_Material005_0" geometry={nodes.Cylinder004_Material005_0.geometry} material={materials['Material.005']} />}
                </group>
                <group name="Cylinder005" position={[-234.885, 32.796, -136.922]} rotation={[-Math.PI / 2, 0, 0]} scale={[45.978, 45.978, 51.538]}>
                  {nodes.Cylinder005_Material005_0?.geometry && <mesh name="Cylinder005_Material005_0" geometry={nodes.Cylinder005_Material005_0.geometry} material={materials['Material.005']} />}
                </group>
              </group>
            </group>
          </group>
        </group>
      </group>
    </group>
  )
}

useGLTF.preload('/models/props/animated_conveyer_belt.glb?v=2')
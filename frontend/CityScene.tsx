'use client';

import { Suspense, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { CameraControls, Environment, Grid, Stars } from '@react-three/drei';
import { Building } from './Building';
import { AccountMetrics, CommentData, PostData } from '@lib/types';

interface CitySceneProps {
  accounts: AccountMetrics[];
  pulsingAccounts: Record<string, boolean>;
  onHover: (account: AccountMetrics | null) => void;
  onFloorClick: (account: AccountMetrics, post: PostData, floorIndex: number) => void;
  onWindowClick: (account: AccountMetrics, post: PostData, comment: CommentData) => void;
}

export function CityScene({
  accounts,
  pulsingAccounts,
  onHover,
  onFloorClick,
  onWindowClick,
}: CitySceneProps) {
  const layout = useMemo(() => {
    const gap = 1000;

    return accounts.reduce<
      Array<{
        account: AccountMetrics;
        position: [number, number, number];
      }>
    >((items, account) => {
      const buildingWidth = Math.max(1, account.following);
      const previousItem = items[items.length - 1];
      const previousWidth = previousItem ? Math.max(1, previousItem.account.following) : 0;
      const xPosition = previousItem
        ? previousItem.position[0] + previousWidth / 2 + gap + buildingWidth / 2
        : 0;

      items.push({
        account,
        position: [xPosition, 0, 0],
      });

      return items;
    }, []);
  }, [accounts]);

  return (
    <Canvas
      camera={{ position: [5000, 5000, 5000], fov: 45, near: 1, far: 1e10 }}
      shadows
      gl={{ antialias: true, logarithmicDepthBuffer: true }}
    >
      <color attach="background" args={['#050510']} />
      <fog attach="fog" args={['#050510', 10000, 5e6]} />

      <ambientLight intensity={0.5} />
      <directionalLight position={[10000, 20000, 10000]} intensity={1} castShadow />
      <pointLight position={[-100, -100, -100]} intensity={0.2} color="#3b82f6" />

      <Suspense fallback={null}>
        <Environment preset="city" />
        <Stars
          radius={100000}
          depth={50000}
          count={5000}
          factor={4}
          saturation={0}
          fade
          speed={1}
        />

        <Grid
          renderOrder={-1}
          position={[0, -0.01, 0]}
          infiniteGrid
          cellSize={100}
          cellThickness={1}
          sectionSize={1000}
          sectionThickness={2}
          sectionColor="#0dccf2"
          cellColor="#0dccf2"
          fadeDistance={1000000}
          fadeStrength={10}
        />

        {layout.map((item) => (
          <Building
            key={item.account.username}
            account={item.account}
            pulseActive={Boolean(pulsingAccounts[item.account.accountKey])}
            position={item.position}
            onHover={onHover}
            onFloorClick={onFloorClick}
            onWindowClick={onWindowClick}
          />
        ))}

        <CameraControls
          maxPolarAngle={Math.PI / 2 - 0.05}
          minDistance={10}
          maxDistance={1e7}
          dollyToCursor={true}
          dollySpeed={0.4}
          infinityDolly={true}
          makeDefault
        />
      </Suspense>
    </Canvas>
  );
}

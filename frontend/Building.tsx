import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Color } from 'three';
import { buildInstagramMediaProxyUrl } from '@lib/instagramMedia';
import { AccountMetrics, CommentData, PostData } from '@lib/types';

interface BuildingProps {
  account: AccountMetrics;
  pulseActive: boolean;
  position: [number, number, number];
  onHover: (account: AccountMetrics | null) => void;
  onFloorClick: (account: AccountMetrics, post: PostData, floorIndex: number) => void;
  onWindowClick: (account: AccountMetrics, post: PostData, comment: CommentData) => void;
}

function getEntranceDelay(username: string): number {
  let hash = 0;

  for (let index = 0; index < username.length; index += 1) {
    hash = (hash * 31 + username.charCodeAt(index)) >>> 0;
  }

  return hash % 900;
}

function getPostPaintUrl(post: PostData): string | null {
  const leadCarouselAsset = post.carouselChildren[0];

  if (leadCarouselAsset) {
    if (leadCarouselAsset.mediaType === 'VIDEO') {
      return buildInstagramMediaProxyUrl(
        leadCarouselAsset.thumbnailUrl ?? leadCarouselAsset.mediaUrl
      );
    }

    return buildInstagramMediaProxyUrl(
      leadCarouselAsset.mediaUrl ?? leadCarouselAsset.thumbnailUrl
    );
  }

  if (post.mediaType === 'VIDEO') {
    return buildInstagramMediaProxyUrl(post.thumbnailUrl ?? post.mediaUrl);
  }

  return buildInstagramMediaProxyUrl(post.mediaUrl ?? post.thumbnailUrl);
}

function getPosterLaneWidth(width: number): number {
  return Math.max(width * 0.32, 0.9);
}

function getPosterMetrics(
  width: number,
  floorHeight: number,
  aspectRatio: number
) {
  const posterLaneWidth = getPosterLaneWidth(width);
  const edgeMargin = 0; // Remove edge margin to allow edge-to-edge posters
  const framePadding = 0; // Remove frame padding
  const maxFrameWidth = posterLaneWidth;
  const maxPosterWidth = maxFrameWidth;
  const maxPosterHeight = floorHeight * 0.72;
  const safeAspectRatio = aspectRatio > 0 ? aspectRatio : 1;

  let posterWidth = maxPosterWidth;
  let posterHeight = posterWidth / safeAspectRatio;

  if (posterHeight > maxPosterHeight) {
    posterHeight = maxPosterHeight;
    posterWidth = posterHeight * safeAspectRatio;
  }

  const frameWidth = posterWidth + framePadding * 2;
  const frameHeight = posterHeight + framePadding * 2;
  const laneCenterOffset = width / 2 - posterLaneWidth / 2;

  return {
    frameHeight,
    framePadding,
    frameWidth,
    laneCenterOffset,
    posterHeight,
    posterLaneWidth,
    posterWidth,
  };
}

function usePostPaintAsset(textureUrl: string | null): {
  aspectRatio: number;
  texture: THREE.Texture | null;
} {
  const [paintAsset, setPaintAsset] = useState<{
    aspectRatio: number;
    texture: THREE.Texture | null;
  }>({
    aspectRatio: 1,
    texture: null,
  });

  useEffect(() => {
    if (!textureUrl) {
      return;
    }

    let cancelled = false;
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');

    loader.load(
      textureUrl,
      (loadedTexture) => {
        if (cancelled) {
          return;
        }

        loadedTexture.colorSpace = THREE.SRGBColorSpace;
        loadedTexture.wrapS = THREE.ClampToEdgeWrapping;
        loadedTexture.wrapT = THREE.ClampToEdgeWrapping;
        loadedTexture.minFilter = THREE.LinearFilter;
        loadedTexture.magFilter = THREE.LinearFilter;
        const imageWidth =
          typeof loadedTexture.image?.width === 'number' ? loadedTexture.image.width : 1;
        const imageHeight =
          typeof loadedTexture.image?.height === 'number' ? loadedTexture.image.height : 1;
        setPaintAsset({
          aspectRatio: imageHeight > 0 ? imageWidth / imageHeight : 1,
          texture: loadedTexture,
        });
      },
      undefined,
      () => {
        if (!cancelled) {
          setPaintAsset({
            aspectRatio: 1,
            texture: null,
          });
        }
      }
    );

    return () => {
      cancelled = true;
    };
  }, [textureUrl]);

  return paintAsset;
}

export function Building({
  account,
  pulseActive,
  position,
  onHover,
  onFloorClick,
  onWindowClick,
}: BuildingProps) {
  const meshRef = useRef<THREE.Group>(null);
  const pulseLightRef = useRef<THREE.PointLight>(null);
  const [hoveredFloorKey, setHoveredFloorKey] = useState<string | null>(null);
  const [targetScale, setTargetScale] = useState(0);

  const totalHeight = account.followers;
  // Enforce a minimum width of 2% of total height or the 'following' count, 
  // whichever is greater, to prevent buildings from becoming invisible needles.
  const width = Math.max(1, account.following, totalHeight * 0.02);
  const floors = Math.max(1, account.posts);
  const gapRatio = 0.05;
  const gapHeightTotal = totalHeight * gapRatio;
  const singleGap = floors > 1 ? gapHeightTotal / (floors - 1) : 0;
  const floorHeight = (totalHeight - gapHeightTotal) / floors;
  const entranceDelay = useMemo(() => getEntranceDelay(account.username), [account.username]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setTargetScale(1);
    }, entranceDelay);

    return () => window.clearTimeout(timer);
  }, [entranceDelay]);

  useFrame((_, delta) => {
    if (!meshRef.current) {
      return;
    }

    const currentScaleY = meshRef.current.scale.y;
    const nextScaleY =
      targetScale > currentScaleY ? Math.min(targetScale, currentScaleY + delta * 2) : currentScaleY;
    meshRef.current.scale.set(1, nextScaleY, 1);

    if (pulseLightRef.current) {
      pulseLightRef.current.intensity = pulseActive
        ? 1.8 + Math.sin(performance.now() / 120) * 0.9
        : 0;
    }
  });

  const globalMaxCommentLikes = useMemo(() => {
    let max = 1;

    for (const post of account.postsData) {
      if (post.maxCommentLikeCount > max) {
        max = post.maxCommentLikeCount;
      }
    }

    return max;
  }, [account.postsData]);

  return (
    <group position={[position[0], 0, position[2]]}>
      <group ref={meshRef} scale={[1, 0.01, 1]}>
        <pointLight
          ref={pulseLightRef}
          color="#fbbf24"
          distance={Math.max(width * 3, totalHeight * 0.4)}
          intensity={0}
          position={[0, totalHeight + floorHeight, 0]}
        />
        {account.postsData.map((postData, dataIndex) => {
          // Reversing position: dataIndex 0 (recent) at top, last index at bottom
          const verticalIndex = account.postsData.length - 1 - dataIndex;
          const yPos = verticalIndex * (floorHeight + singleGap) + floorHeight / 2;
          const floorKey = `${postData.id}:${dataIndex}`;
          const isFloorHovered = hoveredFloorKey === floorKey;

          return (
            <group
              key={`${account.username}-${postData.id}-${dataIndex}`}
              onPointerEnter={(event) => {
                event.stopPropagation();
                setHoveredFloorKey(floorKey);
                onHover(account);
              }}
              onPointerLeave={(event) => {
                event.stopPropagation();
                setHoveredFloorKey((currentKey) =>
                  currentKey === floorKey ? null : currentKey
                );
                onHover(null);
              }}
              onClick={(event) => {
                event.stopPropagation();
                onFloorClick(account, postData, dataIndex);
              }}
            >
              <FloorBody
                floorHeight={floorHeight}
                hovered={isFloorHovered}
                post={postData}
                width={width}
                yPos={yPos}
              />

              {postData.comments.length > 0 && (
                <FloorWindows
                  account={account}
                  post={postData}
                  floorY={yPos}
                  floorHeight={floorHeight}
                  buildingWidth={width}
                  globalMaxLikes={globalMaxCommentLikes}
                  hovered={isFloorHovered}
                  onWindowClick={onWindowClick}
                />
              )}
            </group>
          );
        })}
      </group>
    </group>
  );
}

interface FloorPaintProps {
  floorHeight: number;
  hovered: boolean;
  post: PostData;
  width: number;
  yPos: number;
}

function FloorBody({
  floorHeight,
  hovered,
  post,
  width,
  yPos,
}: FloorPaintProps) {
  const textureUrl = useMemo(() => getPostPaintUrl(post), [post]);
  const { aspectRatio, texture } = usePostPaintAsset(textureUrl);
  const floorColor = useMemo(() => {
    return hovered ? new Color('#131b2f') : new Color('#050811');
  }, [hovered]);
  const edgeColor = useMemo(() => {
    return hovered
      ? new Color('#ffffff')
      : new Color('#f8fafc');
  }, [hovered]);
  const shellEmissive = useMemo(() => {
    return hovered ? new Color('#5eead4') : new Color('#0f172a');
  }, [hovered]);

  return (
    <>
      <mesh position={[0, yPos, 0]}>
        <boxGeometry args={[width, floorHeight, width]} />
        <meshStandardMaterial
          color={floorColor}
          emissive={shellEmissive}
          emissiveIntensity={hovered ? 0.16 : 0.04}
          metalness={0.9}
          roughness={0.12}
        />
        <lineSegments>
          <edgesGeometry
            attach="geometry"
            args={[new THREE.BoxGeometry(width, floorHeight, width)]}
          />
          <lineBasicMaterial
            attach="material"
            color={edgeColor}
            linewidth={2}
            opacity={hovered ? 0.96 : 0.82}
            transparent
          />
        </lineSegments>
      </mesh>

      {texture && (
        <FloorPoster
          aspectRatio={aspectRatio}
          floorHeight={floorHeight}
          hovered={hovered}
          texture={texture}
          width={width}
          yPos={yPos}
        />
      )}
    </>
  );
}

interface FloorPosterProps {
  aspectRatio: number;
  floorHeight: number;
  hovered: boolean;
  texture: THREE.Texture;
  width: number;
  yPos: number;
}

function FloorPoster({
  aspectRatio,
  floorHeight,
  hovered,
  texture,
  width,
  yPos,
}: FloorPosterProps) {
  const { frameHeight, frameWidth, laneCenterOffset, posterHeight, posterWidth } =
    getPosterMetrics(width, floorHeight, aspectRatio);
  const frameOffset = width / 2 + 0.028;
  const posterOffset = frameOffset + 0.006;
  const frameColor = hovered ? new Color('#f8fafc') : new Color('#0f172a');
  const posterGlow = hovered ? 0.24 : 0.1;
  const faces = [
    {
      framePosition: [laneCenterOffset, yPos, frameOffset] as [number, number, number],
      posterPosition: [laneCenterOffset, yPos, posterOffset] as [number, number, number],
      rotation: [0, 0, 0] as [number, number, number],
    },
    {
      framePosition: [frameOffset, yPos, -laneCenterOffset] as [number, number, number],
      posterPosition: [posterOffset, yPos, -laneCenterOffset] as [number, number, number],
      rotation: [0, Math.PI / 2, 0] as [number, number, number],
    },
    {
      framePosition: [-laneCenterOffset, yPos, -frameOffset] as [number, number, number],
      posterPosition: [-laneCenterOffset, yPos, -posterOffset] as [number, number, number],
      rotation: [0, Math.PI, 0] as [number, number, number],
    },
    {
      framePosition: [-frameOffset, yPos, laneCenterOffset] as [number, number, number],
      posterPosition: [-posterOffset, yPos, laneCenterOffset] as [number, number, number],
      rotation: [0, -Math.PI / 2, 0] as [number, number, number],
    },
  ];

  return (
    <>
      {faces.map((face, index) => (
        <group key={`poster-face-${index}`}>
          <mesh position={face.posterPosition} rotation={face.rotation}>
            <planeGeometry args={[posterWidth, posterHeight]} />
            <meshStandardMaterial
              map={texture}
              color={new Color('#ffffff')}
              emissive={new Color('#ffffff')}
              emissiveIntensity={posterGlow}
              metalness={0.2}
              roughness={0.8}
              transparent
            />
          </mesh>
        </group>
      ))}
    </>
  );
}

interface FloorWindowsProps {
  account: AccountMetrics;
  post: PostData;
  floorY: number;
  floorHeight: number;
  buildingWidth: number;
  globalMaxLikes: number;
  hovered: boolean;
  onWindowClick: (account: AccountMetrics, post: PostData, comment: CommentData) => void;
}

function FloorWindows({
  account,
  post,
  floorY,
  floorHeight,
  buildingWidth,
  globalMaxLikes,
  hovered,
  onWindowClick,
}: FloorWindowsProps) {
  const windowDepth = 0.5;
  const floorMaxLikes = post.comments[0]?.likeCount ?? 0;
  const posterLaneWidth = getPosterLaneWidth(buildingWidth);

  const sides = [[], [], [], []] as CommentData[][];
  post.comments.forEach((comment, index) => {
    sides[index % 4].push(comment);
  });

  return (
    <>
      {sides.map((sideComments, sideIndex) => {
        if (sideComments.length === 0) return null;

        const sideCount = sideComments.length;
        const usableWallWidth = Math.max(buildingWidth - posterLaneWidth - 0.32, 0.45);
        const aspectRatio = usableWallWidth / Math.max(floorHeight, 1);
        const columns = Math.max(
          1,
          Math.ceil(Math.sqrt(sideCount * Math.max(aspectRatio, 0.25)))
        );
        const rows = Math.max(1, Math.ceil(sideCount / columns));
        const horizontalPadding = Math.max(usableWallWidth * 0.08, 0.12);
        const usableLeft = -buildingWidth / 2 + horizontalPadding;
        const usableRight = buildingWidth / 2 - posterLaneWidth - horizontalPadding;
        const horizontalSpan = Math.max(usableRight - usableLeft, 0.24);
        const horizontalSpacing = horizontalSpan / columns;
        const verticalSpacing = floorHeight / (rows + 1);
        const windowWidth = Math.max(0.18, horizontalSpacing * 0.56);
        const windowHeight = Math.max(0.15, verticalSpacing * 0.58);

        return sideComments.map((comment, indexOnSide) => {
          const columnIndex = indexOnSide % columns;
          const rowIndex = Math.floor(indexOnSide / columns);
          
          let x = 0;
          const y = floorY + floorHeight / 2 - verticalSpacing * (rowIndex + 1);
          let z = 0;
          let rotationY = 0;

          const localOffset = usableLeft + horizontalSpacing * (columnIndex + 0.5);
          const faceOffset = buildingWidth / 2 + windowDepth / 2;

          switch (sideIndex) {
            case 0: // Front
              x = localOffset;
              z = faceOffset;
              rotationY = 0;
              break;
            case 1: // Right
              x = faceOffset;
              z = -localOffset;
              rotationY = Math.PI / 2;
              break;
            case 2: // Back
              x = -localOffset;
              z = -faceOffset;
              rotationY = Math.PI;
              break;
            case 3: // Left
              x = -faceOffset;
              z = localOffset;
              rotationY = -Math.PI / 2;
              break;
          }

          const globalIndex = post.comments.findIndex(c => c.id === comment.id);
          const localRatio = floorMaxLikes > 0 ? comment.likeCount / floorMaxLikes : 0;
          const globalRatio = globalMaxLikes > 0 ? comment.likeCount / globalMaxLikes : localRatio;
          const isLikedComment = comment.likeCount > 0;
          const isBrightestComment =
            floorMaxLikes > 0 && comment.likeCount === floorMaxLikes && globalIndex === 0;
          const neutralLightness = Math.min(0.16 + globalRatio * 0.12, 0.28);
          const likedWindowColor = new Color().setHSL(
            0.135,
            1,
            Math.min(0.56 + localRatio * 0.14 + globalRatio * 0.08, 0.72)
          );
          const neutralWindowColor = new Color().setHSL(0.58, 0.18, neutralLightness);
          const windowColor = isLikedComment ? likedWindowColor : neutralWindowColor;
          const intensity = isLikedComment
            ? 1.8 + localRatio * 2.8 + globalRatio * 2 + (isBrightestComment ? 1 : 0)
            : 0.08 + globalRatio * 0.24;
          const opacity = isLikedComment ? 0.98 : 0.82;

          return (
            <mesh
              key={`${post.id}-${comment.id}-${globalIndex}`}
              position={[x, y, z]}
              rotation={[0, rotationY, 0]}
              onClick={(event) => {
                event.stopPropagation();
                onWindowClick(account, post, comment);
              }}
            >
              <boxGeometry args={[windowWidth, windowHeight, windowDepth]} />
              <meshStandardMaterial
                color={windowColor}
                emissive={windowColor}
                emissiveIntensity={hovered ? intensity * 1.8 : intensity}
                transparent
                opacity={opacity}
              />
            </mesh>
          );
        });
      })}
    </>
  );
}

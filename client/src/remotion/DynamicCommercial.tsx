import React from 'react';
import { Sequence, useCurrentFrame, interpolate, Audio } from 'remotion';
import { HookScene, type HookSceneProps } from './scenes/HookScene';
import { FeatureShowcaseScene, type FeatureShowcaseSceneProps } from './scenes/FeatureShowcaseScene';
import { MegaPromptScene, type MegaPromptSceneProps } from './scenes/MegaPromptScene';
import { DualScreenshotScene, type DualScreenshotSceneProps } from './scenes/DualScreenshotScene';
import { BadgesScene, type BadgesSceneProps } from './scenes/BadgesScene';
import { StatsScene, type StatsSceneProps } from './scenes/StatsScene';
import { CTAScene, type CTASceneProps } from './scenes/CTAScene';
import { TextOnlyScene, type TextOnlySceneProps } from './scenes/TextOnlyScene';
import { VideoClipScene, type VideoClipSceneProps } from './scenes/VideoClipScene';
import { createTheme, defaultTheme, type CommercialTheme } from './styles/theme';

// Scene type union
export type SceneConfig =
  | { type: 'hook'; props: HookSceneProps; durationFrames: number; fadeIn?: number; fadeOut?: number }
  | { type: 'feature_showcase'; props: FeatureShowcaseSceneProps; durationFrames: number; fadeIn?: number; fadeOut?: number }
  | { type: 'mega_prompt'; props: MegaPromptSceneProps; durationFrames: number; fadeIn?: number; fadeOut?: number }
  | { type: 'dual_screenshot'; props: DualScreenshotSceneProps; durationFrames: number; fadeIn?: number; fadeOut?: number }
  | { type: 'badges'; props: BadgesSceneProps; durationFrames: number; fadeIn?: number; fadeOut?: number }
  | { type: 'stats'; props: StatsSceneProps; durationFrames: number; fadeIn?: number; fadeOut?: number }
  | { type: 'cta'; props: CTASceneProps; durationFrames: number; fadeIn?: number; fadeOut?: number }
  | { type: 'text_only'; props: TextOnlySceneProps; durationFrames: number; fadeIn?: number; fadeOut?: number }
  | { type: 'video_clip'; props: VideoClipSceneProps; durationFrames: number; fadeIn?: number; fadeOut?: number };

export interface DynamicCommercialProps {
  scenes: SceneConfig[];
  themeOverrides?: {
    primary?: string;
    accent?: string;
    background?: string;
  };
  voiceoverUrl?: string;
}

const FadeTransition: React.FC<{
  children: React.ReactNode;
  durationInFrames: number;
  fadeIn?: number;
  fadeOut?: number;
}> = ({ children, durationInFrames, fadeIn = 12, fadeOut = 12 }) => {
  const frame = useCurrentFrame();
  const safeIn = Math.max(fadeIn, 1);
  const safeFadeOut = Math.max(fadeOut, 1);

  const inOpacity = interpolate(frame, [0, safeIn], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const outOpacity = fadeOut === 0 ? 1 : interpolate(
    frame, [durationInFrames - safeFadeOut, durationInFrames], [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  const inScale = interpolate(frame, [0, safeIn], [1.02, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const outScale = fadeOut === 0 ? 1 : interpolate(
    frame, [durationInFrames - safeFadeOut, durationInFrames], [1, 0.98],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  return (
    <div style={{
      opacity: inOpacity * outOpacity,
      transform: `scale(${inScale * outScale})`,
      width: 1080, height: 1920,
    }}>
      {children}
    </div>
  );
};

function renderScene(config: SceneConfig, theme: CommercialTheme): React.ReactNode {
  const themedProps = { ...config.props, theme };
  switch (config.type) {
    case 'hook':
      return <HookScene {...(themedProps as HookSceneProps)} />;
    case 'feature_showcase':
      return <FeatureShowcaseScene {...(themedProps as FeatureShowcaseSceneProps)} />;
    case 'mega_prompt':
      return <MegaPromptScene {...(themedProps as MegaPromptSceneProps)} />;
    case 'dual_screenshot':
      return <DualScreenshotScene {...(themedProps as DualScreenshotSceneProps)} />;
    case 'badges':
      return <BadgesScene {...(themedProps as BadgesSceneProps)} />;
    case 'stats':
      return <StatsScene {...(themedProps as StatsSceneProps)} />;
    case 'cta':
      return <CTAScene {...(themedProps as CTASceneProps)} />;
    case 'text_only':
      return <TextOnlyScene {...(themedProps as TextOnlySceneProps)} />;
    case 'video_clip':
      return <VideoClipScene {...(themedProps as VideoClipSceneProps)} />;
    default:
      return null;
  }
}

export const DynamicCommercial: React.FC<DynamicCommercialProps> = ({
  scenes,
  themeOverrides,
  voiceoverUrl,
}) => {
  const theme = themeOverrides ? createTheme(themeOverrides) : defaultTheme;

  // Calculate start frames with slight overlap for smooth transitions
  let currentFrame = 0;
  const sceneTimings = scenes.map((scene) => {
    const from = currentFrame;
    const overlap = Math.min(scene.fadeIn ?? 12, scene.fadeOut ?? 12);
    currentFrame += scene.durationFrames - overlap;
    return { from, duration: scene.durationFrames };
  });

  return (
    <div style={{
      width: 1080, height: 1920,
      backgroundColor: theme.colors.bg,
      position: 'relative', overflow: 'hidden',
    }}>
      {voiceoverUrl && <Audio src={voiceoverUrl} volume={1} />}

      {scenes.map((scene, i) => {
        const { from, duration } = sceneTimings[i];
        const fadeIn = scene.fadeIn ?? 12;
        const fadeOut = i === scenes.length - 1 ? 0 : (scene.fadeOut ?? 12);

        return (
          <Sequence key={i} from={from} durationInFrames={duration}>
            <FadeTransition durationInFrames={duration} fadeIn={fadeIn} fadeOut={fadeOut}>
              {renderScene(scene, theme)}
            </FadeTransition>
          </Sequence>
        );
      })}
    </div>
  );
};

import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate, Img } from 'remotion';
import { SceneWrapper } from '../components/SceneWrapper';
import { ParticleBurst } from '../components/Transitions';
import type { CommercialTheme } from '../styles/theme';
import { defaultTheme } from '../styles/theme';

export interface MegaPromptSceneProps {
  sectionLabel?: string;
  promptText: string;
  tasks: { icon: string; label: string }[];
  screenshot?: string;
  agentName?: string;
  theme?: CommercialTheme;
}

export const MegaPromptScene: React.FC<MegaPromptSceneProps> = ({
  sectionLabel = 'The Power of One Prompt',
  promptText,
  tasks,
  screenshot,
  agentName = 'Super Agent',
  theme = defaultTheme,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const elapsed = Math.max(0, frame - 10);
  const charCount = Math.min(Math.floor(elapsed * 1.8), promptText.length);
  const typedText = promptText.slice(0, charCount);
  const typing = charCount < promptText.length;
  const cursorOn = Math.floor(elapsed / 10) % 2 === 0;

  const promptEnter = spring({ frame: frame - 5, fps, config: { mass: 0.5, damping: 14, stiffness: 180 } });
  const screenshotEnter = spring({ frame: frame - 105, fps, config: { mass: 0.6, damping: 14, stiffness: 140 } });
  const progressWidth = interpolate(frame, [75, 130], [0, 100], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const breakdownEnter = spring({ frame: frame - 70, fps, config: { mass: 0.5, damping: 14, stiffness: 180 } });

  // Distribute tasks evenly in a circle
  const taskAngles = tasks.map((_, i) => -90 + (i / tasks.length) * 360);

  return (
    <SceneWrapper orbOpacity={0.35} theme={theme}>
      <div style={{
        position: 'absolute', top: 60, left: 0, right: 0, textAlign: 'center', opacity: promptEnter,
      }}>
        <span style={{
          fontFamily: theme.fonts.heading, fontSize: 22, fontWeight: 600,
          color: theme.colors.textMuted, letterSpacing: '3px', textTransform: 'uppercase',
        }}>
          {sectionLabel}
        </span>
      </div>

      {/* Prompt input */}
      <div style={{
        position: 'absolute', top: 110, left: 45, right: 45,
        opacity: promptEnter, transform: `translateY(${(1 - promptEnter) * 30}px)`,
      }}>
        <div style={{
          background: theme.colors.bgCard, border: `2px solid ${theme.colors.borderBright}`,
          borderRadius: theme.radius.xl, padding: 28, boxShadow: theme.shadows.glowStrong,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{
              width: 36, height: 36, borderRadius: theme.radius.full,
              background: theme.gradients.primaryToAccent,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
            }}>
              &#9889;
            </div>
            <span style={{
              fontFamily: theme.fonts.heading, fontSize: 18, fontWeight: 700, color: theme.colors.primary,
            }}>
              {agentName}
            </span>
          </div>
          <span style={{
            fontFamily: theme.fonts.body, fontSize: 20, color: theme.colors.textPrimary, lineHeight: 1.6,
          }}>
            {typedText}
            {typing && cursorOn && <span style={{ color: theme.colors.primary }}>|</span>}
          </span>
        </div>
      </div>

      <ParticleBurst startFrame={72} count={18} primaryColor={theme.colors.primary} accentColor={theme.colors.accent} />

      {/* Task icons */}
      {frame > 68 && (
        <div style={{ position: 'absolute', top: 580, left: 540, pointerEvents: 'none', zIndex: 5 }}>
          {tasks.map((task, i) => {
            const taskProgress = spring({ frame: frame - 72 - i * 3, fps, config: { mass: 0.4, damping: 12, stiffness: 200 } });
            const rad = (taskAngles[i] * Math.PI) / 180;
            const dist = 200;
            const x = Math.cos(rad) * dist * taskProgress;
            const y = Math.sin(rad) * dist * taskProgress;
            return (
              <div key={i} style={{
                position: 'absolute', left: x - 40, top: y - 40,
                opacity: taskProgress, transform: `scale(${0.5 + taskProgress * 0.5})`,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
              }}>
                <div style={{
                  width: 56, height: 56, borderRadius: '50%',
                  background: theme.colors.surfaceElevated,
                  border: `1px solid ${theme.colors.borderBright}`,
                  boxShadow: theme.shadows.glow,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26,
                }}>
                  {task.icon}
                </div>
                <span style={{ fontFamily: theme.fonts.body, fontSize: 13, fontWeight: 600, color: theme.colors.textSecondary }}>
                  {task.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Progress bar */}
      {frame > 72 && (
        <div style={{ position: 'absolute', top: 850, left: 60, right: 60, opacity: breakdownEnter }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontFamily: theme.fonts.heading, fontSize: 16, fontWeight: 600, color: theme.colors.accent }}>
              Breaking it down into tasks...
            </span>
            <span style={{ fontFamily: theme.fonts.mono, fontSize: 14, color: theme.colors.textMuted }}>
              {Math.min(Math.round(progressWidth), 100)}%
            </span>
          </div>
          <div style={{ width: '100%', height: 6, borderRadius: 3, background: theme.colors.bgLight, overflow: 'hidden' }}>
            <div style={{
              width: `${progressWidth}%`, height: '100%', borderRadius: 3,
              background: theme.gradients.primaryToAccent,
              boxShadow: `0 0 20px ${theme.colors.primaryGlow}`,
            }} />
          </div>
        </div>
      )}

      {/* Screenshot */}
      {screenshot && frame > 100 && (
        <div style={{
          position: 'absolute', top: 920, left: 25, right: 25, bottom: 0,
          opacity: screenshotEnter, transform: `translateY(${(1 - screenshotEnter) * 80}px)`,
          zIndex: 2, overflow: 'hidden',
        }}>
          <div style={{
            borderRadius: '20px 20px 0 0', overflow: 'hidden',
            boxShadow: `0 -10px 60px rgba(0,0,0,0.1), 0 0 40px ${theme.colors.primaryGlow}`,
            border: `1px solid ${theme.colors.cardBorder}`, borderBottom: 'none',
          }}>
            <Img src={screenshot} style={{ width: '100%', display: 'block' }} />
          </div>
        </div>
      )}
    </SceneWrapper>
  );
};

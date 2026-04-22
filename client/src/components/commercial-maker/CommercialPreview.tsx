import { useMemo, useState } from "react";
import { Player } from "@remotion/player";
import { DynamicCommercial, type DynamicCommercialProps, type SceneConfig } from "@/remotion/DynamicCommercial";
import type { CommercialScene, CommercialConfig } from "@/types/commercial";
import { Play, Pause, RotateCcw, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CommercialPreviewProps {
  scenes: CommercialScene[];
  config: CommercialConfig;
  voiceoverUrl?: string | null;
  onRender?: () => void;
  renderLoading?: boolean;
}

export default function CommercialPreview({
  scenes,
  config,
  voiceoverUrl,
  onRender,
  renderLoading,
}: CommercialPreviewProps) {
  const [playing, setPlaying] = useState(false);

  // Convert DB scenes to Remotion SceneConfig
  const sceneConfigs: SceneConfig[] = useMemo(() => {
    return [...scenes]
      .sort((a, b) => a.scene_order - b.scene_order)
      .map((scene) => ({
        type: scene.scene_type as SceneConfig["type"],
        props: scene.props as any,
        durationFrames: scene.duration_frames,
        fadeIn: scene.fade_in,
        fadeOut: scene.fade_out,
      }));
  }, [scenes]);

  // Calculate total duration
  const totalDuration = useMemo(() => {
    if (sceneConfigs.length === 0) return 150; // 5s default
    let total = 0;
    for (let i = 0; i < sceneConfigs.length; i++) {
      const scene = sceneConfigs[i];
      if (i === 0) {
        total += scene.durationFrames;
      } else {
        const overlap = Math.min(scene.fadeIn ?? 12, sceneConfigs[i - 1].fadeOut ?? 12);
        total += scene.durationFrames - overlap;
      }
    }
    return Math.max(total, 30);
  }, [sceneConfigs]);

  const inputProps: DynamicCommercialProps = useMemo(() => ({
    scenes: sceneConfigs,
    themeOverrides: config.theme,
    voiceoverUrl: voiceoverUrl || undefined,
  }), [sceneConfigs, config.theme, voiceoverUrl]);

  const durationSeconds = (totalDuration / (config.fps || 30)).toFixed(1);

  return (
    <div className="flex flex-col h-full bg-muted/30">
      {/* Player */}
      <div className="flex-1 flex items-center justify-center overflow-hidden p-4">
        {sceneConfigs.length > 0 ? (
          <div
            className="relative rounded-xl overflow-hidden shadow-2xl"
            style={{
              // Scale 1080x1920 to fit container (phone frame proportions)
              width: "min(100%, 270px)",
              aspectRatio: "9/16",
            }}
          >
            <Player
              component={DynamicCommercial}
              inputProps={inputProps}
              durationInFrames={totalDuration}
              compositionWidth={config.width || 1080}
              compositionHeight={config.height || 1920}
              fps={config.fps || 30}
              style={{ width: "100%", height: "100%" }}
              autoPlay={false}
              loop
              controls={false}
            />
          </div>
        ) : (
          <div className="text-center text-muted-foreground px-8">
            <div className="w-32 h-56 rounded-xl border-2 border-dashed border-border mx-auto mb-4 flex items-center justify-center">
              <Play className="h-8 w-8 text-muted-foreground/30" />
            </div>
            <p className="text-sm font-medium">No scenes yet</p>
            <p className="text-xs mt-1">Use the chat to add scenes to your commercial</p>
          </div>
        )}
      </div>

      {/* Controls bar */}
      <div className="border-t border-border bg-card px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {sceneConfigs.length} scene{sceneConfigs.length !== 1 ? "s" : ""} &middot; {durationSeconds}s
          </span>
        </div>
        <div className="flex items-center gap-2">
          {onRender && (
            <Button
              size="sm"
              variant="default"
              className="h-7 text-xs"
              onClick={onRender}
              disabled={renderLoading || sceneConfigs.length === 0}
            >
              {renderLoading ? (
                <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Rendering...</>
              ) : (
                <><Download className="h-3 w-3 mr-1" /> Render MP4</>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Scene thumbnails strip */}
      {sceneConfigs.length > 0 && (
        <div className="border-t border-border bg-card/50 px-3 py-2 flex gap-2 overflow-x-auto">
          {sceneConfigs.map((scene, i) => (
            <div
              key={i}
              className="flex-shrink-0 w-16 h-10 rounded border border-border bg-background flex items-center justify-center text-[9px] text-muted-foreground font-medium"
            >
              {scene.type.replace(/_/g, " ")}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

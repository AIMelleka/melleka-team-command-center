export interface CommercialProject {
  id: string;
  member_name: string;
  name: string;
  status: "draft" | "rendering" | "complete";
  config: CommercialConfig;
  voiceover_url: string | null;
  thumbnail_url: string | null;
  render_url: string | null;
  conversation_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CommercialConfig {
  fps: number;
  width: number;
  height: number;
  theme: {
    primary: string;
    accent: string;
    background: string;
  };
}

export interface CommercialScene {
  id: string;
  project_id: string;
  scene_order: number;
  scene_type: string;
  props: Record<string, unknown>;
  duration_frames: number;
  fade_in: number;
  fade_out: number;
  created_at: string;
  updated_at: string;
}

export interface CommercialRender {
  id: string;
  project_id: string;
  status: "queued" | "rendering" | "complete" | "failed";
  progress: number;
  output_url: string | null;
  error: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface CommercialProjectWithScenes extends CommercialProject {
  scenes: CommercialScene[];
}

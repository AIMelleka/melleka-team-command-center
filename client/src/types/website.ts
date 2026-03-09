export interface WebsiteProject {
  id: string;
  member_name: string;
  name: string;
  slug: string;
  description: string | null;
  status: "draft" | "published" | "archived";
  template_id: string | null;
  custom_domain: string | null;
  vercel_project_id: string | null;
  vercel_deployment_url: string | null;
  branded_url: string | null;
  thumbnail_url: string | null;
  seo_defaults: SeoDefaults;
  settings: WebsiteSettings;
  conversation_id: string | null;
  last_deployed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WebsitePage {
  id: string;
  project_id: string;
  filename: string;
  title: string;
  html_content: string;
  is_homepage: boolean;
  sort_order: number;
  seo: SeoDefaults;
  created_at: string;
  updated_at: string;
}

export interface WebsiteVersion {
  id: string;
  project_id: string;
  version_number: number;
  deploy_url: string | null;
  deployed_by: string;
  commit_message: string | null;
  created_at: string;
}

export interface WebsiteProjectWithPages extends WebsiteProject {
  pages: WebsitePage[];
}

export interface SeoDefaults {
  title?: string;
  description?: string;
  ogImage?: string;
  favicon?: string;
  canonical?: string;
}

export interface WebsiteSettings {
  primaryColor?: string;
  secondaryColor?: string;
  fontFamily?: string;
  analyticsId?: string;
  [key: string]: unknown;
}

export interface DeployResult {
  url: string;
  vercelUrl: string | null;
  version: number;
  domainOk: boolean;
}

export interface AssetUploadResult {
  url: string;
  path: string;
}

export interface DomainResult {
  success: boolean;
  message: string;
}

# Melleka Teams — Claude Code Context

## Project Overview
Name: Melleka Teams (merged Genie Hub + Team Command Center)
Purpose: AI-powered team collaboration and marketing command center for Melleka's internal team.
Live app: https://teams.melleka.com
Backend: https://server-production-0486.up.railway.app
GitHub: AIMelleka/melleka-teams (private)
Supabase project ID: nhebotmrnxixvcvtspet

## Tech Stack
- Frontend: React 18 + TypeScript + Vite
- UI: Shadcn UI (Radix primitives) + Tailwind CSS
- State/Data: TanStack Query v5, React Context for auth/theme
- Backend: Express 4.21 + TypeScript (tsx for dev, tsc for build)
- AI: Anthropic Claude SDK (@anthropic-ai/sdk) with agentic tool_use loop
- Database: Supabase (shared project with Turbo AI and Anthony's Assistant)
- Deployment: Vercel (frontend) + Railway (backend, Docker)
- Voice: TTS + STT endpoints
- Package manager: npm (workspaces)

## Commands
```bash
npm run dev:client       # start frontend dev server
npm run dev:server       # start backend dev server (tsx watch)
npm run build:client     # vite build
npm run build:server     # tsc + copy data files
```

Deploy frontend: `cd client && vercel --prod --yes`
Deploy backend: `railway up` from project root

## Project Structure
```
client/src/
  pages/
    Index.tsx                   # homepage with chat interface
    Login.tsx
    SuperAgentDashboard.tsx     # super agent management
    SuperAgentSettings.tsx
    Tasks.tsx
    ClientDashboard.tsx / ClientHealth.tsx / ClientSettings.tsx / ClientUpdate.tsx
    ProposalBuilder.tsx / ProposalsDashboard.tsx / ProposalView.tsx / ProposalQA.tsx
    DeckBuilder.tsx / DeckEditor.tsx / DeckView.tsx / DecksDashboard.tsx
    AdGenerator.tsx / AdReview.tsx
    EmailWriter.tsx / ImageGenerator.tsx / VideoGenerator.tsx
    PpcOptimizer.tsx / SeoBot.tsx / SeoWriter.tsx
    CreativeStudio.tsx / PortfolioManager.tsx
    QABot.tsx / StrategistSettings.tsx
    AdminDashboard.tsx / UserDashboard.tsx
  components/
    layout/            # AppLayout, sidebar
    chat/              # ChatInterface (SSE streaming), ChatMessage
    ui/                # Shadcn components (do not edit directly)
  contexts/            # Auth, Theme
  hooks/               # Custom hooks
  lib/
    apiService.ts      # Base API client
    apiRetry.ts        # Retry logic
    chatApi.ts         # SSE streaming wrapper
    fuzzyMatch.ts      # Fuzzy search utility
    utils.ts           # Generic utilities

server/src/
  index.ts             # Express setup, CORS, rate limiting, route mounting
  middleware/
    auth.ts            # Supabase JWT verification + MFA enforcement
  routes/
    auth.ts            # Authentication endpoints
    chat.ts            # SSE streaming chat (agentic loop)
    conversations.ts   # Conversation CRUD
    memory.ts          # Persistent memory
    notifications.ts   # Alerts and cron triggers
    tasks.ts           # Task management
    canva.ts           # Canva integration
    tts.ts / stt.ts    # Voice endpoints
    super-agent-tasks.ts  # Background agent tasks
  services/
    claude.ts          # System prompt + agentic loop (runChat)
    tools.ts           # 40+ tool definitions and execution
    llm-provider.ts    # LLM fallback logic
    memory.ts          # Memory read/write
    secrets.ts         # Credential management
    supabase.ts        # Supabase client
    scheduler.ts       # Cron job scheduler
    activeJobs.ts      # Background job tracking
    zapier-mcp.ts      # Zapier MCP integration
  data/
    marketing-skills.md    # Marketing tactics injected into system prompt
    community-skills.md    # Community building skills
```

## Server Architecture
The backend runs an Express server with SSE streaming for real-time AI chat.

Chat flow:
1. POST /api/chat receives user message + conversation history
2. Loads member context, memory, active jobs from Supabase
3. Builds system prompt with skills, memory, and tool definitions
4. Calls Claude with tool_use (agentic loop, max iterations)
5. Executes tools server-side (Google Ads API, Meta API, Supabase queries, etc.)
6. Streams response as SSE chunks back to client
7. Saves conversation to Supabase

Rate limits:
- /api/auth: 10 req/min
- /api/chat: 10 req/min
- /api/tts: 20 req/min
- /api/stt: 30 req/min
- /api/*: 100 req/min (global)

## Database Tables (key ones)
All tables live in shared Supabase project nhebotmrnxixvcvtspet:
- team_members: team member profiles
- team_conversations / messages: chat history
- team_memory: persistent key-value memory per member
- team_notifications: alerts and scheduled notifications
- super_agent_tasks: background agent task queue

## Development Notes
- client/src/components/ui/ contains Shadcn components, do not edit directly
- Import alias @/ maps to client/src/
- Server .env at server/.env (never commit)
- VITE_API_URL env var configures API base URL
- Server timeout set to 0 for long-running agentic loops

## Cross-Project Bridge

This project is part of the Melleka ecosystem. After making changes, check the bridge registry at `/Users/aimelleka/Clients/bridge-registry.json` to determine if the change should propagate.

WORKFLOW after every code change:
1. Read bridge-registry.json
2. Check if the modified file appears in any sync_group
3. If category is "identical": apply the exact same change to the other project(s)
4. If category is "pattern": read the target file, reason about whether the change applies, and apply it only if it improves the target without breaking project-specific behavior
5. If the file is NOT in any sync_group but the change is a general improvement (security fix, bug fix, utility improvement, better error handling): check if similar code exists in the other projects and apply if applicable

REASONING CRITERIA (for "pattern" changes):
- Does the target file have the same code pattern being changed? YES = propagate
- Would this change break project-specific behavior? YES = skip
- Is this a security or bug fix? YES = always propagate
- Is this adding a new feature specific to this project? YES = skip
- Is this improving shared infrastructure (API helpers, streaming, auth)? YES = propagate

SISTER PROJECTS:
- Turbo AI: /Users/aimelleka/MellekaMarketingMain/Main Melleka Turbo AI/
- Anthony: /Users/aimelleka/Clients/AnthonysPersonalAssistant/

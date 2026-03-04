# Melleka Genie Hub

AI-powered marketing operations platform. Proposals, decks, client health, PPC, SEO, email, image and video tools — all in one place.

## Local Development

**Requirements:** Node.js 18+

```bash
# 1. Clone
git clone https://github.com/AnthonyMelleka/melleka-genie-hub.git
cd melleka-genie-hub

# 2. Install dependencies
npm install

# 3. Set up environment
cp .env.example .env
# Fill in your Supabase credentials in .env

# 4. Start dev server
npm run dev
# Opens at http://localhost:8080
```

## Build

```bash
npm run build       # Production build → dist/
npm run preview     # Preview production build locally
```

## Deployment

Deployed on Vercel. Push to `main` triggers automatic deployment.

Required environment variables in Vercel dashboard:
- `VITE_SUPABASE_PROJECT_ID`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_URL`
- `VITE_APP_URL` (your production domain)

## Stack

- React 18 + TypeScript + Vite
- Shadcn UI + Tailwind CSS
- Supabase (auth, database, edge functions)
- TanStack Query
- React Router v6

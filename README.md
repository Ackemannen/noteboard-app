# 🧷 Collaboard

A collaborative digital cork board. Create, edit and drag sticky notes around a
board, and share it with others. Everyone with the link edits the same board in real time.

Built with **Next.js 16** (App Router), **Supabase** (Postgres, Auth, Realtime),
TypeScript and Tailwind CSS 4.

## ✨ Features

- 📝 Sticky notes: click anywhere to create, click a note to edit or delete
- 🎨 Five note colors with a slight random rotation for an organic look
- 🖱️ Drag & drop with a shared stacking order (dragged notes come to the front for everyone)
- ✅ Multi-select with a selection box (Shift + drag or the Select tool) or Shift + click,
  then move, recolor or delete the whole selection (with undo)
- 🔍 Infinite canvas: zoom around the pointer (wheel / pinch), pan by dragging the board
- 🗺️ Minimap showing the whole board and the visible area. Click or drag it to navigate
- ⌨️ Keyboard shortcuts (the ? button on a board lists them all)
- 🧭 Hover sidebar with your boards and boards shared with you
- 🗂️ Dashboard with live board thumbnails, search, filters, sorting and inline rename
- 🔐 Email/password and Google sign-in
- 🔗 Share links. Opening a board's link adds you as a collaborator
- ⚡ Live sync between everyone viewing a board (Supabase Realtime)

## 🚀 Getting started

Prerequisites: Node.js 20.9+ and a Supabase project.

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Environment variables.** Copy `.env.example` to `.env` and fill it in:

   | Variable | Where to find it |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → Project Settings → API Keys |
   | `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET` | Google Cloud → Credentials (only used by the local Supabase stack) |

3. **Set up the database** (once). See [Database & migrations](#-database--migrations).

   ```bash
   npm run db:login
   npm run db:link -- --project-ref <your-project-ref>
   npm run db:push
   ```

4. **Run the dev server** and open http://localhost:3000

   ```bash
   npm run dev
   ```

## 🗄️ Database & migrations

The schema lives in versioned SQL files in [`supabase/migrations`](supabase/migrations),
managed with the Supabase CLI (installed as a dev dependency, so `npx supabase …` and the
npm scripts below work without a global install). The migrations are the source of truth:
don't edit tables in the dashboard. Write a migration instead, so every environment stays
reproducible.

### Making a schema change

```bash
npm run db:new -- add_note_z_index      # creates supabase/migrations/<timestamp>_add_note_z_index.sql
# ...write your SQL in that file...
npm run db:push:dry                      # preview what will be applied
npm run db:push                          # apply to the linked project
npm run db:types                         # regenerate src/lib/supabase/database.types.ts
```

Commit the migration and the regenerated types together.

| Script | What it does |
| --- | --- |
| `db:login` | Authenticate the Supabase CLI (once per machine) |
| `db:link` | Link this repo to your hosted project (`-- --project-ref <ref>`) |
| `db:new` | Create a new, timestamped migration file |
| `db:push` / `db:push:dry` | Apply pending migrations to the linked project / preview them |
| `db:status` | Show which migrations are applied locally vs remotely |
| `db:types` | Regenerate TypeScript types from the linked database |
| `db:pull` | Pull changes made in the dashboard into a new migration |
| `db:start` / `db:stop` / `db:reset` / `db:diff` / `db:types:local` | Local Supabase stack (requires Docker) |

### Automatic deploys (GitHub Actions)

[`.github/workflows/supabase-migrations.yml`](.github/workflows/supabase-migrations.yml):

- **Pull requests** touching `supabase/**` spin up a throwaway Postgres, apply every
  migration and lint the SQL functions, so a broken migration can't be merged.
- **Pushes to `master`/`main`** that add migrations run `supabase db push` against
  production.

To enable deploys, add these repository secrets (Settings → Secrets and variables → Actions):

| Secret | Value |
| --- | --- |
| `SUPABASE_ACCESS_TOKEN` | A personal access token from supabase.com/dashboard/account/tokens |
| `SUPABASE_DB_PASSWORD` | Your project's database password |
| `SUPABASE_PROJECT_ID` | Your project ref (the subdomain in `NEXT_PUBLIC_SUPABASE_URL`) |

### Data model

| Table | Purpose |
| --- | --- |
| `boards` | A board and its owner. Only the owner can rename or delete it |
| `board_members` | Who can access a board. The owner is added automatically; `join_board()` adds people who open a share link |
| `notes` | Sticky notes (text, color, position, rotation, stacking order `z`) belonging to a board |

Row Level Security is enabled on every table: users only ever see boards they're a member of.

## 🔐 Authentication setup

In the Supabase dashboard → **Authentication**:

- **URL Configuration:** set *Site URL* to your production URL and add
  `http://localhost:3000/**` and `https://<your-domain>/**` to *Redirect URLs*.
- **Sign In / Providers → Google:** enable it and paste your Google client ID and secret.
  In Google Cloud, the authorized redirect URI must be
  `https://<project-ref>.supabase.co/auth/v1/callback`.
- **Email confirmations** are on by default. New users get a link that lands on
  `/auth/callback`.

## 📦 Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript type check |

## ☁️ Deployment

The app uses server rendering, a Proxy (session refresh) and Route Handlers, so it needs a
Node host such as [Vercel](https://vercel.com). It can no longer be deployed to GitHub
Pages. Set the two `NEXT_PUBLIC_SUPABASE_*` environment variables in your host.

## 📁 Project structure

```plaintext
src/
├── app/
│   ├── page.tsx                 # Landing page
│   ├── auth/                    # Sign-in page, OAuth/email callback, sign-out action
│   └── (app)/                   # Signed-in area, wrapped in the sidebar layout
│       ├── layout.tsx
│       ├── dashboard/           # Board grid + server actions (create/rename/delete/leave)
│       └── boards/[id]/         # Board page (server) → Board (client canvas)
├── components/
│   ├── board/                   # BoardCanvas, StickyNote, Minimap, NavigatorPanel, toolbars
│   └── sidebar/Sidebar.tsx      # Collapsible navigation rail
├── hooks/
│   ├── useBoardNotes.ts         # Notes state ⇄ Supabase (debounced saves + realtime)
│   ├── useCamera.ts             # Pan/zoom state, animations, remembered per board
│   └── useViewportSize.ts
├── lib/
│   ├── board-geometry.ts        # Camera math: screen ⇄ world, zoom-at-point, fitting
│   ├── notes.ts                 # Note model, colors, sizes
│   └── supabase/                # Browser/server clients, proxy helper, generated types
└── proxy.ts                     # Refreshes the auth session, guards private routes
supabase/
├── config.toml                  # Local Supabase stack config (incl. Google provider)
└── migrations/                  # Versioned SQL migrations
```

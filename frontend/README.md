# HR Bot - AI-Powered Recruitment Assistant

A modern, professional recruitment management platform built with Vite, React, and TypeScript. HR Bot streamlines the candidate screening process with AI-powered scoring, virtual interview scheduling, and comprehensive candidate management.

## Features

### Core Features
- **Dashboard**: Real-time overview of recruitment metrics and recent candidates
- **Recruitment Campaigns**: Create and manage multiple recruitment campaigns
- **Candidate Management**: Track candidates through the entire hiring pipeline
- **AI Scoring**: Automated CV scoring based on job requirements
- **Virtual Interviews**: Schedule and manage virtual interview sessions
- **Pipeline Tracking**: Move candidates through stages (Applied → Screening → Virtual Interview → HR Review → Test → Real Interview → Offer)

### Advanced Features
- **Candidate Filtering**: Search and filter by skills, education, experience, and more
- **Bulk Actions**: Perform actions on multiple candidates at once
- **Email Integration**: Send interview invitations directly to candidates
- **CV Upload**: Upload and store CVs in multiple formats
- **Analytics**: Track recruitment metrics and conversion rates
- **Dark Mode**: Full dark/light theme support with system preferences detection

## Tech Stack

- **Frontend Framework**: React 18 with TypeScript
- **Build Tool**: Vite 5
- **Styling**: Tailwind CSS v3 with custom color system
- **State Management**: Zustand
- **Routing**: React Router v6
- **Icons**: Lucide React
- **Backend (Ready)**: Supabase PostgreSQL + Auth
- **Package Manager**: pnpm

## Project Structure

```
src/
├── app.tsx                 # Main App component
├── main.tsx               # React DOM entry point
├── components/
│   ├── ui/               # Base UI components (Button, Input, Card, etc.)
│   ├── layout/           # Layout components (Sidebar, Header, MainLayout)
│   └── dashboard/        # Dashboard-specific components
├── pages/
│   ├── auth/
│   │   └── login.tsx     # Login page
│   ├── dashboard/
│   │   └── index.tsx     # Dashboard page
│   ├── campaigns/
│   │   └── index.tsx     # Recruitment campaigns page
│   ├── candidates/
│   │   └── index.tsx     # Candidate management page
│   ├── interviews/
│   │   └── index.tsx     # Virtual interviews page
│   ├── settings/
│   │   └── index.tsx     # Settings page
│   └── not-found.tsx     # 404 page
├── stores/               # Zustand state stores
│   ├── auth-store.ts
│   ├── candidates-store.ts
│   └── campaigns-store.ts
├── hooks/                # Custom React hooks
├── types/                # TypeScript type definitions
├── constants/            # App-wide constants
├── lib/                  # Utilities and helpers
│   ├── utils.ts
│   ├── supabase.ts
│   └── mock-data.ts
├── contexts/             # React Context providers
│   └── theme-context.tsx
├── routes/               # Route configuration
└── styles/
    └── globals.css       # Global styles with Tailwind
```

## Getting Started

### Prerequisites
- Node.js 18+ 
- pnpm 10+

### Installation

1. **Install dependencies**
```bash
pnpm install
```

2. **Start development server**
```bash
pnpm dev
```

The app will open at `http://localhost:5173`

### Build for Production

```bash
pnpm build
```

This creates an optimized build in the `dist/` folder.

## Environment Variables

Copy `.env.example` to `.env.local` and configure:

```env
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_url_here
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here

# API Configuration
VITE_API_URL=http://localhost:3000/api

# Google OAuth (optional)
VITE_GOOGLE_CLIENT_ID=your_google_client_id_here
```

## Demo Credentials

For testing without authentication setup:
- **Email**: admin@hrbot.com
- **Password**: password

## Available Routes

| Route | Description |
|-------|-------------|
| `/login` | Login page |
| `/dashboard` | Dashboard overview |
| `/campaigns` | Recruitment campaigns management |
| `/candidates` | Candidate management and scoring |
| `/interviews` | Virtual interview scheduling |
| `/settings` | System settings |

## Key Components

### UI Components (`src/components/ui/`)
- **Button**: Variants - primary, secondary, outline, ghost, danger
- **Input/Textarea/Select**: Form inputs with validation
- **Card**: Container component with header, content, footer
- **Badge**: Status and tag display
- **Modal**: Dialog component for forms and confirmations
- **Table**: Data table with responsive design
- **Tabs**: Tabbed content interface
- **Alert**: Alert messages with variants
- **Loader**: Spinner and full-page loader

### Layout Components (`src/components/layout/`)
- **MainLayout**: Main app wrapper with sidebar and header
- **Sidebar**: Navigation sidebar with menu items
- **Header**: Top navigation with theme toggle and user menu

### Store Management (Zustand)

#### Auth Store
```typescript
useAuthStore((state) => ({
  user,
  isAuthenticated,
  login,
  logout,
  register,
}))
```

#### Candidates Store
```typescript
useCandidatesStore((state) => ({
  candidates,
  setFilters,
  getFilteredCandidates,
  updateCandidate,
  toggleCandidateSelection,
}))
```

#### Campaigns Store
```typescript
useCampaignsStore((state) => ({
  campaigns,
  addCampaign,
  updateCampaign,
  deleteCampaign,
  getActiveCampaigns,
}))
```

## Theme System

The app uses a CSS variable-based theme system with support for dark/light modes:

```css
/* Color Variables (Light Mode) */
--primary: 222 89% 52%;      /* Indigo Blue */
--secondary: 217 87% 51%;    /* Secondary Blue */
--accent: 240 84% 58%;       /* Accent Blue */
--background: 0 0% 100%;     /* White */
--foreground: 222 84% 5%;    /* Dark Gray */

/* Dark Mode Overrides */
.dark {
  --primary: 217 91% 60%;
  --background: 222 84% 5%;
  /* ... */
}
```

Toggle theme with `useTheme()` hook:
```typescript
const { theme, toggleTheme } = useTheme()
```

## Data Types

### Candidate
```typescript
interface Candidate {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  cvUrl: string
  stage: CandidateStage
  score?: number
  skills: string[]
  education: string[]
  gpa?: number
  experience: number
  appliedAt: string
}
```

### RecruitmentCampaign
```typescript
interface RecruitmentCampaign {
  id: string
  name: string
  jobPositionId: string
  startDate: string
  endDate: string
  status: 'active' | 'archived' | 'closed'
  createdBy: string
}
```

## Features Implementation Guide

### Adding New Pages
1. Create file in `src/pages/feature-name/index.tsx`
2. Export component named `FeatureNamePage`
3. Add route in `src/routes/index.tsx`
4. Add menu item to sidebar in `src/components/layout/sidebar.tsx`

### Adding New Components
1. Create in `src/components/feature-name/`
2. Use UI components from `src/components/ui/`
3. Follow established patterns for props and styling

### Adding State Management
1. Create store in `src/stores/feature-store.ts`
2. Use Zustand `create` function
3. Import and use in components with `useFeatureStore()`

## Next Steps for Backend Integration

1. **Setup Supabase**
   - Create tables for campaigns, candidates, interviews, users
   - Enable Row Level Security (RLS) for multi-tenant safety
   - Setup authentication with email/password or OAuth

2. **Create API Services**
   - Replace mock data with Supabase queries
   - Implement file upload for CVs
   - Setup real-time subscriptions for updates

3. **AI Integration**
   - Integrate with OpenAI/Anthropic for CV scoring
   - Implement parsing of CV information
   - Setup async job processing for bulk scoring

4. **Email Service**
   - Integrate SendGrid/Resend for email sending
   - Create email templates for interview invitations
   - Setup automated notifications

## Performance Optimization

- Code splitting with React.lazy()
- Optimized bundle with Vite
- CSS variables for theming (no runtime calculation)
- Zustand for minimal state management overhead
- Tailwind CSS purging unused styles

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

## Development

### Available Scripts

```bash
# Development
pnpm dev           # Start dev server

# Production
pnpm build         # Build for production
pnpm preview       # Preview production build locally

# Quality
pnpm lint          # Run ESLint
```

## Security Considerations

- No sensitive data in localStorage
- CORS-protected API requests
- Input validation on all forms
- Secure password handling with Supabase Auth
- Row Level Security (RLS) for database

## Contributing

1. Follow the established folder structure
2. Use TypeScript for all new code
3. Follow Tailwind CSS conventions
4. Create reusable components
5. Update types as needed

## License

MIT License - Feel free to use this template for your projects.

## Support

For issues and feature requests, please open an issue in the repository.

---

**Built with ❤️ using Vite, React, and Tailwind CSS**

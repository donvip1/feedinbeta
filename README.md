# 🚀 FEEDIN - Social Media Platform

**Connect, Share, and Engage with AI-Powered Social Experiences**

FEEDIN is a comprehensive social media platform featuring real-time interactions, AI-powered content curation, live streaming, private messaging, video/voice calling, and premium subscription capabilities.

## ✨ Features

### 🔥 Core Features
- **Social Feed**: Post text, images, and videos with Facebook-style nested comments
- **Stories**: 24-hour ephemeral content with views tracking
- **Real-time Messaging**: Private conversations with typing indicators and read receipts
- **Video/Voice Calls**: Crystal-clear 1-on-1 and group calls
- **Live Streaming**: Broadcast live with real-time comments and reactions
- **Friends System**: Send requests, accept/reject, and manage friendships
- **Groups**: Create and join communities with admin controls

### 🤖 AI Features
- **AI Copilot**: Intelligent chatbot assistant powered by Gemini
- **AI Image Generation**: Create images using AI
- **Personalized Feed**: AI-curated content recommendations

### 💰 Monetization
- **Virtual Credits**: Buy, earn, and spend credits
- **Premium Subscriptions**: Multiple tiers with exclusive benefits
- **Stripe & Paystack**: Secure payment processing

### 🛡️ Moderation & Safety
- **Content Reporting**: Flag inappropriate content
- **Admin Dashboard**: Comprehensive moderation tools
- **Block & Mute**: Control who can interact with you
- **Auto-moderation**: AI-assisted content filtering

### ⚙️ Settings & Privacy
- **Account Settings**: Manage profile and preferences
- **Privacy Controls**: Control content visibility
- **Notification Preferences**: Customize alerts
- **Blocked Users Management**: View and manage blocks

## 🛠️ Tech Stack

### Frontend
- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui (Radix UI)
- **State Management**: React Query (TanStack Query)
- **Routing**: React Router v6
- **Forms**: React Hook Form + Zod

### Backend
- **Backend**: Lovable Cloud (Supabase)
- **Database**: PostgreSQL 15+
- **Authentication**: Supabase Auth
- **Storage**: Supabase Storage
- **Real-time**: Supabase Subscriptions (WebSocket)
- **Serverless**: Edge Functions (Deno)

### Third-Party Services
- **Payments**: Stripe
- **AI**: Lovable AI (Gemini + GPT-5)
- **Video Calls**: Daily.co (or 100ms)

## 📱 Progressive Web App (PWA)

FEEDIN is a full PWA with:
- ✅ Offline support
- ✅ Installable on mobile and desktop
- ✅ App-like experience
- ✅ Push notifications ready
- ✅ Fast loading with service worker caching

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ or Bun
- Lovable account (for deployment)

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd feedin
```

2. Install dependencies:
```bash
npm install
# or
bun install
```

3. Start development server:
```bash
npm run dev
# or
bun dev
```

4. Open [http://localhost:8080](http://localhost:8080)

## 📦 Project Structure

```
feedin/
├── public/              # Static assets
├── src/
│   ├── assets/         # Images, logos
│   ├── components/     # React components
│   │   ├── ui/        # shadcn/ui components
│   │   ├── feed/      # Feed-related components
│   │   ├── messages/  # Messaging components
│   │   ├── stories/   # Stories components
│   │   └── ...
│   ├── hooks/         # Custom React hooks
│   ├── lib/           # Utilities and helpers
│   ├── pages/         # Page components (routes)
│   └── integrations/  # Supabase integration
├── supabase/
│   ├── functions/     # Edge Functions
│   └── migrations/    # Database migrations
└── ...
```

## 🔒 Security

- ✅ Row-Level Security (RLS) on all tables
- ✅ Server-side validation for payments
- ✅ Webhook signature verification
- ✅ Secure authentication flows
- ✅ XSS and CSRF protection
- ✅ Input validation and sanitization

## 📊 Database Schema

60+ tables covering:
- Users & profiles
- Posts, comments, likes
- Messages & conversations
- Friends & follows
- Groups & memberships
- Live streams & analytics
- Credits & transactions
- Subscriptions & payments
- Notifications & preferences
- Moderation & reports

## 🎨 Design System

- **Theme**: Dark mode by default
- **Colors**: HSL-based semantic tokens
- **Typography**: Clean, readable fonts
- **Components**: Fully themed shadcn/ui components
- **Animations**: Smooth transitions and micro-interactions
- **Responsive**: Mobile-first design approach

## 🧪 Performance Optimizations

- ✅ Image compression and lazy loading
- ✅ Code splitting and tree shaking
- ✅ Caching with expiry
- ✅ Debounced search and inputs
- ✅ Optimistic UI updates
- ✅ Virtual scrolling for long lists
- ✅ Service worker for offline support

## 📝 License

This project is proprietary and confidential.

## 🤝 Contributing

This is a private project. Contact the maintainers for contribution guidelines.

## 📞 Support

For support, email support@feedin.app or join our Discord community.

## 🙏 Acknowledgments

Built with ❤️ using:
- [Lovable](https://lovable.dev) - AI-powered development platform
- [Supabase](https://supabase.com) - Backend infrastructure
- [shadcn/ui](https://ui.shadcn.com) - UI components
- [Tailwind CSS](https://tailwindcss.com) - Styling framework

---

**FEEDIN** - Where connections come to life 🌟

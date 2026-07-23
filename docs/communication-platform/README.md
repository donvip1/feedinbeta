# FeedIn Communication Platform — Master Prompt

FeedIn is an AI-powered social platform built around creators, communities,
immersive media, communication, digital identity, and creator monetization.
**Communication is a core pillar** and is being (re)designed from the ground up as
a permanent, scalable, secure, modular, and future-proof native system.

This folder is the single source of truth for that effort.

## Documents
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** — the master design: Phase 1 audit → Phase 2
  weaknesses → Phase 3 architecture → Phase 4 roadmap → Phase 5 component inventory.
- **ux-reference.html** — the visual/interaction north-star (look, feel, and flows).
  *Reference only — no HTML/JS logic is migrated; everything is rebuilt as native Flutter.*

## Engineering philosophy (binding)
- Reliability before appearance · maintainability before complexity · scalability before convenience.
- One responsibility per module. Business logic never lives in UI widgets.
- Communication services stay platform-independent (Supabase/LiveKit/FCM are adapters behind interfaces).
- Every subsystem is independently testable. Never a full rewrite in one commit. Production stays stable throughout.
- Ignore/retire the previous messaging & calling implementations; do not patch or migrate old code — build fresh on the unified pipeline.

## UX north-star (distilled from the preview)
**Design tokens**
- Surfaces: `feed.dark #0f172a` · `feed.surface #1e293b` · `feed.card #090d16` (dark slate)
- Brand: pink→purple gradient (`#ec4899 → #a855f7`); accent `feed.accent #ec4899`
- "Secure plane" accent: `feed.emerald #10b981` (E2EE/call security signals)
- Info blue `feed.blue #2481cc`; font **Inter** (300–900); glass surfaces (blur + white/10 borders)

**Communication screens the platform must deliver (native)**
1. **Chats view** — header "Messages & Calls" + "Group Call Hub", an emerald **LiveKit SFU secure-plane banner** ("End-to-end encrypted • 1:1 & Group Active • ONLINE"), and conversation tiles each with inline **voice** + **video** call buttons.
2. **1:1 call screen** — pulsing peer avatar, **E2EE badge** ("End-to-end encrypted SFU"), ringing state, live duration, controls: mute · video · speaker · **end**, and **minimize → PiP**.
3. **Group call screen** — participant **grid** (avatar cards with per-participant mute state), "N Participants in SFU Room", same control bar.
4. **Floating PiP call widget** — "In Call • 00:00 • Tap to return", app-wide above the nav.
5. Camera studio, post-capture publish, YouTube-style comments drawer, creator profile modal, audio-track modal — **already shipped** in the feed migration and reused here.

**Interaction principles observed in the preview** (to reproduce natively):
- Calls open a full-screen modal, ring with audio, auto-connect, show duration, minimize to PiP, and restore on tap.
- Group vs 1:1 is a *view mode* of the same call surface (grid vs single) — matching the unified `CallSession.mode` design.
- Inline call affordances live directly on each chat tile (one tap to voice/video).

> The preview intentionally *labels* the transport as "LiveKit SFU / E2EE secure plane" — the
> architecture keeps LiveKit behind a `CallTransport` interface and wires a real
> `EncryptionCodec` seam so the "E2EE" promise becomes real without redesign.

## Status
Phases 1–5 complete (this document). Phase 6 (implementation) proceeds subsystem-by-subsystem
per [ARCHITECTURE.md](./ARCHITECTURE.md#phase-4--implementation-roadmap), each fully tested,
one commit at a time, only after this design is approved.

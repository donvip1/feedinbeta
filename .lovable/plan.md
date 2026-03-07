

# Livestream V2 UI Overhaul + Feature Upgrades

## Summary of Changes

Based on the reference code provided, we need to bring in several new visual features (Hype Meter, Event Ticker, Hype Particles, enhanced AI "PULSE" panel with sentiment/cart data) and fix broken features (Light, Sound, Predict triggers), swap Gift/Credits buttons, and reduce chat input width.

## Changes

### 1. New Components — Hype System

**`src/components/live/stream-v2/HypeParticles.tsx`** (new)
- Floating emoji particles (🔥 ✨ 💎 🚀) that randomly spawn and float upward
- Triggered by hype level — more frequent at higher levels
- Pointer-events-none overlay at z-10

**`src/components/live/stream-v2/HypeMeter.tsx`** (new)
- Gradient progress bar (orange → yellow → pink) positioned top-center below header
- Reads `hypeLevel` from Zustand store
- Label: "HYPE METER" in uppercase tracking

**`src/components/live/stream-v2/EventTicker.tsx`** (new)
- Right-aligned ticker showing rotating event notifications (gifts, hype trains, new angles)
- Cycles every 4s with slide-in/out animation
- Fed by real gift events from the stream

### 2. Zustand Store Update — `useStreamStore.ts`

Add new state:
- `hypeLevel: number` (0-100, persisted per session)
- `boostHype: (amount: number) => void` — capped at 100
- Hype boosts on chat messages (+2), gifts (+10), reactions (+5)

### 3. AI Panel Upgrade — Rename to "PULSE" — `AICatchUpPanel.tsx`

Redesign the AI panel to match the reference:
- Rename header from "Catch Me Up" to "PULSE" with italic font-black styling
- Add **Hot Topic** card: AI-generated trending insight from chat
- Add **Sentiment** indicator: colored dot + percentage (e.g., "92% Positive")
- Add **Active Carts** indicator (or "Active Engagement" for non-commerce streams)
- Keep existing bullets + pinned links sections
- Update edge function response to include `hotTopic`, `sentimentScore`, `sentimentLabel`

### 4. Edge Function Update — `stream-ai-summary/index.ts`

Update the AI prompt to also return:
- `hotTopic: string` — the dominant discussion topic
- `sentimentScore: number` — 0-100
- `sentimentLabel: string` — "Positive" / "Neutral" / "Negative"
- Use tool calling to extract structured output

### 5. Fix CoPilotJoystick Actions — `CoPilotJoystick.tsx`

The Light, Sound, and Predict buttons currently do nothing because `onLightTrigger`, `onSoundTrigger`, `onPredictiveBet` are not wired up in `StreamRoomV2.tsx`.

**In `StreamRoomV2.tsx`:**
- Add `handleLightTrigger`: broadcasts a "light_flash" event via Supabase channel → triggers a brief white flash overlay on all viewers
- Add `handleSoundTrigger`: broadcasts a "sound_effect" event → plays a short notification/airhorn sound via Web Audio API
- Add `handlePredictiveBet`: opens a prediction creation bottom sheet (similar to Poll but with outcomes + credits wagering)
- Wire these as props to `CoPilotJoystick`

**New component: `LightFlashOverlay.tsx`** — white flash animation that appears when light trigger is received
**New component: `PredictionSystem.tsx`** — bottom sheet for creating/voting on predictions (similar to PollSystem but with credit wagering)

### 6. StreamControls — Swap Gift ↔ Credits + Reduce Chat Width

**`StreamControls.tsx`:**
- Swap positions: Gift button (pink/rose gradient, Gift icon) goes where Credits/Coins currently is (rightmost), and Credits button takes Gift's old position
- Actually, per the reference code — the big pink Gift button should be prominent and the credits button smaller
- Make the Gift button larger (w-12 h-12) with `bg-gradient-to-br from-pink-500 to-rose-600` and filled Gift icon
- Make the credits/refill button smaller (w-8 h-8)
- Reduce chat input container: add `max-w-[65%]` to limit width, matching reference's more compact input

### 7. StreamChat Styling Update — `StreamChat.tsx`

Match reference code's chat bubble style:
- Each message gets a rounded card with backdrop-blur: `bg-black/30 border border-white/5 rounded-2xl p-3`
- User's own messages highlighted: `bg-yellow-400/20 border-yellow-400/30`
- Username in uppercase `text-[9px] font-black`
- Streak badge inline with username
- Add gradient mask at top: `[mask-image:linear-gradient(to_bottom,transparent,black_20%)]`

### 8. StreamHeader Update

- Move Gift button from header to controls (it's redundant with the bottom Gift button)
- Or keep it but make it a "Shop" button like reference: `px-6 h-14 bg-white/10 backdrop-blur-3xl rounded-full font-black text-xs uppercase tracking-widest`

### 9. POV Switcher Styling — `POVSwitcher.tsx`

Update to match reference's vertical right-side layout:
- Position: `absolute bottom-24 right-6 z-30 flex flex-col gap-4`
- Each angle: `w-14 h-14 rounded-2xl border-2` with active state getting `border-yellow-400 bg-yellow-400/20 scale-110 shadow-[0_0_20px_rgba(234,179,8,0.4)]`
- Icons per angle type (Users, Camera, Trophy)

### File Summary

| File | Action |
|------|--------|
| `src/stores/useStreamStore.ts` | Add hypeLevel + boostHype |
| `src/components/live/stream-v2/HypeParticles.tsx` | New |
| `src/components/live/stream-v2/HypeMeter.tsx` | New |
| `src/components/live/stream-v2/EventTicker.tsx` | New |
| `src/components/live/stream-v2/LightFlashOverlay.tsx` | New |
| `src/components/live/stream-v2/PredictionSystem.tsx` | New |
| `src/components/live/stream-v2/AICatchUpPanel.tsx` | Redesign as "PULSE" |
| `src/components/live/stream-v2/CoPilotJoystick.tsx` | No change needed |
| `src/components/live/stream-v2/StreamRoomV2.tsx` | Wire light/sound/predict handlers, add new overlays |
| `src/components/live/stream-v2/StreamControls.tsx` | Swap Gift/Credits, reduce chat width, bigger Gift button |
| `src/components/live/stream-v2/StreamChat.tsx` | Bubble styling, gradient mask, highlight own messages |
| `src/components/live/stream-v2/StreamHeader.tsx` | Remove Gift button, optionally add Shop button |
| `src/components/live/stream-v2/POVSwitcher.tsx` | Vertical right-side layout matching reference |
| `src/components/live/stream-v2/index.ts` | Add new exports |
| `supabase/functions/stream-ai-summary/index.ts` | Add hotTopic + sentiment to AI response |


# Full System Structure Audit + Implementation Plan

## ✅ Part 1: PULSE Panel Enhancement (DONE)

Host-editable cards added to `AICatchUpPanel.tsx`:
- Host can add/remove custom cards (announcements, promo codes, product highlights)
- Cards support: emoji icon, title, body text, optional link
- Stored in `live_streams.stream_features.host_cards` JSON
- Viewers see published cards; host sees edit controls
- Visual: dark glassmorphic cards with bold italic text, yellow accent labels

---

## Part 2: System Structure — What's Missing

### A. Messaging — Missing
- Music file sharing (up to 4min) — no audio file validation or music-specific UI
- Audio notes — voice recorder exists but no dedicated "audio note" type

### B. Groups — Missing
- Go Live from group — no button/flow to start a livestream scoped to a group
- Group channels (Telegram-style) — no channel concept within groups

### C. Stories — Missing
- Audio note stories — no option to record/upload audio-only stories
- Music file attachment (up to 4min) — music library is hardcoded samples, no user upload
- Text-only stories — must upload media, no text/gradient story option

### D. Calling — Missing
- Screen sharing — LiveKit supports it but UI toggle may not be wired

### E. Live Streaming — Missing
- Go Live from group chat — no integration point

### F. Channels (Telegram-style) — MISSING ENTIRELY

---

## Implementation Order

1. ~~PULSE host cards~~ ✅
2. Audio notes + music files in stories
3. Music/audio file sharing in chat (4min limit)
4. Go Live from Group
5. Channels system (needs dedicated planning)

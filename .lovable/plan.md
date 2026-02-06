

## Plan: Consolidate Live Space Controls and Clean Up UI

This plan addresses three main improvements to the Live Space Room interface:

---

### 1. Move Record Button and Hand/Speaker Queue Button to Right Side

**Current State**: The record button and speaker queue button are inside the host controls bar (desktop only) and some are in the footer.

**Change**: 
- Add a new vertical action stack on the RIGHT side of the screen (under the share button area)
- Place the following buttons in this stack:
  - Share button
  - Record button (for host)
  - Speaker Queue button (with raised hands count badge)
- Remove these items from the footer to declutter

---

### 2. Remove Transparent Shadow Around Icons

**Current State**: Several buttons have `bg-white/10` or similar semi-transparent backgrounds creating a shadow/glow effect.

**Change**: 
- Update button styling in the vertical action stack to have solid backgrounds without transparency
- Use clean, solid colors: `bg-muted` or `bg-background` with proper borders instead of `bg-white/10`

---

### 3. Consolidate Horizontal 3-Dots Menu into Vertical 3-Dots Menu

**Current State**: There are TWO 3-dot menus:
1. **Vertical 3-dots** (header, line 1333-1462): Contains share, copy link, PiP, notifications, report, block, end/leave
2. **Horizontal 3-dots** (`StreamOptionsMenu`): Used in `UnifiedControlBar` - contains similar items

**Change**:
- Merge ALL items from the horizontal 3-dots menu into the vertical 3-dots menu in the header
- The vertical menu will now include:
  - Connection retry (if reconnecting/failed)
  - Share Space / Copy Link / Picture-in-Picture
  - Refresh Audio
  - **Screen Share** (moved from footer - host only)
  - **Invite** (moved from footer - host only)  
  - **Loudspeaker Toggle** (moved from footer)
  - **Recording** (new for host)
  - **Speaker Queue** (host only)
  - View All Listeners (host only)
  - Notifications toggle (viewer only)
  - Report / Block (viewer only)
  - End/Leave Space
- Remove the horizontal 3-dots menu from the header area entirely
- Remove the standalone share button from header since it's now in the menu

---

### Technical Changes

#### File: `src/components/live/LiveSpaceRoom.tsx`

**Header Section (lines 1321-1463)**:
1. Remove the horizontal `StreamOptionsMenu` if currently present
2. Keep only ONE vertical 3-dots menu with ALL consolidated options
3. Add new menu items for:
   - Screen Share (host only)
   - Invite Users (host only)
   - Loudspeaker toggle
   - Speaker Queue with badge

**Right Side Vertical Stack (new)**:
- Add a new positioned container on the right side of the screen
- Include: Share, Record (host), Hand Queue (host)
- Use solid backgrounds (`bg-background/80 border`) instead of transparent overlays

**Footer Section (lines 1726-2008)**:
1. Remove Screen Share button (moved to menu)
2. Remove Invite button (moved to menu)
3. Remove Loudspeaker toggle (moved to menu)
4. Keep essential controls: Leave/End, Mic, Raise Hand, Chat, Gift, Volume

**Button Styling Updates**:
- Replace `bg-white/10` with `bg-background/90 border border-border`
- Ensure all action buttons have proper solid backgrounds without transparency

---

### Visual Layout After Changes

```text
+-----------------------------------------------+
|  Header: [LIVE] Title   [Back] [⋮ Vertical]   |
|                                               |
|                                               |
|     [Hosts/Speakers Area]                     |
|                                [Share]        |
|                                [Record]       |
|                                [Queue (3)]    |
|                                               |
|     [Listeners Grid]                          |
|                                               |
+-----------------------------------------------+
| [Reactions Row]                               |
| [End] [Mic] [Hand] [Chat] [Gift] [Vol]       |
+-----------------------------------------------+
```

---

### Summary of Work

| Component | Action |
|-----------|--------|
| Vertical 3-dot menu | Add Screen Share, Invite, Loudspeaker, Recording, Speaker Queue |
| Horizontal 3-dot menu | Remove entirely from header |
| Right-side action stack | NEW - Share, Record, Queue buttons |
| Footer buttons | Remove Screen Share, Invite, Loudspeaker (simplify) |
| Button styling | Remove transparent shadows, use solid backgrounds |


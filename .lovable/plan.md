
# Ads Promotion Builder Page Implementation Plan

## Overview
Create a comprehensive **Ads Promotion Builder** page accessible from the user's profile section. This feature will allow users to:
1. Create custom ads from their existing posts (videos and photos)
2. Build new ads with custom content using a TikTok-style preview builder
3. Configure targeting options (age, interests, locations)
4. Set CTA buttons and landing URLs
5. Track and manage their ad campaigns

The implementation adapts the provided reference code to integrate seamlessly with feedin's existing promotion system (`feed_ads` table, `promote_post` function, and credit-based payment model).

---

## Key Features

### 1. New Ad Builder Page (`/ads/builder`)
- **TikTok-style preview** showing how the ad will appear in the feed
- **Select from existing posts** or create a custom ad
- **Real-time preview** with device mockup
- **CTA configuration** (Shop Now, Learn More, etc.)
- **Targeting options**: age range, interests, locations
- **Budget and duration** selection using existing promotion plans

### 2. Profile Section Integration
- Add "Promote Content" option to the profile's PostsGrid dropdown
- Add "My Ads" section in profile for ad campaign management
- Quick-access button in Settings under "Discover" section

### 3. Works with Both Video and Photo+ Sections
- Ads can be created from video posts or photo posts
- Preview adapts to show how the ad appears in both feed types

---

## Technical Implementation

### New Files to Create

#### 1. `src/pages/AdBuilder.tsx`
Full-featured ad creation page with:
- Device mockup preview (adapted from reference code)
- Form for ad configuration (brand name, caption, CTA)
- Post selector modal to pick existing posts
- Targeting configuration (age slider, interests, location toggle)
- Integration with existing `feed_ads` table
- Credit-based payment using `user_credits`

```text
+----------------------------------+
|  Header: Create Ad               |
|  [Back] [Credits: 150]          |
+----------------------------------+
|                                  |
|   +------------------------+     |
|   |  Device Mockup         |     |
|   |  +------------------+  |     |
|   |  | Video/Image      |  |     |
|   |  | Preview          |  |     |
|   |  |                  |  |     |
|   |  | [Sponsored]      |  |     |
|   |  | @brand_name      |  |     |
|   |  | Caption text...  |  |     |
|   |  | [Shop Now] CTA   |  |     |
|   |  +------------------+  |     |
|   +------------------------+     |
|                                  |
|   Tabs: [Content] [Targeting]    |
|         [Budget] [Preview]       |
|                                  |
|   Form Fields:                   |
|   - Select Post / Upload Media   |
|   - Brand Name                   |
|   - Ad Caption                   |
|   - CTA Button Text              |
|   - Landing URL                  |
|                                  |
+----------------------------------+
|  [Launch Ad - 100 Credits]       |
+----------------------------------+
```

#### 2. `src/components/ads/AdPreviewDevice.tsx`
Reusable device mockup component for ad preview:
- Displays post content in a phone-style frame
- Shows "Sponsored" badge
- Renders CTA button with selected style
- Supports both video and image content

#### 3. `src/components/ads/PostSelectorModal.tsx`
Modal to select an existing post for promotion:
- Grid of user's posts (videos and photos)
- Filters for media type
- Quick preview of selected post

#### 4. `src/components/ads/AdTargetingForm.tsx`
Targeting configuration component:
- Age range slider (13-65+)
- Interest selection chips
- Location toggle (global vs specific countries)
- Gender targeting (optional)

#### 5. `src/hooks/useUserAds.tsx`
Hook for managing user's ad campaigns:
- Fetch user's active and past ads from `feed_ads`
- Create new ad entries
- Update ad status
- Track spend and impressions

### Files to Modify

#### 1. `src/App.tsx`
Add new routes:
```tsx
const AdBuilder = lazy(() => import("./pages/AdBuilder"));
const MyAds = lazy(() => import("./pages/MyAds"));

// In Routes
<Route path="/ads/builder" element={<AdBuilder />} />
<Route path="/ads/builder/:postId" element={<AdBuilder />} />
<Route path="/ads/my-ads" element={<MyAds />} />
```

#### 2. `src/components/profile/PostsGrid.tsx`
Add "Promote" option to the dropdown menu:
```tsx
<DropdownMenuItem 
  onClick={() => navigate(`/ads/builder/${post.id}`)}
  className="cursor-pointer"
>
  <Rocket className="w-4 h-4 mr-2" />
  Promote Post
</DropdownMenuItem>
```

#### 3. `src/pages/Settings.tsx`
Add "My Ads" to the contentOptions array:
```tsx
{
  icon: Rocket,
  title: 'Manage Ads',
  description: 'Create and track your ad campaigns',
  route: '/ads/my-ads',
  color: 'text-amber-500'
}
```

#### 4. `src/pages/Profile.tsx`
Add quick-access "Create Ad" button for own profile, near the Posts section header.

---

## Database Integration

### Using Existing `feed_ads` Table
The `feed_ads` table already has all necessary columns:
- `advertiser_id`: User creating the ad
- `title`, `description`: Ad content
- `media_url`, `media_type`: Media from selected post
- `click_url`: CTA landing page
- `daily_budget_credits`, `total_budget_credits`: Budget settings
- `target_age_min`, `target_age_max`: Age targeting
- `target_interests`: Interest-based targeting
- `target_countries`, `target_cities`: Location targeting
- `target_genders`: Gender targeting
- `is_active`, `approval_status`: Status tracking
- `impressions`, `clicks`, `ctr`: Analytics

### Credit Deduction Flow
1. User selects budget plan (uses existing `promotionPlans` from Promote.tsx)
2. Validate user has sufficient credits via `user_credits.balance`
3. On ad creation:
   - Deduct credits from `user_credits`
   - Create entry in `feed_ads`
   - Log transaction in `credit_transactions`

---

## UI/UX Details

### Device Mockup Preview
- Phone-shaped container with rounded corners
- Gradient background simulating content
- Real-time updates as user edits form
- Animated "Sponsored" badge matching feed style

### CTA Options
```tsx
const ctaOptions = [
  'Shop Now',
  'Learn More', 
  'Download',
  'Sign Up',
  'Contact Us',
  'Apply Now',
  'Book Now',
  'Get Quote'
];
```

### Targeting Interests
```tsx
const targetingInterests = [
  'Technology', 'Gaming', 'Music', 'Sports', 'Fashion', 
  'Food', 'Travel', 'Fitness', 'Art', 'Photography', 
  'Business', 'Education', 'Entertainment', 'Lifestyle'
];
```

### Color Theme
Uses the existing pink/rose theme with gradients:
- Primary buttons: `from-pink-500 to-rose-500`
- Sponsored badge: `from-amber-500 via-orange-500 to-pink-500`
- Success states: `from-emerald-500 to-teal-500`

---

## Navigation Flow

```text
Profile Page
    └── Posts Grid
         └── Post Options Menu
              └── "Promote Post" → /ads/builder/:postId
              
Profile Page (Own Profile)
    └── "Create Ad" Button → /ads/builder
    
Settings Page
    └── Discover Section
         └── "Manage Ads" → /ads/my-ads
              └── "New Ad" Button → /ads/builder
              └── Ad Campaign Card → Analytics/Edit
```

---

## Summary of Changes

| File | Action | Description |
|------|--------|-------------|
| `src/pages/AdBuilder.tsx` | Create | Main ad builder page with device preview |
| `src/pages/MyAds.tsx` | Create | Ad campaign management dashboard |
| `src/components/ads/AdPreviewDevice.tsx` | Create | Phone mockup preview component |
| `src/components/ads/PostSelectorModal.tsx` | Create | Modal to select existing posts |
| `src/components/ads/AdTargetingForm.tsx` | Create | Targeting configuration component |
| `src/hooks/useUserAds.tsx` | Create | Hook for ad management |
| `src/App.tsx` | Modify | Add routes for new pages |
| `src/components/profile/PostsGrid.tsx` | Modify | Add "Promote" option to menu |
| `src/pages/Settings.tsx` | Modify | Add "Manage Ads" option |
| `src/pages/Profile.tsx` | Modify | Add "Create Ad" button |

---

## Credit Cost Structure
Uses existing promotion plans from `Promote.tsx`:
- Starter (25 credits): 12 hours, 500+ reach
- Basic (50 credits): 24 hours, 1,500+ reach
- Pro (100 credits): 3 days, 5,000+ reach
- Premium (200 credits): 7 days, 15,000+ reach
- Elite (500 credits): 14 days, 50,000+ reach

# Flatlist App – Reference Document for Landing Page Design

This document provides a comprehensive overview of the Flatlist app: functionality, architecture, and complete styling guidelines for creating a coherent landing page.

---

## 1. App Overview

**Name:** Flatlist (formerly CasaPin)  
**Tagline:** Smart Apartment Hunting  
**Description:** AI-powered apartment shortlist assistant for Italian real estate. Users save listings from anywhere, then use AI to search and compare them intelligently.

**Tech Stack:**
- **Frontend:** Next.js 16, React 19, Tailwind CSS 4
- **Backend:** Supabase (auth, DB, Edge Functions)
- **Maps:** Mapbox GL
- **Payments:** Polar.sh
- **Extension:** Chrome extension (Manifest V3)

---

## 2. Current Functionality

### 2.1 Core Features

1. **Save listings** – Chrome extension lets users save apartment listings from any website with one click
2. **AI enrichment** – Saved listings are enriched by AI with metadata (price, address, bedrooms, bathrooms, student-friendly, natural light, noise level, floor type, renovation state, pet-friendly, balcony, etc.)
3. **AI search** – Natural language search (e.g. "Quiet apartments for students near M2 under 900€")
4. **Dream apartment** – Users describe their ideal apartment; AI scores each listing 0–100 against it
5. **Map view** – Full-screen Mapbox map with clustering, 3D perspective, optional transit line overlay
6. **List view** – Grid of listing cards with price, address, metadata, and AI match score

### 2.2 Search Filters (AI-parsed)

- `noise_level`: low, medium, high
- `student_friendly`: boolean
- `natural_light`: low, medium, high
- `floor_type`: wood, tile, unknown
- `renovation_state`: new, ok, old
- `price_max` / `price_min`
- `size_sqm_min`, `rooms_min`, `bedrooms_min`, `bathrooms_min`
- `location_keywords`: neighborhoods
- `distance_max` + `distance_reference`: e.g. within 1.5km from M2 metro

### 2.3 Collaboration (Premium)

- Shared catalogs
- Invite collaborators via email
- Per-user notes
- Profile avatars with user-specific colors

### 2.4 Auth & Payments

- Magic link (passwordless) via Supabase
- Free: 12 listings, AI search, solo mode
- Premium (€5.99/mo): unlimited listings, multiplayer, collaborators

### 2.5 Pages/Routes

| Route | Purpose |
|-------|---------|
| `/` | Main catalog (map/list, dream apartment, search) |
| `/search` | Standalone search page (natural language) |
| `/auth` | Magic link sign-in |
| `/auth/callback` | Auth redirect |
| `/settings` | Extension token sync |
| `/invite/accept` | Accept catalog invitation |
| `/privacy-policy` | Privacy policy |

---

## 3. Styling Guidelines

### 3.1 Colors

| Name | Value | Usage |
|------|-------|--------|
| **Background** | `#0B0B0B` | Main app background |
| **Foreground** | `#ffffff` | Primary text |
| **Primary/Brand** | `#FF5C5C` | Logo, primary buttons, extension button |
| **Gray-50** | `bg-gray-50` | Search page background |
| **Gray-200** | `text-gray-200` | Secondary text |
| **Gray-300** | `text-gray-300` | Tertiary text |
| **Gray-400** | `text-gray-400` | Muted text, metadata |
| **Gray-500** | `text-gray-500` | Placeholders |
| **Gray-600** | `bg-gray-600` | Toggle off, borders |
| **Gray-700** | `border-gray-700`, `bg-gray-700` | Borders, panels |
| **Gray-800** | `bg-gray-800` | Dark panels, empty state |
| **Gray-900** | `bg-gray-900` | Dark surfaces, modals |
| **Blue-100/Blue-800** | Filter pills | Search filter chips |
| **Green-500** | AI score ≥70 | High match |
| **Yellow-400** | AI score 40–69 | Medium match |
| **Red-400** | AI score <40 | Low match |

### 3.2 Fonts

| Element | Font | Weight | Notes |
|---------|------|--------|-------|
| **Primary** | Satoshi (local) | 400, 500, 700 | `--font-sans` variable |
| **Logo** | Junicode Bold Condensed | 700 | For "flatlist" wordmark |
| **Body** | `var(--font-sans)`, -apple-system, BlinkMacSystemFont, Segoe UI | — | Fallback stack |
| **Headings** | — | 700 (bold), 600 (semibold) | `text-xl`, `text-2xl`, `text-3xl` |
| **Price** | — | 700 | Bold white |
| **Metadata** | — | 400 | Gray-400, `text-xs`, `text-sm` |
| **Buttons** | — | 500 (medium), 600 (semibold) | `text-sm` |
| **AI score tag** | — | 600 | White on glass |

**Satoshi font files:** `fonts/Satoshi-Regular.woff2`, `Satoshi-Medium.woff2`, `Satoshi-Bold.woff2`

### 3.3 Border Radius System

| Token | Value | Usage |
|-------|-------|--------|
| `rounded-[12px]` | 12px | Extension button |
| `rounded-[14px]` | 14px | Tooltips |
| `rounded-[20px]` | 20px | Listing cards, map, modals, CTA pills, image container |
| `rounded-[30px]` | 30px | Dream apartment button, AI score tags, main modals, empty-state CTA, map hover preview |

### 3.4 Glassmorphism

Standard glassmorphism pattern used across the app:

```css
backdrop-blur-md
background: rgba(0, 0, 0, 0.6)  /* or bg-black/60 */
border: 1px solid rgba(255, 255, 255, 0.15)  /* border-white/15 */
box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)
/* or shadow-lg */
backdrop-filter: blur(12px);  /* inline style for consistency */
```

**Used in:**
- Dream apartment button (header): `bg-black/60`, `border-white/15`, `rounded-[30px]`
- AI score tags (ListingCard, MapView, MetadataViewer): same pattern
- Tooltip: `bg-black/60`, `border-white/15`, `rounded-[14px]`
- Image carousel arrows / image counter: `bg-black/60`, `border-white/15`, `rounded-full` / `rounded-[20px]`
- "Go to website" button: `bg-white/10`, `border-white/20`, `rounded-[20px]`
- Dream apartment modal: `bg-black/80`, `border-white/15`, `rounded-[30px]`
- Modal backdrops: `backdrop-blur-md bg-white/10`

### 3.5 AI Score Tags (Detailed Spec)

**Structure:** Pill shape with colored dot + numeric score (optionally `+n` for clustered markers).

**Dimensions:**
- Padding: `0.375rem 0.75rem` (px-3 py-1.5) or `px-4 py-2` in detail view
- Border radius: `30px` (pill)
- Dot size: `6px × 6px` (or `w-1.5 h-1.5`, `w-2 h-2` in modal)

**Glassmorphism:**
- `backdrop-filter: blur(12px)`
- `background: rgba(0, 0, 0, 0.6)` (Tailwind: `bg-black/60`)
- `border: 1px solid rgba(255, 255, 255, 0.15)` (Tailwind: `border-white/15`)
- `box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)` (Tailwind: `shadow-lg`)

**Score color & glow:**

| Score | Tailwind | Hex | Box-shadow |
|-------|----------|-----|------------|
| ≥70 | `bg-green-500` | #22c55e | `0 0 10px 3px rgba(34, 197, 94, 0.55)` |
| 40–69 | `bg-yellow-400` | #facc15 | `0 0 10px 3px rgba(250, 204, 21, 0.55)` |
| <40 | `bg-red-400` | #f87171 | `0 0 10px 3px rgba(248, 113, 113, 0.55)` |

**Typography:** `font-size: 0.875rem`, `font-weight: 600`, `color: white`

### 3.6 Map Styling

**Mapbox configuration:**
- Style: `mapbox://styles/mapbox/standard`
- Light preset: `dusk`
- Default zoom: `16.5` (detail), `12` (list view)
- Pitch: `60`
- Bearing: `-17`

**Markers:**
- Default dot: `#ef4444` (red-500), 12px, white 2px border
- Clustered AI tag: same pill as above with score

**Transit line overlay:**
- Color: `#00e5ff`
- Width: `5px`
- Line join/cap: round

**Map containers:**
- Border radius: `20px`
- Background: `bg-gray-900` or `bg-gray-800/50`
- Border: `border-gray-700`

**Hover preview (MapView):**
- Size: `200×150px`
- Border radius: `30px`
- Glass: `bg-black/40`, `border-white/15`, `shadow-xl`

### 3.7 Buttons & CTAs

| Type | Background | Text | Border radius |
|------|------------|------|---------------|
| **Primary** | `#FF5C5C` | white | `rounded-md` |
| **White CTA** | `bg-white` | black | `rounded-[30px]` |
| **Outline** | transparent | gray | `border border-gray-700`, `rounded-xl` |
| **Glass** | `bg-black/60` | white | `rounded-[30px]` |

### 3.8 User Avatar Colors

Deterministic palette (from `lib/user-colors.ts`):

```
#FF5C5C, #3B82F6, #10B981, #F59E0B, #8B5CF6, #EC4899,
#06B6D4, #F97316, #84CC16, #6366F1, #14B8A6, #EF4444
```

- Size: `40×40px` (`h-[40px] w-[40px]`)
- Border radius: `rounded-full`
- Font: `font-semibold`, first letter of email

---

## 4. Assets & Branding

- **Logo:** `/logo.svg`, `/flatlist outline logo.svg`
- **Loading:** `/flatlist rotating logo.mp4`
- **Favicon:** `/logo.svg`

---

## 5. Extension Styling

- **Button:** `#FF5C5C`, 48×48px, `border-radius: 12px`
- **Font:** Satoshi Bold for "fl" text
- **Save button:** Same red, `border-radius: 6px`

---

## 6. Landing Page Recommendations

When building the landing page, ensure:

1. **Brand consistency:** Use `#0B0B0B` and `#FF5C5C` as primary palette
2. **Typography:** Load Satoshi for headlines and body
3. **Glassmorphism:** Apply the same pattern for hero cards, feature highlights, and CTAs
4. **AI score badges:** Reuse the AI score tag styling for "match score" or "AI-powered" badges
5. **Border radius:** Use the same radius tokens (`20px`, `30px`) for key elements
6. **Map imagery:** If showing map screenshots, use Mapbox dusk preset for visual consistency
7. **Dark theme:** Main app is dark; landing page can be light or dark but should feel cohesive

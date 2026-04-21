# Royal Note Design System

## Company Overview

**Royal Note** is a B2B wholesale fragrance platform — a clean, public-facing catalogue designed for trade buyers to discover fragrance products and submit quote requests. It is not a direct-to-consumer shop; its audience is wholesale buyers, distributors, and procurement professionals.

The aesthetic is inspired by Bloomingdale's luxury department store — editorial, minimal, and professional — adapted for a trade/B2B context.

**Sources provided:** Brand brief (no external codebase or Figma link attached — system built from brand spec only).

---

## Products / Surfaces

1. **Public Catalogue Website** — product discovery grid, product detail pages, filter/search, quote request flow
2. **(Future) Buyer Portal** — account login, order history, saved lists (referenced but not built out yet)

---

## CONTENT FUNDAMENTALS

### Tone & Voice
- **Professional and minimal.** Let products speak. No puffery, no hype.
- Copy is short and direct: *"A clean public catalogue for wholesale discovery."*
- Labels and categories are **UPPERCASE, letter-spaced** — this is a deliberate brand pattern, not an afterthought.
- Headings may use sentence case or title case for editorial weight.
- Body copy uses sentence case.

### Casing Rules
| Element | Case |
|---|---|
| Category labels, tags, brand names | ALL CAPS |
| Section headings | Title Case or Sentence case |
| Body copy, descriptions | Sentence case |
| Button labels | UPPERCASE |
| Badges (LIMITED, EXCLUSIVE) | ALL CAPS |

### Persona
- Speaks to professional buyers, not consumers
- No emoji — too casual for this brand
- No exclamation marks in core UI copy
- Avoid superlatives; let product names and specs do the work
- "We" is acceptable in formal CTAs ("Contact Us", "Request a Quote")

### Example Copy Patterns
- Hero: *"Wholesale Fragrance Discovery for Trade Buyers"*
- Product card subtext: *"Available in 3 variants · MOQ 12 units"*
- CTA: *"REQUEST A QUOTE"* / *"WHATSAPP US"*
- Empty state: *"No products match your current filters."*
- Filter label: *"CATEGORY"* / *"BRAND"* / *"BUYER TYPE"*

---

## VISUAL FOUNDATIONS

### Colors
| Token | Hex | Use |
|---|---|---|
| `--color-text` | `#141413` | Primary text, headings |
| `--color-bg` | `#FFFFFF` | Page background |
| `--color-surface` | `#FAF9F5` | Cards, section backgrounds (warm off-white) |
| `--color-border` | `#EEEEEE` | Dividers, input borders |
| `--color-muted` | `#949494` | Secondary text, labels, placeholders |
| `--color-overlay` | `rgba(0,0,0,0.85)` | Modals, image overlays |
| `--color-accent` | `#4D49BE` | Indigo — CTAs, badges, highlights |
| `--color-whatsapp` | `#25D366` | WhatsApp CTA only |

### Typography
- **Display / Editorial:** Playfair Display (serif) — for hero headings, product names, section titles
- **Body / UI:** Inter — for labels, descriptions, navigation, inputs
- Scale: 11 / 12 / 13 / 14 / 16 / 18 / 20 / 42px
- Weights: 400, 500, 600, 700
- Line heights: 18px body, 22–24px sub, generous for display

### Spacing
- Base grid: **4px**
- Component padding: 12 / 16 / 24 / 32px
- Section spacing: 48 / 64 / 80px
- Max content width: **1200px centered**

### Backgrounds
- Primary: white (`#FFFFFF`)
- Cards/sections: warm off-white (`#FAF9F5`)
- No full-bleed gradients, no heavy textures
- Product images on clean white/light gray backgrounds only

### Borders & Radius
| Element | Radius |
|---|---|
| Buttons | 8px |
| Cards | 12–16px |
| Inputs | 6–8px |
| Badges/Tags | 28–36px (pill) |

### Shadows
- Cards: subtle `box-shadow: 0 1px 4px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)`
- Hover lift: `box-shadow: 0 4px 16px rgba(0,0,0,0.10)`
- No heavy drop shadows; keep it editorial and clean

### Animations & Transitions
- Duration: `0.2s ease`
- Hover: subtle opacity reduction or shadow lift — no color changes on text
- Focus: clean 2px outline in `--color-accent`, no heavy glow
- No bounces, no spring physics — keep it restrained and professional
- Transitions on: opacity, box-shadow, transform (lift)

### Hover States
- Cards: `translateY(-2px)` + shadow lift
- Buttons: slight darkening of fill or border
- Links: underline appears on hover

### Cards
- White or surface background
- 12–16px border radius
- 1px subtle border (`#EEEEEE`) or shadow
- Image top (4:3 or square)
- Brand name: uppercase, small, muted
- Product name: bold serif, larger
- Metadata: gray, small

### Imagery
- Product shots: clean white or light gray backgrounds
- No lifestyle photography in the catalogue grid
- Full-bleed imagery acceptable for hero sections only
- No grain, no filters — clean and neutral

### Layout
- Max-width container: 1200px, centered
- Card grids: 2–4 columns responsive (CSS Grid)
- Navigation: minimal top bar, logo centered, search prominent
- No fixed sidebars — horizontal filter rows instead

---

## ICONOGRAPHY

Royal Note uses **line-style icons** at minimal stroke weight — consistent with the minimal premium aesthetic. No filled icons in the primary UI.

- **CDN:** Lucide Icons (via CDN) — closest match to the specified line-weight style
- No built-in icon font from codebase (none provided)
- No emoji used in UI
- Logo: "Royal Note" wordmark + a sparkle/star motif
- See `assets/` for logo SVG

Usage rules:
- Icons never appear alone without accessible labels or tooltips
- Size: 16px in dense UI, 20px in standard, 24px in prominent areas
- Stroke color: `--color-text` or `--color-muted`
- Never use icons as decorative fill

---

## File Index

```
README.md                        — This file
SKILL.md                         — Agent skill descriptor
colors_and_type.css              — CSS variables (colors, type, spacing)
assets/
  logo.svg                       — Royal Note wordmark + mark
  icons.svg                      — Icon sprite (Lucide subset)
preview/
  colors-primary.html            — Primary + surface color swatches
  colors-semantic.html           — Semantic/state colors
  type-display.html              — Display / editorial type scale
  type-body.html                 — Body / UI type scale
  spacing-tokens.html            — Spacing scale tokens
  spacing-radii.html             — Border radius + shadow system
  components-buttons.html        — Button variants
  components-badges.html         — Badge/tag variants
  components-inputs.html         — Form input states
  components-cards.html          — Product card variants
  components-nav.html            — Navigation bar
  brand-logo.html                — Logo + wordmark
ui_kits/
  catalogue/
    README.md                    — UI kit notes
    index.html                   — Interactive catalogue prototype
    Header.jsx                   — Top nav with search
    ProductCard.jsx              — Product card component
    FilterBar.jsx                — Horizontal filter row
    ProductGrid.jsx              — Catalogue grid
    ProductDetail.jsx            — Product detail panel
```

---
name: Viridian Ledger
colors:
  surface: '#fbf9f8'
  surface-dim: '#dbdad9'
  surface-bright: '#fbf9f8'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f5f3f3'
  surface-container: '#efeded'
  surface-container-high: '#e9e8e7'
  surface-container-highest: '#e4e2e2'
  on-surface: '#1b1c1c'
  on-surface-variant: '#3f4943'
  inverse-surface: '#303031'
  inverse-on-surface: '#f2f0f0'
  outline: '#6f7973'
  outline-variant: '#bfc9c1'
  surface-tint: '#1b6b4d'
  primary: '#00422c'
  on-primary: '#ffffff'
  primary-container: '#005c3f'
  on-primary-container: '#87d2ad'
  inverse-primary: '#8ad6b1'
  secondary: '#57605e'
  on-secondary: '#ffffff'
  secondary-container: '#dbe5e1'
  on-secondary-container: '#5d6663'
  tertiary: '#790010'
  on-tertiary: '#ffffff'
  tertiary-container: '#a40019'
  on-tertiary-container: '#ffada8'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#a6f3cc'
  primary-fixed-dim: '#8ad6b1'
  on-primary-fixed: '#002114'
  on-primary-fixed-variant: '#005137'
  secondary-fixed: '#dbe5e1'
  secondary-fixed-dim: '#bfc9c5'
  on-secondary-fixed: '#141d1b'
  on-secondary-fixed-variant: '#3f4946'
  tertiary-fixed: '#ffdad7'
  tertiary-fixed-dim: '#ffb3ae'
  on-tertiary-fixed: '#410005'
  on-tertiary-fixed-variant: '#930015'
  background: '#fbf9f8'
  on-background: '#1b1c1c'
  surface-variant: '#e4e2e2'
typography:
  display-lg:
    fontFamily: Manrope
    fontSize: 24px
    fontWeight: '800'
    lineHeight: 32px
    letterSpacing: 0.02em
  headline-md:
    fontFamily: Manrope
    fontSize: 18px
    fontWeight: '700'
    lineHeight: 24px
  title-sm:
    fontFamily: Manrope
    fontSize: 14px
    fontWeight: '700'
    lineHeight: 20px
  body-md:
    fontFamily: Manrope
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
  body-sm:
    fontFamily: Manrope
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
  label-bold:
    fontFamily: Manrope
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 16px
  data-numeric:
    fontFamily: Manrope
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  container-padding: 2rem
  stack-gap-lg: 1.5rem
  stack-gap-md: 1rem
  stack-gap-sm: 0.5rem
  table-cell-padding: 0.75rem 1rem
---

## Brand & Style

The design system is engineered for financial clarity, administrative trust, and professional record-keeping. Drawing inspiration from institutional reports and modern SaaS dashboards, the aesthetic is **Corporate / Modern** with a focus on high information density and structural rigor.

The UI evokes an emotional response of security and precision. By utilizing a disciplined Viridian green palette paired with generous whitespace, the system ensures that complex financial data remains readable and non-intimidating. The style emphasizes "document-first" thinking, where digital interfaces maintain the authority and structure of a physical audit report.

## Colors

This design system utilizes a professional palette centered on **Viridian Green** to signify growth and financial stability.

- **Primary (Viridian):** Used for headers, primary icons, and success states (e.g., income/additions).
- **Secondary (Mint Tint):** A low-saturation green used for subtle background fills, hover states, and soft containers to reduce visual fatigue.
- **Semantic Red:** Reserved strictly for "Out" transactions, deficits, or administrative warnings.
- **Neutral Stack:** A range of grays from deep charcoal for body text to light cool-grays for borders and decorative dividers.
- **Surface:** A pure white (#FFFFFF) base is required to maintain the "report" aesthetic, ensuring maximum contrast for data entry and review.

## Typography

**Manrope** is the sole typeface, chosen for its geometric clarity and excellent legibility in numeric data.

- **Hierarchy:** Section headers use uppercase styling with bold weights to create clear anchoring points in long reports.
- **Numerical Data:** All financial figures must use `tabular-nums` to ensure decimal points and currency symbols align vertically across rows.
- **Contextual Coloring:** Typography shifts to Primary Green for positive values and Semantic Red for negative values within the "Amount" columns.
- **Metadata:** Use `body-sm` in a neutral gray for timestamps, version numbers, and secondary descriptions to keep the focus on primary data.

## Layout & Spacing

The layout follows a **Fixed Grid** philosophy, emulating an A4 document structure for seamless export to PDF. 

- **Structural Rhythm:** Information is organized into numbered horizontal modules. Each module is separated by a consistent 24px (1.5rem) vertical gap.
- **Internal Alignment:** Within modules, a 3-column or 4-column sub-grid is used for "Summary Cards."
- **Data Tables:** Tables utilize a "Full-Bleed Internal" style where the header spans the full width of the container, and rows are separated by 1px neutral borders.
- **Responsive Behavior:** On mobile, the multi-column summary cards stack vertically, while data tables transition to a horizontal scroll or "card-view" format.

## Elevation & Depth

This design system avoids heavy shadows in favor of **Tonal Layers** and **Low-Contrast Outlines**.

- **Surfaces:** The primary background is a light neutral. Secondary surfaces (like cards or input areas) are defined by 1px solid borders in a light gray (#E0E0E0) rather than elevation.
- **Interactive States:** Soft background tints (Secondary Green) are used to indicate interactivity.
- **Dividers:** Horizontal rules are used sparingly to separate major report sections, utilizing a 1px weight with a 20% opacity of the primary color.
- **Focus:** No backdrop blurs or glassmorphism are permitted; the goal is flat, matte clarity.

## Shapes

The shape language is **Soft** but disciplined. 

- **Containers:** Summary cards and data modules use a 0.25rem (4px) border radius to provide a modern feel without appearing overly casual.
- **Icons:** Icon containers (circular or soft-square) follow the same radius logic.
- **Tables:** Table headers remain sharp (0px) on the bottom edge to maintain a seamless connection with the data rows below, while the top corners may inherit the container's 4px radius.

## Components

### Summary Cards
Used for "At-a-Glance" metrics. These feature a 1px border, a left-aligned icon in a muted color-coded container, and a vertical stack of "Label" and "Value."

### Data Tables
The core of the system. 
- **Headers:** Solid Primary Green background with white uppercase text.
- **Rows:** Alternating "Zebra" striping is discouraged; use subtle 1px bottom borders instead.
- **Summary Rows:** Located at the bottom of tables, these use a bold weight and a slightly larger font size to denote totals.

### Status Chips
Small, pill-shaped indicators used for categories (e.g., "Administrasi"). These use a high-transparency fill of the semantic color with centered bold text.

### Verification Blocks
Specialized components at the foot of documents for signatures and digital hashes. These utilize dashed borders to indicate "placeholders" or areas of official endorsement.

### Icons
Stroke-based (linear) icons with a 2px consistent weight. Icons should be paired with background shapes that reflect their semantic meaning (Green for income, Red for expense).
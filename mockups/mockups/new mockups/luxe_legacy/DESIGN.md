---
name: Luxe Legacy
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#45464d'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#76777d'
  outline-variant: '#c6c6cd'
  surface-tint: '#565e74'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#131b2e'
  on-primary-container: '#7c839b'
  inverse-primary: '#bec6e0'
  secondary: '#7a5820'
  on-secondary: '#ffffff'
  secondary-container: '#fed08c'
  on-secondary-container: '#79571f'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#0d1c2f'
  on-tertiary-container: '#76859b'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae2fd'
  primary-fixed-dim: '#bec6e0'
  on-primary-fixed: '#131b2e'
  on-primary-fixed-variant: '#3f465c'
  secondary-fixed: '#ffddb0'
  secondary-fixed-dim: '#ecbf7d'
  on-secondary-fixed: '#281800'
  on-secondary-fixed-variant: '#5f4109'
  tertiary-fixed: '#d5e3fd'
  tertiary-fixed-dim: '#b9c7e0'
  on-tertiary-fixed: '#0d1c2f'
  on-tertiary-fixed-variant: '#3a485c'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
  midnight-navy: '#0F172A'
  estate-gold: '#B48C4F'
  charcoal-slate: '#334155'
  paper-white: '#FFFFFF'
  success-emerald: '#10B981'
typography:
  display-lg:
    fontFamily: Libre Caslon Text
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Libre Caslon Text
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
  headline-lg-mobile:
    fontFamily: Libre Caslon Text
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
  headline-md:
    fontFamily: Libre Caslon Text
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Hanken Grotesk
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Hanken Grotesk
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Hanken Grotesk
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.05em
  caption:
    fontFamily: Hanken Grotesk
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 8px
  container-max: 1280px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 40px
  section-gap: 80px
---

## Brand & Style

The design system is engineered to project **authority, exclusivity, and unwavering professionalism**. Targeted at high-net-worth home buyers and sellers, the aesthetic balances the timeless elegance of luxury real estate with the precision of a modern technology platform.

The chosen style is **Modern Corporate with Minimalist influences**. It leverages generous whitespace to let high-quality property photography breathe, while employing sophisticated typography and a high-contrast palette to establish a "digital storefront" feel. The interface avoids unnecessary flourishes, opting instead for structural integrity, clear hierarchies, and subtle interactive cues that guide the user toward lead capture moments.

**Key Brand Pillars:**
- **Prestige:** Evoked through deep tones and serif headings.
- **Clarity:** Driven by a rigorous grid and functional sans-serif body text.
- **Trust:** Established through structured data presentation and prominent social proof (reviews).

## Colors

The palette is anchored by **Midnight Navy**, providing a deep, stable foundation that signifies institutional trust. **Estate Gold** is used sparingly as an accent for high-priority calls to action (CTAs), gold-standard badges, and interactive highlights, creating a sense of premium service.

**Neutral tones** (Paper White and Slate) handle the bulk of the layout, ensuring that property imagery remains the focal point without chromatic competition. Success Emerald is reserved strictly for status indicators like "Just Sold" or form submission confirmations.

- **Primary:** Navy (#0F172A) for headers, primary buttons, and heavy text.
- **Accent:** Gold (#B48C4F) for luxury markers and primary conversion points.
- **Surface:** A mix of pure white and ultra-light gray (#F8FAFC) to create subtle depth between sections.

## Typography

This design system utilizes a high-contrast typographic pairing to bridge the gap between "Established Agency" and "Modern Tech."

- **Serif (Libre Caslon Text):** Used for headlines and display text. It carries historical weight and literary elegance, perfect for showcasing the prestige of property listings.
- **Sans-Serif (Hanken Grotesk):** A sharp, contemporary grotesque used for all functional text, UI labels, and body copy. It ensures maximum readability on mobile devices and high-density data tables in the Admin Dashboard.

**Usage Rules:**
- Use `display-lg` exclusively for Hero sections.
- Use `label-md` for small eyebrow text above headlines or for property status badges (e.g., "FOR SALE").
- Ensure a minimum of 24px spacing between headline levels and body text to maintain an "editorial" feel.

## Layout & Spacing

The layout follows a **Fluid-Fixed Hybrid** model. Content is contained within a 1280px max-width wrapper on desktop to prevent eye strain, while fluidly adapting to smaller viewports.

**Grid System:**
- **Desktop:** 12-column grid with 24px gutters.
- **Tablet:** 6-column grid with 20px gutters.
- **Mobile:** 2-column grid with 16px margins.

**Rhythm:**
A strict 8px baseline grid governs all vertical rhythm. Component spacing should favor "openness"—use `section-gap` (80px) between major landing page modules to signify distinct transitions and provide a high-end, unhurried browsing experience. Property cards should utilize a consistent 1:1 or 4:3 aspect ratio for imagery to maintain grid alignment.

## Elevation & Depth

To maintain a sophisticated and clean aesthetic, this design system avoids heavy shadows, instead using **Tonal Layering** and **Low-Contrast Outlines**.

- **Surface Levels:** The primary background is `paper-white`. Secondary content areas (like search filters or property specifications) use the `neutral-color` (#F8FAFC) to create a subtle recessed effect.
- **Outlines:** Elements like input fields and card borders use a 1px border in a lightened version of `charcoal-slate` (approx 15% opacity). 
- **Elevation:** High-priority floating elements (like the "Schedule Showing" mobile sticky bar) use a "Silk Shadow": a very soft, multi-layered blur (0px 10px 30px rgba(15, 23, 42, 0.08)) to suggest depth without visual clutter.

## Shapes

The shape language is **Soft and Precise**. A low corner radius (0.25rem / 4px) is applied to most UI elements, including buttons, input fields, and property cards. 

This specific degree of roundedness is chosen because it feels more modern than sharp 90-degree corners, yet more professional and "architectural" than highly rounded or pill-shaped elements. It mirrors the structural lines found in high-end residential architecture.

- **Standard Radius:** 4px (Soft)
- **Large Radius (Cards):** 8px (rounded-lg)
- **Interactive Elements:** Buttons and form inputs must match the 4px standard for consistency.

## Components

### Buttons
- **Primary:** Solid Midnight Navy with White text. Square edges with a 4px radius. High-intensity hover state uses a subtle transition to Estate Gold.
- **Secondary:** Outlined Midnight Navy or Estate Gold. Used for less urgent actions like "View Details."

### Property Cards
Cards are the primary vehicle for property data. They must feature a full-bleed image at the top, followed by a padded section containing the price (Headline-md), address (Body-md), and a horizontal list of specs (Beds/Baths/Sqft) using `label-md`.

### Lead Capture Forms
Form fields should be minimalist. Use a 1px border on all sides. Floating labels are preferred to keep the UI clean. The "Schedule a Showing" form should use a custom-styled calendar picker that adheres to the Navy/Gold color scheme.

### Badges
Status badges (e.g., "Sold," "Featured") are placed in the top-left corner of property images. They should use `label-md` typography with a solid background and high contrast (White text on Navy or Gold).

### Lists & Tables (Admin Dashboard)
The Admin Dashboard uses a "Data-First" approach. Tables should have high horizontal contrast with zebra-striping in `neutral-color` and use `Hanken Grotesk` at 14px for maximum information density.

### Navigation
The desktop header is transparent on the Hero section, transitioning to a solid `paper-white` background with a subtle bottom border on scroll. Mobile navigation uses a full-screen overlay to ensure clear focus on menu items.
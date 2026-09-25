# DevHub Landing Page — Wireframe Specification

**Document Version:** 1.0  
**Created:** 2026-09-03  
**Design System:** Dark-tech (Linear × GitHub Dark × Terminal)  
**Target:** Desktop 1440px, Tablet 1024px, Mobile 768px  

---

## 🎨 Design Token System

### Color Palette

```css
/* Background Layers */
--bg-primary: #0d1117;        /* Main page background */
--bg-secondary: #161b22;      /* Cards, sections */
--bg-tertiary: #21262d;       /* Hover states, inputs */
--bg-elevated: #30363d;       /* Modals, dropdowns */

/* Accent Colors */
--accent-primary: #34c38e;    /* Emerald — primary actions, links */
--accent-hover: #2da87e;      /* Hover state */
--accent-active: #238f6b;     /* Active/pressed state */
--accent-disabled: #1a5c45;   /* Disabled state */

/* Text Colors */
--text-primary: #e4e7ec;      /* Headings, body text */
--text-secondary: #9ca3af;    /* Subtitles, captions */
--text-tertiary: #6b7280;     /* Placeholder, disabled text */
--text-inverse: #0d1117;      /* Text on light backgrounds */

/* Semantic Colors */
--success: #34c38e;           /* Success states */
--warning: #f59e0b;           /* Warning states */
--error: #ef4444;             /* Error states */
--info: #3b82f6;              /* Info states */

/* Borders & Dividers */
--border-default: #30363d;
--border-hover: #484f58;
--border-focus: #34c38e;
```

### Typography System

```css
/* Font Families */
--font-sans: 'Geist Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
--font-mono: 'Geist Mono', 'SF Mono', 'Fira Code', monospace;

/* Font Sizes (Desktop) */
--text-xs: 0.75rem;      /* 12px — captions, labels */
--text-sm: 0.875rem;     /* 14px — small body, buttons */
--text-base: 1rem;       /* 16px — body text */
--text-lg: 1.125rem;     /* 18px — lead text */
--text-xl: 1.25rem;      /* 20px — H4 */
--text-2xl: 1.5rem;      /* 24px — H3 */
--text-3xl: 1.875rem;    /* 30px — H2 */
--text-4xl: 2.25rem;     /* 36px — H1 mobile */
--text-5xl: 3rem;        /* 48px — H1 tablet */
--text-6xl: 3.75rem;     /* 60px — H1 desktop */
--text-7xl: 4.5rem;      /* 72px — Hero headline */

/* Font Weights */
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;

/* Line Heights */
--leading-tight: 1.25;
--leading-normal: 1.5;
--leading-relaxed: 1.625;

/* Letter Spacing */
--tracking-tight: -0.025em;
--tracking-normal: 0;
--tracking-wide: 0.025em;
```

### Spacing System

```css
/* Base Unit: 8px */
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-5: 1.25rem;   /* 20px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;      /* 32px */
--space-10: 2.5rem;   /* 40px */
--space-12: 3rem;     /* 48px */
--space-16: 4rem;     /* 64px */
--space-20: 5rem;     /* 80px */
--space-24: 6rem;     /* 96px */
--space-32: 8rem;     /* 128px */
```

### Border Radius

```css
--radius-sm: 4px;       /* Small elements */
--radius-md: 8px;       /* Cards, buttons */
--radius-lg: 12px;      /* Large cards */
--radius-xl: 16px;      /* Modals */
--radius-full: 9999px;  /* Pills, avatars */
```

### Shadows

```css
--shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.3);
--shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.4);
--shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.5);
--shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.5);
--shadow-glow: 0 0 40px -10px rgb(52 195 142 / 0.3);
```

### Transitions

```css
--transition-fast: 150ms ease;
--transition-normal: 300ms ease;
--transition-slow: 500ms ease;
--transition-bounce: 500ms cubic-bezier(0.34, 1.56, 0.64, 1);
```

---

## 📐 Responsive Breakpoints

```css
/* Mobile First Approach */
/* Base styles = mobile (320px - 767px) */

@media (min-width: 768px) {
  /* Tablet */
}

@media (min-width: 1024px) {
  /* Desktop small */
}

@media (min-width: 1440px) {
  /* Desktop large — design target */
}

@media (min-width: 1920px) {
  /* Extra large — max-width containers */
}
```

---

## 🏗️ Page Structure Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         STICKY HEADER                           │
│  [Logo]  [Features] [How It Works] [Pricing] [FAQ]  [CTA Button]│
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    1. HERO SECTION                              │
│         Headline + Subheadline + CTAs + Product Visual          │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    2. FEATURES GRID                             │
│           10 Feature Cards (3-col desktop, 2-col tablet)           │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    3. HOW IT WORKS                              │
│              3-Step Process with Visual Flow                    │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    4. TECHNICAL DEEP DIVE                       │
│   Tabbed Interface: Schema | ADR | Tech Stack | API | Overview  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    5. PRICING                                   │
│                    2-Tier Pricing Table                         │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    6. FAQ                                       │
│              Accordion with 6-8 Common Questions                │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    7. CTA BANNER                                │
│              Final Call-to-Action Before Footer                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                         FOOTER                                  │
│    [Logo] [Links] [Legal] [Social] [Copyright]                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 1️⃣ HERO SECTION

**Purpose:** Immediate value proposition, primary CTA conversion  
**Height:** 640px desktop, 560px tablet, auto mobile  

### Desktop Layout (1440px)

```
┌────────────────────────────────────────────────────────────────────────┐
│                                                                        │
│   ┌─────────────────────────────┐    ┌──────────────────────────────┐ │
│   │                             │    │                              │ │
│   │  Engineering-grade          │    │   ┌────────────────────┐     │ │
│   │  project management         │    │   │  ┌────┐ ┌────┐     │     │ │
│   │                             │    │   │  │Task│ │Bug │     │     │ │
│   │  From solo builder to       │    │   │  └────┘ └────┘     │     │ │
│   │  2,000 engineers            │    │   │  ┌────────────┐   │     │ │
│   │                             │    │   │  │  Schema    │   │     │ │
│   │  Track tasks, bugs, test    │    │   │  │    ERD     │   │     │ │
│   │  cases, tech stack, schema, │    │   │  └────────────┘   │     │ │
│   │  decisions — everything in  │    │   │  ┌────┐ ┌────┐   │     │ │
│   │  one workspace              │    │   │  │ADR │ │API │   │     │ │
│   │                             │    │   │  └────┘ └────┘   │     │ │
│   │  [Get Started Free] [Demo]  │    │   └────────────────────┘     │ │
│   │                             │    │                              │ │
│   └─────────────────────────────┘    └──────────────────────────────┘ │
│                                                                        │
│   Trusted by engineering teams at:  [Logo1] [Logo2] [Logo3] [Logo4]   │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

### Specifications

| Element | Desktop (1440px) | Tablet (1024px) | Mobile (768px) |
|---------|------------------|-----------------|----------------|
| **Container** | max-width: 1200px, centered | max-width: 960px | padding: 0 24px |
| **Headline** | font-size: 72px, line-height: 1.1 | font-size: 48px | font-size: 36px |
| **Subheadline** | font-size: 20px, max-width: 540px | font-size: 18px | font-size: 16px |
| **CTA Primary** | width: 200px, height: 56px | width: 180px | width: 100% |
| **CTA Secondary** | width: 140px, height: 56px | width: 120px | width: 100%, mt-16 |
| **Visual Area** | width: 560px | width: 400px | hidden |
| **Logo Strip** | gap: 64px | gap: 48px | gap: 32px, flex-wrap |
| **Section Padding** | padding-top: 128px, padding-bottom: 96px | padding-top: 96px | padding-top: 64px |

### Component States

**Primary CTA Button (`[Get Started Free]`)**
```css
.btn-primary {
  background: var(--accent-primary);
  color: var(--text-inverse);
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  padding: var(--space-4) var(--space-8);
  border-radius: var(--radius-md);
  transition: all var(--transition-fast);
  
  &:hover {
    background: var(--accent-hover);
    transform: translateY(-2px);
    box-shadow: var(--shadow-glow);
  }
  
  &:active {
    background: var(--accent-active);
    transform: translateY(0);
  }
  
  &:focus-visible {
    outline: 2px solid var(--accent-primary);
    outline-offset: 2px;
  }
}
```

**Secondary CTA Button (`[Watch Demo]`)**
```css
.btn-secondary {
  background: transparent;
  color: var(--text-primary);
  border: 1px solid var(--border-default);
  font-size: var(--text-base);
  font-weight: var(--font-medium);
  padding: var(--space-4) var(--space-8);
  border-radius: var(--radius-md);
  transition: all var(--transition-fast);
  
  &:hover {
    border-color: var(--border-hover);
    background: var(--bg-tertiary);
  }
  
  &:active {
    background: var(--bg-elevated);
  }
}
```

### Interaction Patterns

- **Scroll Animation:** Hero content fades in with 20px upward slide (duration: 600ms, ease-out)
- **Visual Area:** Subtle floating animation on product mockup (translateY ±10px, 6s loop)
- **Logo Strip:** Opacity 0.6 → 1.0 on hover (individual logos)

---

## 2️⃣ FEATURES GRID SECTION

**Purpose:** Showcase 10 core features with visual icons  
**Height:** Auto (content-dependent), ~1080px desktop  

### Desktop Layout (1440px)

```
┌────────────────────────────────────────────────────────────────────────┐
│                                                                        │
│                    Features Built for Engineers                        │
│         Everything you need to ship quality software, faster          │
│                                                                        │
│   ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐   │
│   │  📋              │  │  🐛              │  │  ✅              │   │
│   │  Task Board      │  │  Issue Tracking  │  │  Test Cases      │   │
│   │                  │  │                  │  │                  │   │
│   │  Kanban with     │  │  Severity +      │  │  Checklist per   │   │
│   │  drag-and-drop,  │  │  reproduction    │  │  task/issue,     │   │
│   │  dependencies,   │  │  steps, lifecycle│  │  Pass/Fail state │   │
│   │  estimates       │  │                  │  │                  │   │
│   └──────────────────┘  └──────────────────┘  └──────────────────┘   │
│                                                                        │
│   ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐   │
│   │  🗄️              │  │  📝              │  │  📚              │   │
│   │  Schema ERD      │  │  ADR Log         │  │  Tech Stack      │   │
│   │                  │  │                  │  │                  │   │
│   │  Visual database │  │  Record why you  │  │  Track versions, │   │
│   │  design, pan &   │  │  chose this,     │  │  upgrade status, │   │
│   │  zoom, versioning│  │  options, impact │  │  category ledger │   │
│   └──────────────────┘  └──────────────────┘  └──────────────────┘   │
│                                                                        │
│   ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐   │
│   │  🎨              │  │  📅              │  │  ⚡              │   │
│   │  Whiteboard      │  │  Calendar        │  │  Realtime        │   │
│   │                  │  │                  │  │                  │   │
│   │  Infinite canvas,│  │  Due dates,      │  │  WS live sync +  │   │
│   │  sticky notes,   │  │  month/week grid,│  │  presence, team  │   │
│   │  live cards      │  │  drag reschedule │  │  workspaces      │   │
│   └──────────────────┘  └──────────────────┘  └──────────────────┘   │
│                                                                        │
│   ┌──────────────────┐                                                  │
│   │  📦              │                                                  │
│   │  Templates       │                                                  │
│   │                  │                                                  │
│   │  Save & reuse    │                                                  │
│   │  project setups, │                                                  │
│   │  instantiate new │                                                  │
│   └──────────────────┘                                                  │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

### Specifications

| Element | Desktop (1440px) | Tablet (1024px) | Mobile (768px) |
|---------|------------------|-----------------|----------------|
| **Section Padding** | padding: 128px 0 | padding: 96px 0 | padding: 64px 0 |
| **Headline** | font-size: 48px, centered | font-size: 36px | font-size: 28px |
| **Subheadline** | font-size: 20px, max-width: 600px, centered | font-size: 18px | font-size: 16px |
| **Grid** | grid-template-columns: repeat(3, 1fr), gap: 32px | grid-template-columns: repeat(2, 1fr) | grid-template-columns: 1fr |
| **Card** | width: 100%, min-height: 280px | min-height: 260px | min-height: 240px |
| **Icon** | 64px × 64px | 56px × 56px | 48px × 48px |
| **Card Title** | font-size: 24px | font-size: 20px | font-size: 18px |
| **Card Description** | font-size: 16px, line-height: 1.6 | font-size: 15px | font-size: 14px |

### Card Component Structure

```
┌────────────────────────────────────┐
│  ┌────┐                            │
│  │ 📋 │  Task Board                │
│  └────┘                            │
│                                    │
│  Kanban with drag-and-drop,        │
│  dependencies, and estimates       │
│  to keep your team aligned.        │
│                                    │
│              [Learn More →]        │
└────────────────────────────────────┘
```

### Card States

```css
.feature-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  padding: var(--space-8);
  transition: all var(--transition-normal);
  
  &:hover {
    border-color: var(--accent-primary);
    transform: translateY(-4px);
    box-shadow: var(--shadow-lg);
  }
  
  .card-icon {
    width: 64px;
    height: 64px;
    background: var(--bg-tertiary);
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 32px;
    margin-bottom: var(--space-6);
    transition: all var(--transition-fast);
  }
  
  &:hover .card-icon {
    background: var(--accent-primary);
    color: var(--text-inverse);
  }
  
  .card-link {
    color: var(--accent-primary);
    font-weight: var(--font-medium);
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    margin-top: var(--space-6);
    
    &:hover {
      gap: var(--space-3); /* Arrow slides right */
    }
  }
}
```

### Interaction Patterns

- **Staggered Fade-in:** Cards appear with 100ms delay each (1→2→…→10)
- **Hover Lift:** Cards lift 4px with shadow intensification
- **Icon Highlight:** Icon background fills with accent color on card hover
- **Link Arrow:** Arrow slides 4px right on hover (smooth transition)

---

## 3️⃣ HOW IT WORKS SECTION

**Purpose:** 3-step onboarding flow visualization  
**Height:** ~640px desktop  

### Desktop Layout (1440px)

```
┌────────────────────────────────────────────────────────────────────────┐
│                                                                        │
│                    Start Shipping in Minutes                           │
│         No setup wizard. No configuration hell. Just build.           │
│                                                                        │
│   ┌─────────────┐      ┌─────────────┐      ┌─────────────┐          │
│   │             │      │             │      │             │          │
│   │     1       │ ───► │     2       │ ───► │     3       │          │
│   │             │      │             │      │             │          │
│   │  Create     │      │  Invite     │      │  Start      │          │
│   │  Project    │      │  Your Team  │      │  Building   │          │
│   │             │      │             │      │             │          │
│   │  Sign up    │      │  Add team   │      │  Track      │          │
│   │  and create │      │  members    │      │  tasks,     │          │
│   │  your first │      │  with       │      │  bugs,      │          │
│   │  project in │      │  roles and  │      │  decisions  │          │
│   │  seconds    │      │  permissions│      │  in one     │          │
│   │             │      │             │      │  place      │          │
│   └─────────────┘      └─────────────┘      └─────────────┘          │
│                                                                        │
│                    [Start Free Trial →]                                │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

### Specifications

| Element | Desktop (1440px) | Tablet (1024px) | Mobile (768px) |
|---------|------------------|-----------------|----------------|
| **Section Padding** | padding: 128px 0 | padding: 96px 0 | padding: 64px 0 |
| **Headline** | font-size: 48px, centered | font-size: 36px | font-size: 28px |
| **Subheadline** | font-size: 20px, max-width: 600px | font-size: 18px | font-size: 16px |
| **Step Container** | flex, gap: 64px | flex, gap: 48px | grid, gap: 48px |
| **Step Number** | font-size: 72px, opacity: 0.2 | font-size: 56px | font-size: 48px |
| **Step Title** | font-size: 24px | font-size: 20px | font-size: 18px |
| **Step Description** | font-size: 16px, max-width: 280px | font-size: 15px | font-size: 14px |
| **Connector Arrow** | width: 64px, stroke: 2px | width: 48px | hidden (vertical layout) |

### Step Card Structure

```
┌─────────────────────────┐
│                         │
│         01              │  ← Large, low opacity number
│                         │
│    Create Project       │  ← Title
│                         │
│  Sign up and create     │  ← Description
│  your first project     │
│  in seconds             │
│                         │
└─────────────────────────┘
```

### Connector Arrow (Desktop Only)

```css
.step-connector {
  position: absolute;
  top: 40px;
  right: -32px;
  width: 64px;
  height: 2px;
  background: var(--border-default);
  
  &::after {
    content: '';
    position: absolute;
    right: 0;
    top: -5px;
    border-left: 10px solid var(--border-default);
    border-top: 6px solid transparent;
    border-bottom: 6px solid transparent;
  }
}
```

### Interaction Patterns

- **Sequential Reveal:** Steps animate in left→right with 200ms delay
- **Number Count-up:** Step numbers count from 00→01→02→03 (duration: 800ms)
- **Connector Draw:** Arrow animates as SVG stroke-dashoffset (duration: 600ms)
- **Scroll Progress:** As user scrolls, completed steps get accent color

---

## 4️⃣ TECHNICAL DEEP DIVE SECTION

**Purpose:** Showcase developer-specific features with interactive tabs  
**Height:** ~800px desktop (tab-content dependent)  

### Desktop Layout (1440px)

```
┌────────────────────────────────────────────────────────────────────────┐
│                                                                        │
│                    Built for Technical Teams                           │
│         Features that understand how engineers actually work          │
│                                                                        │
│   ┌────────────────────────────────────────────────────────────────┐  │
│   │  [Schema]  [ADR Log]  [Tech Stack]  [API Docs]  [Overview]     │  │
│   ├────────────────────────────────────────────────────────────────┤  │
│   │                                                                │  │
│   │  ┌───────────────────────────┐    ┌──────────────────────────┐ │  │
│   │  │                           │    │                          │ │  │
│   │  │   Database Schema ERD     │    │   ┌────────────┐        │ │  │
│   │  │                           │    │   │  users     │        │ │  │
│   │  │   Visual editor for       │    │   │  ────────  │        │ │  │
│   │  │   tables, columns, and    │    │   │  id: uuid  │        │ │  │
│   │  │   relations. Auto-ERD     │    │   │  email: str│◄───────┼─┼──│
│   │  │   generation with pan &   │    │   │  created: ts│       │ │  │
│   │  │   zoom. Version history.  │    │   └────────────┘        │ │  │
│   │  │                           │    │         ▲                │ │  │
│   │  │                           │    │         │ 1:N            │ │  │
│   │  │                           │    │   ┌────────────┐        │ │  │
│   │  │                           │    │   │  posts     │        │ │  │
│   │  │                           │    │   │  ────────  │        │ │  │
│   │  │                           │    │   │  id: uuid  │        │ │  │
│   │  │                           │    │   │  user_id   │        │ │  │
│   │  │                           │    │   │  title: str│        │ │  │
│   │  │                           │    │   └────────────┘        │ │  │
│   │  │                           │    │                          │ │  │
│   │  └───────────────────────────┘    └──────────────────────────┘ │  │
│   │                                                                │  │
│   └────────────────────────────────────────────────────────────────┘  │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

### Specifications

| Element | Desktop (1440px) | Tablet (1024px) | Mobile (768px) |
|---------|------------------|-----------------|----------------|
| **Section Padding** | padding: 128px 0 | padding: 96px 0 | padding: 64px 0 |
| **Headline** | font-size: 48px, centered | font-size: 36px | font-size: 28px |
| **Subheadline** | font-size: 20px, max-width: 600px | font-size: 18px | font-size: 16px |
| **Tab Container** | max-width: 1000px, centered | max-width: 900px | full-width |
| **Tab Bar** | gap: 8px, horizontal scroll | gap: 8px | gap: 4px, overflow-x |
| **Tab Button** | padding: 12px 24px | padding: 10px 20px | padding: 8px 16px |
| **Content Area** | min-height: 400px | min-height: 360px | min-height: 320px |
| **Visual Panel** | width: 45% | width: 40% | hidden/stacked |
| **Text Panel** | width: 55% | width: 60% | width: 100% |

### Tab Component States

```css
.tab-container {
  background: var(--bg-secondary);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-xl);
  overflow: hidden;
  
  .tab-bar {
    display: flex;
    gap: var(--space-2);
    padding: var(--space-4);
    border-bottom: 1px solid var(--border-default);
    background: var(--bg-tertiary);
    overflow-x: auto;
    
    .tab-button {
      padding: var(--space-3) var(--space-6);
      font-size: var(--text-sm);
      font-weight: var(--font-medium);
      color: var(--text-secondary);
      background: transparent;
      border: none;
      border-radius: var(--radius-md);
      transition: all var(--transition-fast);
      white-space: nowrap;
      
      &:hover {
        color: var(--text-primary);
        background: var(--bg-elevated);
      }
      
      &.active {
        color: var(--text-inverse);
        background: var(--accent-primary);
      }
      
      &:focus-visible {
        outline: 2px solid var(--accent-primary);
        outline-offset: 2px;
      }
    }
  }
  
  .tab-content {
    padding: var(--space-8);
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-8);
    
    @media (max-width: 1023px) {
      grid-template-columns: 1fr;
    }
  }
}
```

### Tab Content Specifications

| Tab | Visual Element | Key Message |
|-----|---------------|-------------|
| **Schema** | ERD diagram preview | "Visual database design with pan & zoom" |
| **ADR Log** | Decision timeline | "Record why, remember forever" |
| **Tech Stack** | Dependency table | "Track versions, never lose track" |
| **API Docs** | Endpoint list | "Auto-generated from your code" |
| **Overview** | Counters + charts + PRD | "Estimates vs actuals + project brief at a glance" |

### Interaction Patterns

- **Tab Switch:** Content cross-fades (200ms opacity transition)
- **Visual Update:** Right panel animates based on active tab
- **Keyboard Navigation:** Arrow keys switch tabs, Enter selects
- **Scroll Sync:** Long content scrolls independently within tab

---

## 5️⃣ PRICING SECTION

**Purpose:** Clear 2-tier pricing (Free / Pro flat, IDR via Pakasir) with feature comparison  
**Height:** ~720px desktop  

### Desktop Layout (1440px)

```
┌────────────────────────────────────────────────────────────────────────┐
│                                                                        │
│                    Simple, Transparent Pricing                         │
│                    Start free, scale as you grow                       │
│                                                                        │
│   ┌────────────────────────────────────────────────────────────────┐  │
│   │            Flat per workspace · IDR via Pakasir (QRIS/VA)        │  │
│   └────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│   ┌──────────────┐ ┌──────────────┐                                   │
│   │    FREE      │ │    PRO ★     │                                   │
│   │              │ │  Most Popular │                                   │
│   │   $0         │ │   Flat       │                                   │
│   │              │ │   IDR via    │                                   │
│   │              │ │   Pakasir    │                                   │
│   ├──────────────┤ ├──────────────┤                                   │
│   │ ✓ 3 Projects │ │ ✓ Unlimited  │                                   │
│   │ ✓ 2 Members  │ │   Projects   │                                   │
│   │ ✓ Basic Board│ │ ✓ Unlimited  │                                   │
│   │ ✓ Export/    │ │   Members    │                                   │
│   │   Import     │ │ ✓ Templates  │                                   │
│   │              │ │ ✓ API Access │                                   │
│   │              │ │ ✓ Realtime + │                                   │
│   │              │ │   Whiteboard │                                   │
│   ├──────────────┤ ├──────────────┤                                   │
│   │ [Get Started]│ │ [Upgrade via │                                   │
│   │              │ │  Pakasir]    │                                   │
│   └──────────────┘ └──────────────┘                                   │
│                                                                        │
│                    All plans include:                                  │
│   Dark theme · Export/Import · Keyboard shortcuts · MCP integration   │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

### Specifications

| Element | Desktop (1440px) | Tablet (1024px) | Mobile (768px) |
|---------|------------------|-----------------|----------------|
| **Section Padding** | padding: 128px 0 | padding: 96px 0 | padding: 64px 0 |
| **Headline** | font-size: 48px, centered | font-size: 36px | font-size: 28px |
| **Subheadline** | font-size: 20px | font-size: 18px | font-size: 16px |
| **Billing note** | centered flat-per-workspace strip (IDR via Pakasir QRIS/VA, no monthly/annual toggle) | centered | stacked above cards |
| **Grid** | grid-template-columns: repeat(2, 1fr), gap: 32px | gap: 24px | grid-template-columns: 1fr, gap: 24px |
| **Card** | min-height: 520px | min-height: 480px | min-height: auto |
| **Price** | font-size: 56px | font-size: 48px | font-size: 40px |
| **Feature List** | gap: 16px | gap: 14px | gap: 12px |
| **CTA Button** | width: 100%, height: 48px | height: 44px | height: 44px |

### Pricing Card States

```css
.pricing-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-xl);
  padding: var(--space-8);
  display: flex;
  flex-direction: column;
  transition: all var(--transition-normal);
  position: relative;
  
  &.featured {
    border-color: var(--accent-primary);
    box-shadow: var(--shadow-glow);
    transform: scale(1.02);
  }
  
  &:hover {
    transform: translateY(-4px);
    box-shadow: var(--shadow-xl);
  }
  
  .popular-badge {
    position: absolute;
    top: var(--space-4);
    right: var(--space-4);
    background: var(--accent-primary);
    color: var(--text-inverse);
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    padding: var(--space-1) var(--space-3);
    border-radius: var(--radius-full);
  }
  
  .price {
    font-size: var(--text-6xl);
    font-weight: var(--font-bold);
    color: var(--text-primary);
    
    .period {
      font-size: var(--text-base);
      color: var(--text-secondary);
      font-weight: var(--font-normal);
    }
  }
  
  .features {
    list-style: none;
    margin: var(--space-8) 0;
    flex-grow: 1;
    
    li {
      display: flex;
      align-items: flex-start;
      gap: var(--space-3);
      margin-bottom: var(--space-4);
      color: var(--text-secondary);
      
      &::before {
        content: '✓';
        color: var(--accent-primary);
        font-weight: var(--font-bold);
      }
      
      &.unavailable {
        color: var(--text-tertiary);
        text-decoration: line-through;
        
        &::before {
          content: '✕';
          color: var(--text-tertiary);
        }
      }
    }
  }
}
```

### Billing Note Component (flat — monthly/annual toggle removed)

```css
.pricing-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-4);
  margin-bottom: var(--space-12);
  
  .toggle-label {
    color: var(--text-secondary);
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    
    &.active {
      color: var(--text-primary);
    }
  }
  
  .toggle-switch {
    width: 56px;
    height: 28px;
    background: var(--bg-tertiary);
    border-radius: var(--radius-full);
    position: relative;
    cursor: pointer;
    transition: background var(--transition-fast);
    
    &.active {
      background: var(--accent-primary);
    }
    
    &::after {
      content: '';
      position: absolute;
      top: 4px;
      left: 4px;
      width: 20px;
      height: 20px;
      background: white;
      border-radius: var(--radius-full);
      transition: transform var(--transition-fast);
    }
    
    &.active::after {
      transform: translateX(28px);
    }
  }
  
  .discount-badge {
    background: var(--accent-primary);
    color: var(--text-inverse);
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-sm);
  }
}
```

### Interaction Patterns

- **Flat billing:** No monthly/annual toggle — single flat price per workspace, paid in IDR via Pakasir (QRIS/VA)
- **Price Update:** Numbers count up/down when switching Free → Pro highlight (duration: 500ms)
- **Card Highlight:** Featured card has subtle pulse glow (2s loop, low opacity)
- **Hover Lift:** All cards lift 4px on hover

---

## 6️⃣ FAQ SECTION

**Purpose:** Address common objections and questions  
**Height:** Auto (~640px desktop)  

### Desktop Layout (1440px)

```
┌────────────────────────────────────────────────────────────────────────┐
│                                                                        │
│                    Frequently Asked Questions                          │
│                    Everything you need to know                         │
│                                                                        │
│   ┌────────────────────────────────────────────────────────────────┐  │
│   │  ▼  How is DevHub different from Jira or Linear?              │  │
│   ├────────────────────────────────────────────────────────────────┤  │
│   │  DevHub is built specifically for engineering teams who need  │  │
│   │  technical depth — schema management, ADR logging, tech stack │  │
│   │  tracking — that general-purpose PM tools don't provide.      │  │
│   │  Think of it as a complementary layer, not a replacement.     │  │
│   └────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│   ┌────────────────────────────────────────────────────────────────┐  │
│   │  ▶  Can I export my data if I want to leave?                  │  │
│   └────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│   ┌────────────────────────────────────────────────────────────────┐  │
│   │  ▶  Do you offer discounts for open-source or education?      │  │
│   └────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│   ┌────────────────────────────────────────────────────────────────┐  │
│   │  ▶  Is there a self-hosted option?                            │  │
│   └────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│   ┌────────────────────────────────────────────────────────────────┐  │
│   │  ▶  How does the free tier work?                              │  │
│   └────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│   ┌────────────────────────────────────────────────────────────────┐  │
│   │  ▶  Can AI agents integrate with DevHub?                      │  │
│   └────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│                    Still have questions? [Contact Support →]          │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

### Specifications

| Element | Desktop (1440px) | Tablet (1024px) | Mobile (768px) |
|---------|------------------|-----------------|----------------|
| **Section Padding** | padding: 128px 0 | padding: 96px 0 | padding: 64px 0 |
| **Headline** | font-size: 48px, centered | font-size: 36px | font-size: 28px |
| **Subheadline** | font-size: 20px | font-size: 18px | font-size: 16px |
| **Accordion** | max-width: 800px, centered | max-width: 720px | full-width |
| **Item** | min-height: 80px (collapsed) | min-height: 72px | min-height: 64px |
| **Question** | font-size: 18px | font-size: 17px | font-size: 16px |
| **Answer** | font-size: 16px, line-height: 1.7 | font-size: 15px | font-size: 14px |
| **Icon** | 24px × 24px | 22px × 22px | 20px × 20px |

### Accordion Component States

```css
.accordion {
  max-width: 800px;
  margin: 0 auto;
  
  .accordion-item {
    border: 1px solid var(--border-default);
    border-radius: var(--radius-lg);
    margin-bottom: var(--space-4);
    overflow: hidden;
    transition: all var(--transition-fast);
    
    &:hover {
      border-color: var(--border-hover);
    }
    
    &.open {
      border-color: var(--accent-primary);
      background: var(--bg-secondary);
    }
    
    .accordion-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: var(--space-6);
      cursor: pointer;
      background: transparent;
      border: none;
      width: 100%;
      text-align: left;
      
      .question {
        font-size: var(--text-lg);
        font-weight: var(--font-medium);
        color: var(--text-primary);
        flex-grow: 1;
        padding-right: var(--space-4);
      }
      
      .icon {
        width: 24px;
        height: 24px;
        color: var(--text-secondary);
        transition: transform var(--transition-normal);
        flex-shrink: 0;
        
        &.open {
          transform: rotate(180deg);
          color: var(--accent-primary);
        }
      }
    }
    
    .accordion-content {
      max-height: 0;
      overflow: hidden;
      transition: max-height var(--transition-normal);
      
      .answer {
        padding: 0 var(--space-6) var(--space-6);
        font-size: var(--text-base);
        line-height: var(--leading-relaxed);
        color: var(--text-secondary);
      }
    }
    
    &.open .accordion-content {
      max-height: 500px; /* Adjust based on content */
    }
  }
}
```

### Interaction Patterns

- **Accordion Expand:** max-height animation with ease-out (duration: 300ms)
- **Icon Rotate:** Chevron rotates 180° when open
- **Single vs Multi:** Allow only one open at a time (accordion) OR multiple (toggle)
- **Scroll into View:** If answer is long, smooth-scroll to keep visible
- **Keyboard:** Enter/Space toggles, Arrow keys navigate between items

---

## 7️⃣ CTA BANNER SECTION

**Purpose:** Final conversion push before footer  
**Height:** 320px desktop  

### Desktop Layout (1440px)

```
┌────────────────────────────────────────────────────────────────────────┐
│                                                                        │
│   ┌────────────────────────────────────────────────────────────────┐  │
│   │                                                                │  │
│   │    Ready to ship better software?                              │  │
│   │                                                                │  │
│   │    Join engineering teams who use DevHub to track tasks,       │  │
│   │    document decisions, and maintain technical memory.          │  │
│   │                                                                │  │
│   │              [Start Free Trial]  [Talk to Sales]               │  │
│   │                                                                │  │
│   │    No credit card required · Free forever for small teams      │  │
│   │                                                                │  │
│   └────────────────────────────────────────────────────────────────┘  │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

### Specifications

| Element | Desktop (1440px) | Tablet (1024px) | Mobile (768px) |
|---------|------------------|-----------------|----------------|
| **Section Padding** | padding: 96px 0 | padding: 72px 0 | padding: 48px 0 |
| **Container** | max-width: 1000px, centered | max-width: 900px | full-width |
| **Background** | gradient: accent-primary to accent-hover | same | same |
| **Headline** | font-size: 40px, color: text-inverse | font-size: 32px | font-size: 28px |
| **Description** | font-size: 18px, max-width: 600px | font-size: 16px | font-size: 15px |
| **Button Group** | gap: 16px | gap: 12px | flex-direction: column |
| **CTA Primary** | background: text-inverse, color: accent-primary | same | width: 100% |
| **CTA Secondary** | border: 2px solid text-inverse, color: text-inverse | same | width: 100% |
| **Trust Text** | font-size: 14px, opacity: 0.8 | font-size: 13px | font-size: 12px |

### CTA Banner Styles

```css
.cta-banner {
  background: linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-hover) 100%);
  border-radius: var(--radius-xl);
  padding: var(--space-16);
  text-align: center;
  position: relative;
  overflow: hidden;
  
  /* Subtle pattern overlay */
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-image: radial-gradient(circle at 2px 2px, rgba(255,255,255,0.1) 1px, transparent 0);
    background-size: 24px 24px;
    opacity: 0.3;
  }
  
  .headline {
    font-size: var(--text-4xl);
    font-weight: var(--font-bold);
    color: var(--text-inverse);
    margin-bottom: var(--space-6);
    position: relative;
  }
  
  .description {
    font-size: var(--text-lg);
    color: rgba(255, 255, 255, 0.9);
    max-width: 600px;
    margin: 0 auto var(--space-8);
    position: relative;
  }
  
  .button-group {
    display: flex;
    justify-content: center;
    gap: var(--space-4);
    position: relative;
    
    .btn-inverse {
      background: var(--text-inverse);
      color: var(--accent-primary);
      padding: var(--space-4) var(--space-8);
      border-radius: var(--radius-md);
      font-weight: var(--font-semibold);
      transition: all var(--transition-fast);
      
      &:hover {
        transform: translateY(-2px);
        box-shadow: var(--shadow-lg);
      }
    }
    
    .btn-outline {
      background: transparent;
      color: var(--text-inverse);
      border: 2px solid var(--text-inverse);
      padding: var(--space-4) var(--space-8);
      border-radius: var(--radius-md);
      font-weight: var(--font-semibold);
      transition: all var(--transition-fast);
      
      &:hover {
        background: rgba(255, 255, 255, 0.1);
      }
    }
  }
  
  .trust-text {
    font-size: var(--text-sm);
    color: rgba(255, 255, 255, 0.8);
    margin-top: var(--space-6);
    position: relative;
  }
}
```

### Interaction Patterns

- **Entrance Animation:** Banner slides up with fade (duration: 600ms)
- **Pattern Parallax:** Subtle background pattern moves on scroll
- **Button Hover:** Lift 2px with shadow, maintain contrast
- **Mobile Stack:** Buttons stack vertically on small screens

---

## 📎 STICKY HEADER / NAVIGATION

**Purpose:** Persistent navigation with scroll behavior  
**Height:** 72px desktop, 64px mobile  

### Desktop Layout (1440px)

```
┌────────────────────────────────────────────────────────────────────────┐
│  [DevHub]    Features   How It Works   Pricing   FAQ      [Login]     │
│   Logo      (dropdown)     (link)      (link)   (link)   [Sign Up]    │
└────────────────────────────────────────────────────────────────────────┘
```

### Specifications

| Element | Desktop (1440px) | Tablet (1024px) | Mobile (768px) |
|---------|------------------|-----------------|----------------|
| **Height** | 72px | 68px | 64px |
| **Logo** | width: 120px | width: 100px | width: 90px |
| **Nav Links** | gap: 32px | gap: 24px | hidden (hamburger) |
| **Link Font** | font-size: 15px, font-weight: 500 | font-size: 14px | N/A |
| **CTA Group** | gap: 12px | gap: 10px | full-width in drawer |
| **Container** | max-width: 1200px, centered | max-width: 960px | padding: 0 24px |

### Header States

```css
.site-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 72px;
  background: rgba(13, 17, 23, 0.8);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid transparent;
  z-index: 1000;
  transition: all var(--transition-normal);
  
  &.scrolled {
    background: rgba(13, 17, 23, 0.95);
    border-bottom-color: var(--border-default);
    box-shadow: var(--shadow-md);
  }
  
  .header-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 var(--space-6);
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  
  .logo {
    font-size: var(--text-xl);
    font-weight: var(--font-bold);
    color: var(--text-primary);
    text-decoration: none;
    
    &:hover {
      color: var(--accent-primary);
    }
  }
  
  .nav {
    display: flex;
    align-items: center;
    gap: var(--space-8);
    
    .nav-link {
      font-size: var(--text-sm);
      font-weight: var(--font-medium);
      color: var(--text-secondary);
      text-decoration: none;
      transition: color var(--transition-fast);
      position: relative;
      
      &:hover {
        color: var(--text-primary);
      }
      
      &.active {
        color: var(--text-primary);
        
        &::after {
          content: '';
          position: absolute;
          bottom: -4px;
          left: 0;
          right: 0;
          height: 2px;
          background: var(--accent-primary);
          border-radius: var(--radius-full);
        }
      }
      
      /* Dropdown indicator */
      &.has-dropdown::after {
        content: '▼';
        font-size: 8px;
        margin-left: var(--space-1);
        vertical-align: middle;
      }
    }
  }
  
  .auth-buttons {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    
    .btn-login {
      color: var(--text-primary);
      font-weight: var(--font-medium);
      padding: var(--space-2) var(--space-4);
      
      &:hover {
        color: var(--accent-primary);
      }
    }
    
    .btn-signup {
      background: var(--accent-primary);
      color: var(--text-inverse);
      padding: var(--space-2) var(--space-4);
      border-radius: var(--radius-md);
      font-weight: var(--font-semibold);
      
      &:hover {
        background: var(--accent-hover);
      }
    }
  }
  
  /* Mobile hamburger */
  .hamburger {
    display: none;
    flex-direction: column;
    gap: 5px;
    cursor: pointer;
    
    span {
      width: 24px;
      height: 2px;
      background: var(--text-primary);
      transition: all var(--transition-fast);
    }
    
    @media (max-width: 767px) {
      display: flex;
    }
  }
}
```

### Interaction Patterns

- **Scroll Effect:** Header background becomes solid + border appears after 100px scroll
- **Active Link:** Current section highlighted with underline (smooth scroll sync)
- **Dropdown:** Features dropdown appears on hover (200ms fade + slide)
- **Mobile Drawer:** Hamburger opens full-screen drawer from right (300ms slide)
- **Smooth Scroll:** Nav links scroll to section with offset for header height

---

## 📄 FOOTER STRUCTURE

**Purpose:** Navigation, legal links, social proof  
**Height:** Auto (~400px)  

### Desktop Layout (1440px)

```
┌────────────────────────────────────────────────────────────────────────┐
│                                                                        │
│   [DevHub]                          Product        Company            │
│   Engineering-grade               ────────        ────────            │
│   project management               Features        About Us           │
│                                   How It Works    Careers            │
│   [Social Icons]                   Pricing         Blog               │
│   [Twitter] [GitHub]              FAQ             Press              │
│   [LinkedIn] [Discord]                             Contact            │
│                                                                        │
│   ─────────────────────────────────────────────────────────────────   │
│                                                                        │
│   Resources                          Legal                            │
│   ─────────                          ─────                            │
│   Documentation                      Privacy Policy                   │
│   API Reference                      Terms of Service                 │
│   MCP Integration Guide              Security                         │
│   Status Page                        Cookie Settings                  │
│   Changelog                                                           │
│                                                                        │
│   ─────────────────────────────────────────────────────────────────   │
│                                                                        │
│   © 2026 DevHub. All rights reserved.                                 │
│   Built for engineering teams worldwide. 🌍                           │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

### Specifications

| Element | Desktop (1440px) | Tablet (1024px) | Mobile (768px) |
|---------|------------------|-----------------|----------------|
| **Section Padding** | padding: 96px 0 48px | padding: 72px 0 40px | padding: 48px 0 32px |
| **Grid** | grid-template-columns: 2fr 1fr 1fr 1fr | grid-template-columns: 1fr 1fr | grid-template-columns: 1fr |
| **Column Gap** | gap: 64px | gap: 48px | gap: 32px |
| **Logo + Tagline** | max-width: 280px | max-width: 240px | full-width, mb-8 |
| **Social Icons** | 32px × 32px, gap: 16px | 28px × 28px | 28px × 28px, horizontal |
| **Link Column Title** | font-size: 14px, font-weight: 600, mb-4 | font-size: 13px | font-size: 13px |
| **Link** | font-size: 14px, color: text-secondary | font-size: 13px | font-size: 13px |
| **Divider** | height: 1px, background: border-default | same | same |
| **Copyright** | font-size: 14px, color: text-tertiary | font-size: 13px | font-size: 12px |

### Footer Styles

```css
.site-footer {
  background: var(--bg-secondary);
  border-top: 1px solid var(--border-default);
  
  .footer-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 var(--space-6);
  }
  
  .footer-grid {
    display: grid;
    grid-template-columns: 2fr repeat(3, 1fr);
    gap: var(--space-16);
    margin-bottom: var(--space-12);
    
    @media (max-width: 1023px) {
      grid-template-columns: repeat(2, 1fr);
    }
    
    @media (max-width: 767px) {
      grid-template-columns: 1fr;
      gap: var(--space-8);
    }
  }
  
  .footer-brand {
    .logo {
      font-size: var(--text-xl);
      font-weight: var(--font-bold);
      color: var(--text-primary);
      margin-bottom: var(--space-4);
      display: block;
    }
    
    .tagline {
      font-size: var(--text-sm);
      color: var(--text-secondary);
      line-height: var(--leading-relaxed);
      margin-bottom: var(--space-6);
    }
    
    .social-links {
      display: flex;
      gap: var(--space-4);
      
      a {
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--text-secondary);
        border-radius: var(--radius-md);
        transition: all var(--transition-fast);
        
        &:hover {
          background: var(--bg-tertiary);
          color: var(--accent-primary);
        }
      }
    }
  }
  
  .footer-column {
    h4 {
      font-size: var(--text-xs);
      font-weight: var(--font-semibold);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--text-primary);
      margin-bottom: var(--space-4);
    }
    
    ul {
      list-style: none;
      margin: 0;
      padding: 0;
      
      li {
        margin-bottom: var(--space-3);
        
        a {
          font-size: var(--text-sm);
          color: var(--text-secondary);
          text-decoration: none;
          transition: color var(--transition-fast);
          
          &:hover {
            color: var(--accent-primary);
          }
        }
      }
    }
  }
  
  .footer-divider {
    height: 1px;
    background: var(--border-default);
    margin: var(--space-12) 0;
  }
  
  .footer-bottom {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: var(--space-8);
    
    @media (max-width: 767px) {
      flex-direction: column;
      gap: var(--space-4);
      text-align: center;
    }
    
    .copyright {
      font-size: var(--text-sm);
      color: var(--text-tertiary);
    }
    
    .legal-links {
      display: flex;
      gap: var(--space-6);
      
      @media (max-width: 767px) {
        flex-direction: column;
        gap: var(--space-2);
      }
      
      a {
        font-size: var(--text-sm);
        color: var(--text-secondary);
        text-decoration: none;
        
        &:hover {
          color: var(--accent-primary);
        }
      }
    }
  }
}
```

### Interaction Patterns

- **Link Hover:** Color transitions to accent with no underline (clean look)
- **Social Icons:** Background fill on hover with icon color change
- **Smooth Scroll:** Anchor links scroll smoothly to section
- **Mobile Stack:** Columns stack vertically on mobile

---

## 🎬 GLOBAL INTERACTION PATTERNS

### Scroll Animations

```css
/* Fade Up Animation */
.animate-fade-up {
  opacity: 0;
  transform: translateY(20px);
  transition: opacity 0.6s ease-out, transform 0.6s ease-out;
  
  &.in-view {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Stagger children */
.stagger-children > *:nth-child(1) { transition-delay: 0ms; }
.stagger-children > *:nth-child(2) { transition-delay: 100ms; }
.stagger-children > *:nth-child(3) { transition-delay: 200ms; }
.stagger-children > *:nth-child(4) { transition-delay: 300ms; }
.stagger-children > *:nth-child(5) { transition-delay: 400ms; }
.stagger-children > *:nth-child(6) { transition-delay: 500ms; }
```

### Smooth Scroll

```css
html {
  scroll-behavior: smooth;
  scroll-padding-top: 72px; /* Header height */
}

/* Respect user preferences */
@media (prefers-reduced-motion: reduce) {
  html {
    scroll-behavior: auto;
  }
  
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

### Focus Management

```css
/* Global focus styles */
:focus-visible {
  outline: 2px solid var(--accent-primary);
  outline-offset: 2px;
}

/* Skip to main content link */
.skip-link {
  position: absolute;
  top: -100px;
  left: 0;
  background: var(--accent-primary);
  color: var(--text-inverse);
  padding: var(--space-3) var(--space-4);
  z-index: 9999;
  transition: top var(--transition-fast);
  
  &:focus {
    top: 0;
  }
}
```

---

## ♿ ACCESSIBILITY COMPLIANCE

### WCAG AA Requirements

| Requirement | Implementation |
|-------------|----------------|
| **Color Contrast** | All text ≥ 4.5:1, large text ≥ 3:1 (verified with tokens) |
| **Keyboard Navigation** | All interactive elements reachable via Tab |
| **Focus Indicators** | Visible 2px outline on all focusable elements |
| **Screen Reader** | Semantic HTML, ARIA labels where needed |
| **Motion Sensitivity** | Respects `prefers-reduced-motion` |
| **Text Scaling** | Design works up to 200% browser zoom |
| **Touch Targets** | Minimum 44px × 44px for all interactive elements |

### ARIA Labels

```html
<!-- Navigation -->
<nav aria-label="Main navigation">
  <button aria-expanded="false" aria-controls="mobile-menu">
    <span class="sr-only">Toggle menu</span>
  </button>
</nav>

<!-- Accordion -->
<button aria-expanded="false" aria-controls="faq-answer-1">
  Question text
</button>
<div id="faq-answer-1" role="region" hidden>
  Answer content
</div>

<!-- Flat billing note (no toggle) -->
<div role="group" aria-labelledby="billing-period">
  <span id="billing-period">Billing Period</span>
  <button aria-pressed="false" role="switch">
    <span class="sr-only">Toggle annual billing</span>
  </button>
</div>
```

---

## 📱 RESPONSIVE BEHAVIOR SUMMARY

| Breakpoint | Width | Layout Changes |
|------------|-------|----------------|
| **Mobile** | 320px - 767px | Single column, hamburger menu, stacked CTAs, hidden decorative elements |
| **Tablet** | 768px - 1023px | 2-column grids, reduced spacing, condensed typography |
| **Desktop Small** | 1024px - 1439px | 3-column grids, full navigation, all features visible |
| **Desktop Large** | 1440px+ | Design target, max-width containers centered |
| **Extra Large** | 1920px+ | Max-width enforced, prevent over-stretching |

---

## 🎨 DARK THEME SPECIFICATIONS

All designs are dark-theme first. No light theme variant is planned (per ADR-0XX).

### Background Hierarchy

```
Layer 1 (Base):     #0d1117 — Page background
Layer 2 (Cards):    #161b22 — Card backgrounds, sections
Layer 3 (Hover):    #21262d — Hover states, inputs
Layer 4 (Elevated): #30363d — Modals, dropdowns, sticky header
```

### Text Hierarchy

```
Primary:   #e4e7ec — Headings, body text (highest emphasis)
Secondary: #9ca3af — Subtitles, captions, descriptions
Tertiary:  #6b7280 — Placeholder, disabled text, meta info
```

---

## 📦 ASSET REQUIREMENTS

| Asset | Format | Size | Notes |
|-------|--------|------|-------|
| Logo (SVG) | SVG | 120px × 32px | With text, dark theme variant |
| Logo (Icon) | SVG | 32px × 32px | Favicon, app icon |
| Hero Visual | PNG/WebP | 560px × 400px | Product mockup, 2x for retina |
| Feature Icons | SVG | 64px × 64px | 10 icons, line style |
| Social Icons | SVG | 32px × 32px | Twitter, GitHub, LinkedIn, Discord |
| Step Illustrations | SVG | 200px × 200px | 3 illustrations for "How It Works" |
| Tab Visuals | PNG/SVG | 400px × 300px | 5 tab panel visuals |

---

## ✅ DESIGN QA CHECKLIST

- [ ] All color combinations pass WCAG AA contrast (4.5:1 minimum)
- [ ] All interactive elements have hover, active, focus, disabled states
- [ ] All animations respect `prefers-reduced-motion`
- [ ] All touch targets are minimum 44px × 44px
- [ ] All images have alt text or are marked decorative
- [ ] All form inputs have associated labels
- [ ] All accordions are keyboard accessible
- [ ] All dropdowns are keyboard accessible
- [ ] Focus order is logical (left-to-right, top-to-bottom)
- [ ] Skip link is present and functional
- [ ] Responsive breakpoints tested at 320px, 768px, 1024px, 1440px
- [ ] Sticky header does not obscure content on scroll
- [ ] All CTAs have clear, action-oriented copy
- [ ] Loading states defined for all dynamic content
- [ ] Error states defined for all form inputs
- [ ] Empty states defined where applicable

---

**Document End**

*Prepared for: DevHub Landing Page Implementation*  
*Design System: Dark-tech (Linear × GitHub Dark × Terminal)*  
*Version: 1.0 — 2026-09-03*

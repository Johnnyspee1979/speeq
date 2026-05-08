# Structura Wkb - Commercial Website Plan

> **For Antigravity:** REQUIRED SUB-SKILL: Load executing-plans to implement this plan task-by-task.

**Goal:** Build a high-end, conversion-focused, and "classy" commercial landing page for the Structura Wkb SaaS product. The name "wkb-snap" is being phased out publicly in favor of a more professional name (Structura Wkb by SpeeSolutions).

**Architecture:** A lightweight Vite + React (or plain HTML/CSS/JS if strictly static) site in the `www/` or `landing/` directory. We will use Vite + React to allow for dynamic interactive elements and animations, aligning with the tech stack of the Admin Cockpit.

**Design Aesthetic:** 
- Clean, minimalist, and "klassiek" (classy).
- SpeeSolutions color palette (Deep navy, bright orange accents, lots of white space).
- High-end typography (e.g., 'Inter' or 'Playfair Display' for a classic touch).
- Smooth scroll animations, glassmorphism elements, and professional mockup visuals.

---

### Task 1: Initialize the Landing Page Project

**Files:**
- Create: `www/` directory
- Create: `www/package.json`
- Create: `www/index.html`
- Create: `www/vite.config.ts`

**Step 1: Scaffold Vite App**
Initialize a new Vite React app in the `www` folder. Since the sandbox blocks `npx create-vite`, we will manually scaffold the boilerplate just like we did for the Cockpit.

**Step 2: Commit**
```bash
git add www/
git commit -m "feat(www): initialize commercial website scaffolding"
```

---

### Task 2: Implement Premium Design System & Layout

**Files:**
- Create: `www/src/index.css`
- Create: `www/src/App.tsx`
- Create: `www/src/components/Navbar.tsx`
- Create: `www/src/components/Footer.tsx`

**Step 1: CSS Design System**
Define CSS variables for a premium light-theme with high contrast (white background, dark text, orange accents). Ensure typography is elegant.

**Step 2: App Shell Layout**
Create a responsive Navbar with a sticky glassmorphism effect.

**Step 3: Commit**
```bash
git add www/src/
git commit -m "feat(www): setup premium design system, navbar and footer"
```

---

### Task 3: Build the Hero Section & Features

**Files:**
- Create: `www/src/components/Hero.tsx`
- Create: `www/src/components/Features.tsx`
- Create: `www/src/components/Pricing.tsx`

**Step 1: Hero Section**
A powerful headline ("Kwaliteitsborging, Zonder de Complexiteit"), a subtitle, and a primary CTA ("Vraag een Demo Aan"). 

**Step 2: Features Section**
A clean grid highlighting "Multi-Tenant Privacy", "Snelle Foto-Oplevering", and "Volledig Wkb Conform". Use Lucide-react icons.

**Step 3: Commit**
```bash
git add www/src/components/
git commit -m "feat(www): implement hero, features, and pricing sections"
```

# SpeeQ Cockpit Implementation Plan

> **For Antigravity:** REQUIRED SUB-SKILL: Load executing-plans to implement this plan task-by-task.

**Goal:** Build the "SpeeQ Cockpit", the master backoffice control panel for SpeeSolutions to manage Structura Wkb clients (tenants), generate licenses, and handle support.

**Architecture:** A standalone web application using Vite, React, and Vanilla CSS. It will connect to the Master Database to store and retrieve tenant configurations. The UI will feature a state-of-the-art, premium dark-mode aesthetic with glassmorphism and micro-animations to wow the user.

**Tech Stack:** React (Vite), Vanilla CSS (no Tailwind), `lucide-react` for icons.

---

### Task 1: Initialize the Cockpit Web App

**Files:**
- Create: `admin/` directory
- Create: `admin/package.json` and basic Vite setup
- Create: `admin/index.html`
- Create: `admin/src/main.tsx`

**Step 1: Scaffold Vite App**
Initialize a new Vite React app in the `admin` folder. 
Since we are executing inside the monorepo, we will run the Vite initialization and clean up unnecessary boilerplate.

**Step 2: Commit**
```bash
git add admin/
git commit -m "feat(admin): initialize SpeeQ Cockpit Vite app"
```

---

### Task 2: Implement Premium Design System & Layout

**Files:**
- Create: `admin/src/index.css`
- Create: `admin/src/App.tsx`
- Create: `admin/src/components/Sidebar.tsx`

**Step 1: CSS Design System**
Define CSS variables for a premium dark mode (e.g., `#0A0A0A` background, `#E8500A` SpeeSolutions accent color, glassmorphism utility classes). Ensure we use `Inter` or `Outfit` fonts.

**Step 2: App Shell Layout**
Create `App.tsx` with a CSS Grid layout containing a `Sidebar` and a `MainContent` area. 

**Step 3: Commit**
```bash
git add admin/src/
git commit -m "feat(admin): setup premium dark-mode design system and layout"
```

---

### Task 3: Build the Tenants (Bedrijven) Dashboard

**Files:**
- Create: `admin/src/pages/TenantsPage.tsx`
- Create: `admin/src/components/TenantCard.tsx`

**Step 1: Tenants Page UI**
Build a dashboard view showing active licenses/companies. Include statistics (Active Licenses, Suspended).
Include a visually striking "Nieuwe Klant Aanmaken" button with hover animations.
Render mock data for the "demo" tenant.

**Step 2: Commit**
```bash
git add admin/src/pages/ admin/src/components/
git commit -m "feat(admin): implement tenants overview dashboard"
```

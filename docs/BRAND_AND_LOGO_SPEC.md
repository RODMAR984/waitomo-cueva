# FitEngine / WAITOMO — Brand & Logo Usage Specification

## 1. Brand Architecture

The system is structured with a clear brand hierarchy.

**WAITOMO** is the umbrella brand.
**FitEngine** is the software platform.
**Gyms** are organizations that run on the platform.

**Hierarchy:**

```
WAITOMO (umbrella concept / brand)
↓
FitEngine (software platform)
↓
Organizations (gyms using the platform)
↓
Training Plans / Programs
↓
Users
```

- WAITOMO is not an app and does not have its own interface. It acts only as the conceptual parent brand and signature.
- FitEngine is the real product that users interact with.
- Organizations represent individual gyms that use the platform.

---

## 2. App Identity

The mobile application is always identified as:

**FitEngine**

Optional subtitle:

**FitEngine**  
*by WAITOMO*

- The app icon must always be the **FitEngine logo**. It must never change depending on the gym.
- Even if the platform supports multiple organizations, the installed app remains the same.

---

## 3. Organization Branding

Each gym is stored as an organization.

Database example: `organizations` (id, name, logo_url, primary_color optional).

The logo uploaded in the Admin panel is stored in **organization.logo_url**. This logo represents the gym identity inside the platform.

---

## 4. Where the Organization Logo SHOULD Appear

Only inside the application interface to identify the gym.

**Recommended locations:**

- **Home header** — e.g. `[Organization Logo]   Organization Name`
- **User profile** — section “My Gym” with logo + name (e.g. Waitomo Training)
- **Admin panel** — configuration screen
- **Optional:** welcome header at the top of the home screen

---

## 5. Where the Organization Logo Should NOT Appear

The organization logo must **never** replace the platform identity.

**Do not use organization logos in:**

- App icon
- Splash screen
- Login identity
- Platform branding

The product must always remain identifiable as **FitEngine**.

---

## 6. Splash Screen

The splash screen should represent the platform.

**Recommended layout:**

**FitEngine**  
*by WAITOMO*

WAITOMO should appear smaller than FitEngine.

---

## 7. Login Screen

Login screen should show the platform identity.

**Example:** FitEngine (main). Optional footer: *powered by WAITOMO*.

The gym logo should **not** appear here.

---

## 8. Programs / Training Plans

Training programs do **not** use logos. Programs should be represented by **images** instead (e.g. plan.image — backgrounds or thumbnails).

---

## 9. UI Implementation Example (React Native)

```jsx
<Image
  source={{ uri: organization.logo_url }}
  style={{ width: 40, height: 40, borderRadius: 8 }}
/>
```

**Recommended placement:** HomeScreen header, User profile screen, Admin configuration screen.

---

## 10. Admin Configuration Screen

**Admin → Gym Configuration**

Fields: Logo, Gym Name, Contact Email, Phone (optional).

Uploaded image populates **organization.logo_url**.

---

## 11. Platform Attribution Footer

A small attribution footer at the bottom of the configuration screen:

**FitEngine** *by WAITOMO* © 2026

Small and subtle. Purpose: maintain platform attribution without interfering with gym branding.

---

## 12. Design Principles

Two levels of identity:

1. **Platform identity** — FitEngine (core product)
2. **Organization identity** — Gym name + gym logo

This allows the system to scale to many gyms while preserving a single software platform.

---

## 13. Future Extensions (optional)

- Custom header color (organization.primary_color)
- Gym-specific welcome screen
- Branded notification messages
- Custom gym backgrounds

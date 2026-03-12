# Pokemon Card Generator

## Overview

Pokemon Card Generator is a web application for creating, customizing, and managing digital Pokemon cards. The app features interactive UI, live profile management, and a robust backend powered by Supabase for authentication, storage, and data management. Users can view their collection, analyze Pokemon stats, and access features through a dynamic profile dropdown menu.

## Features

- User Authentication: Sign in, manage profile, upload avatar, set preferences
- Profile Dropdown: Shortcuts to Recent, Collection, Teams, animation toggle, Sign Out
- Live Analysis Chips: Types, evolution chain, strengths, weaknesses; smooth pop-out hover effects
- Gallery: Browse/filter Pokemon cards visually
- Recent: View recently generated/captured cards
- Feedback: Submit feedback and suggestions
- Responsive Design: Optimized for desktop/mobile
- Theme Customization: Dynamic themes based on Pokemon types

## Project Structure

```text
Pokemon Card Generator/
├── about.html           # About page
├── collection.html      # Collection page
├── feedback.html        # Feedback submission page
├── gallery.html         # Card gallery and filters
├── index.html           # Main page (navbar, profile dropdown, generator)
├── profile.html         # User profile page
├── recent.html          # Recently generated/captured cards
├── teams.html           # Teams builder page
├── Supabase_Sstup.sql   # Supabase schema, policies, triggers
├── README.md            # Project documentation
├── CSS/
│   ├── about.css
│   ├── collection.css
│   ├── feedback.css
│   ├── filter.css
│   ├── navbar.css
│   ├── navbar-responsive.css
│   ├── profile.css
│   ├── recent.css
│   ├── style.css
│   ├── teams.css
├── Images/
│   ├── about.jpg
│   ├── feedback.jpg
│   ├── collection.png
│   ├── recent.jpg
│   ├── card.png
│   ├── backgrounds/     # 1.webp ... 31.webp
├── Javascript/
│   ├── animation-toggle.js
│   ├── collection.js
│   ├── profile.js
│   ├── recent.js
│   ├── script.js
│   ├── supabase-client.js
│   ├── teams.js
│   ├── welcome.js
```

## Components

### HTML Pages

- index.html: Entry point; navbar, profile dropdown, generator, live analysis chips
- gallery.html: All generated Pokemon cards, filtering options
- recent.html: Recently generated/captured cards
- about.html: Project info and creators
- feedback.html: User feedback form
- collection.html: User's card collection
- profile.html: User profile management
- teams.html: Team builder and management

### CSS

- style.css: Global styles, chip transitions, dropdown menu, theme variables
- navbar.css: Navbar/profile dropdown styling
- profile.css: Profile page styles
- gallery.css: Gallery layout/card styles
- recent.css: Recent cards page styles
- about.css, feedback.css, filter.css, teams.css: Page-specific styles

### JavaScript

- script.js: Profile dropdown logic, theme switching, chip interactivity, Supabase integration
- collection.js: Collection page logic
- profile.js: Profile page logic
- recent.js: Recent cards logic
- teams.js: Team builder logic
- animation-toggle.js: Animation toggle logic
- supabase-client.js: Supabase client setup
- welcome.js: Welcome screen/onboarding

### Data & Assets

- Images/backgrounds: Background images (1.webp ... 31.webp)
- Images/about.jpg, feedback.jpg, collection.png, recent.jpg, card.png: Page/card images

## Supabase Integration

- Authentication: User sign-in, profile management, avatar storage
- Storage: Avatars/card images
- Database: Trainer profiles, card collection, teams, preferences
- RLS Policies: Secure access to user data
- Triggers: Automatic profile/preference creation, updated_at tracking

## UI Elements

- Navbar: Signed-in username/avatar, profile dropdown
- Profile Dropdown: Shortcuts to Recent, Collection, Teams, animation toggle, Sign Out
- Live Analysis Chips: Types, evolution chain, strengths, weaknesses; smooth pop-out hover effects
- Gallery: Filterable card display
- Feedback Toasts: Success/error notifications

## Accessibility & Responsiveness

- Designed for accessibility and keyboard navigation
- Responsive layouts for mobile and desktop

---

- **Navbar**: Displays signed-in username and avatar; includes profile dropdown.
- **Profile Dropdown**: Shortcuts to Recent, Collection, Teams, animation toggle, and Sign Out.
- **Live Analysis Chips**: Types, evolution chain, strengths, and weaknesses; smooth pop-out hover effects.
- **Gallery**: Filterable card display.
- **Feedback Toasts**: Success/error notifications.

---

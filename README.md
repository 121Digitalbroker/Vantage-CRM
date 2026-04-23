# Vantage CRM

A modern, robust Customer Relationship Management (CRM) system designed for real estate and lead management.

## Features

- **Dashboard:** Interactive charts and pipeline visualization
- **Leads Management:** Full CRUD operations with detailed lead tracking
- **Role-Based Access Control (RBAC):** Distinct views and permissions for Admins, Managers, and Telecallers
- **Follow-Up Scheduling:** Built-in task tracking and reminders
- **Automated Assignment:** Configurable lead assignment timers with automatic reassignment
- **Campaign Tracking:** Monitor ad spend and lead sources
- **Data Import/Export:** Support for CSV operations

## Tech Stack

- **Frontend:** React, Vite, TypeScript
- **Styling:** Tailwind CSS, shadcn/ui
- **Database:** Supabase (PostgreSQL)
- **Routing:** React Router DOM

## Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Environment Setup:**
   Copy `.env.example` to `.env` and fill in your Supabase credentials:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   VITE_USE_DEMO_LEADS=false
   ```

3. **Run the development server:**
   ```bash
   npm run dev
   ```

## Database Setup

To set up the Supabase database, run the SQL migration scripts located in the root directory in your Supabase SQL Editor.

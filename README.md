# ITMS — Issue Tracking Management System

A full-stack, database-centric issue tracking system designed to emphasize **data integrity, transactional correctness, and role-based authorization** over surface-level UI polish.

This project was built as a systems-oriented alternative to typical CRUD demos, trying to focus on schema design, relational constraints, auditability, and backend-enforced permissions.

> **Note:** I am currently working to integrate a fuller, production-quality demo of this system into my [personal site](https://danyalahmed.dev) (React + Next.js, Postgres, OAuth, hosted infrastructure). This repository represents the core system architecture and implementation.
---
## Table of Contents

- [High-Level Overview](#high-level-overview)
- [Architecture](#architecture)
- [Core Design Goals](#core-design-goals)
- [Key Features](#key-features)
- [Repository Structure](#repository-structure)
- [Running Locally (Summary)](#running-locally-summary)
- [Project Use](#project-use)
- [To Do](#to-do)

---

## High-Level Overview

**ITMS** is a (loosely) Jira-style issue tracking platform supporting:

- Multi-project organization
- Role-based access control (Lead / Developer / Viewer)
- Issue lifecycle management
- Assignment, labeling, and commenting
- Immutable issue history (audit trail)
- Backend-enforced authorization using server-side sessions

The system is deliberately structured to prevent correctness from being dependent on frontend behavior.

---

## Architecture

**Stack**
- **Database:** MySQL 8.0
- **Backend:** Python (Flask)
- **Frontend:** React + Vite (TypeScript)
- **Auth:** Server-side HTTP sessions (cookie-based)

**Layered Design**
1. **Relational Database**
   - Enforces foreign keys, uniqueness, and relational integrity
   - Maintains issue history as a first-class entity
2. **API Layer**
   - Owns all authorization logic
   - Prevents privilege escalation via direct API access
3. **Frontend**
   - Consumes typed API responses
   - Cannot bypass role or permission checks

---

## Core Design Goals

- **Correctness over convenience**
- **Backend-enforced authorization**
- **Explicit relational modeling**
- **Auditable state transitions**
- **Concurrency-safe issue creation**

This is intentionally *not* a thin wrapper around an ORM with implicit guarantees.

---

## Key Features

### Authentication & Authorization
- Server-side sessions (no JWTs stored client-side)
- Role-based access enforced exclusively at the API layer
- Permissions cannot be bypassed via browser tooling

### Project & Membership Model
- Public and private projects
- Explicit membership table with per-project roles
- Leads control membership and permissions

### Issue Tracking
- Per-project sequential issue numbering
- Assignment, status, priority, labels
- Role-aware editing permissions

### Issue History (Audit Trail)
- All material issue changes recorded
- Stores old/new values and author
- Enables full reconstruction of issue state over time

### Comments
- Per-issue threaded discussion
- Author-only editing, lead-level deletion

---

## Repository Structure

```text
backend/
  app.py
  auth_utils.py
  db.py
  requirements.txt
  .env.example

db/
  dump.sql
  schema.sql
  routines.sql
  seed.sql
  reset_db.sh

itms-frontend/
  src/
  public/
  vite.config.ts
  .env.example
```

`db/` contains the authoritative schema, procedures, and seed data
`backend/` contains the full API and authorization logic
`itms-frontend` provides a functional but intentionally minimal UI

## Running Locally (Summary)

This repository is designed to be runnable end-to-end on a local machine with minimal setup. The instructions below assume a standard development environment.

### Requirements

- MySQL Server **8.0+**
- Python **3.9+**
- Node.js (**LTS recommended**) and npm
- A modern browser (Fetch API, ES modules, cookies enabled)
- Access to `localhost`

---

## Database Setup

Ensure MySQL Server is running.

The fastest setup path is to execute the provided database dump using the MySQL Server CLI:

```bash
cd db
mysql < dump.sql
```

Alternatively, you can open the dump.sql file in MySQL Server and run the script.

This will create:
- The `itms` database
- All tables, constraints, triggers, and routines
- Seed data for immediate testing

If the dump fails for any reason, the database can be built manually in order:
```bash
mysql < schema.sql
mysql < routines.sql
mysql < seed.sql
```

To reset the database at any time (requires MySQL CLI):
`./reset_db.sh`

## Backend Setup (API Layer)
Navigate to the backend directory and create a virtual environment (skippable but highly recommended):
```bash
cd backend
python -m venv venv
```

Activate it:
- macOS/Linux:
  `source venv/bin/activate`
- Windows:
  `venv/Scripts/activate`
Note that if you're using Git Bash on Windows, you'll want to follow the macOS/Linux command here. IDEs/text editors like VSCode may have more streamlined virtual environment setup that you might prefer.

Whether you choose to use a virtual environment or not, install the dependencies from the `requirements.txt` file.

  ```pip install -r requirements.txt```

## API .env Setup
Crucially, both the frontend and backend have provided `.env.example` files for use by their associated applications. In `backend/`, you can use `cp .env.example .env` to copy the example file into a proper .env file.

It is worthwhile to understand what each field does:
```bash
FLASK_ENV=development
FLASK_DEBUG=1
SECRET_KEY=change-me-for-real-use
DB_HOST=localhost
DB_PORT=3306
DB_NAME=itms
DB_USER=itms_user
DB_PASSWORD=[itms_password]
FRONTEND_ORIGIN: “http://localhost:5173”
```

You should set DB_PORT to the port MySQL Server is running on (3306 by default). DB_NAME will be the name of the database (itms if you used dump.sql). DB_USER should be your connection username - this is usually `root` for many users. DB_PASSWORD should be changed to your password for MySQL Server - **the api will not be able to connect to the database without this configured.**

You may want to change FRONTEND_ORIGIN later, if port :5173 does not work on your machine for some reason. SECRET_KEY can be kept as it is, although in a real-world scenario, it should be a long, secure, randomized string for use in cookie authentication.

Once the .env file is configured, you can run `python app.py` to start the app. You should see a message saying `Running on http://127.0.0.1:8000`. With `FLASK_DEBUG` set to 1, you can see request information as it arrives from the frontend, or a testing framework like Postman.

Now you can move on to setting up the frontend. Make sure to complete the frontend setup in a new terminal, so that by the end you have both the API layer and the frontend Vite server running at the same time.

## Frontend Setup
**PLEASE ENSURE THERE IS NO EXISTING `node_modules` FOLDER IN YOUR DIRECTORY**. Remove it if still present.

To start the frontend, use the following commands:
  ```bash
  cd itms-frontend
  cp env.example .env
  npm install
  ```

This should create a .env file for the frontend, and install all necessary node modules to run the frontend application on your machine. Once the packages have finished installing, run the following command:

  ```bash 
  npm run dev
  ```

This will start the local Vite Dev Server, and output a url like `http://localhost:5173`. You should be able to use that url to view the ITMS Login page in your browser.

### A Note on Ports and CORS
By default, this application is set up with the following port assignments in mind:
- MySQL: 3306 (default)
- API: 8000
- Frontend: 5173

This is built to work out of the box with minimal collisions, but if these ports are already occupied by other services on your machine, you can change them in the following ways:
- _MySQL Server_: This is the trickiest to reconfigure, requiring you to alter config files. I recommend looking at [official documentation[(https://dev.mysql.com/doc/mysql-port-reference/en/mysql-port-reference-tables.html) for help here.
- _API_: The API’s port is defined at the bottom of app.py in a line reading `app.run(host=”0.0.0.0”, port=8000, debug=app.config[“DEBUG”]`.
  
    If you would like to change this to another port, ensure that you also change the .env file found at /itms-frontend/.env to match with:
    `VITE_API_BASE_URL=http://localhost:<new_port>`
- _Frontend_: There is a fairly low chance of port collisions here, but if you'd like to change it, add the following to your `vite.config.ts` file:
    ```typescript
    export default defineConfig({
    // ...some configs
    server: {port: <new_port>, },
    });
    ```
    Ensure that you change the associated port in `/backend/.env`:

    ```bash
    FRONTEND_ORIGIN="http://localhost:<new_port>"
    ```

# Project Use
You should now have a running backend (app.py) and frontend (Vite server). You can now access http://localhost:5173 (or whatever other port you've chosen) and immediately get pushed to the login screen. The following accounts are provided by `dump.sql`:
|Role|username|password|
|:---|:---:|---:|
|LEAD|lead1|leadpass|
|DEVELOPER|dev1|devpass|
|VIEWER|viewer1|viewpass|

You should, at this stage, be able to register your own user and start creating/editing projects. Feel free to:
- View projects
- View membership
- Create new projects
- Create/edit issues
- Assign and remove project members
- Apply labels
- Add and delete comments
- Watch history updates to issues over time

## To do:
- Rebuild frontend in Next.js with SSR and stronger data flow
- Integrate hosted, interactive demo onto personal site
- Expand API surface for richer querying and aggregation
- Improve user autonomy (self-removal, user directory, custom views, advanced filtering)
- Add notification and activity-based features



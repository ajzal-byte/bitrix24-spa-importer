# SPA Importer

A local web app for migrating Bitrix24 smart processes (SPAs) from one portal to another. It recreates the SPA configuration and custom fields in the target CRM using incoming webhooks.

## What it does

1. Connect a **source** and **target** Bitrix24 portal via incoming webhooks
2. Load and select a smart process from the source portal
3. Migrate it to the target portal, including:
   - SPA type settings
   - Workplace (if the SPA belongs to one)
   - Custom fields

Webhook URLs are used only in your browser session and are not stored.

## Prerequisites

- Node.js 18+
- Incoming webhooks on both Bitrix24 portals with CRM permissions

Webhook URL format:

```
https://your-portal.bitrix24.com/rest/1/xxxxxxxx/
```

## Getting started

Install dependencies:

```bash
npm install
```

Run the dev server:

```bash
npm run dev
```

Open the URL shown in the terminal (usually `http://localhost:5173`).

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview the production build |
| `npm run lint` | Run Oxlint |

## Tech stack

- React + TypeScript
- Vite
- Tailwind CSS
- Bitrix24 REST API

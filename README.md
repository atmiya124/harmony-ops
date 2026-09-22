# Harmony Ops

Harmony Ops is an internal operations tool for Harmony Production that combines event booking management, AI-assisted inquiry extraction, and deterministic LED/stage calculations in one workflow.

The goal is simple: reduce manual data entry while keeping operational decisions predictable, reviewable, and easy for staff to use.

## Problem

Event inquiries often arrive through email or chat as unstructured text. Staff then have to manually identify and enter:

- client information
- event date and timing
- venue
- requested services
- equipment requirements
- LED and stage dimensions
- special notes

This creates repetitive work and increases the chance of missing or misinterpreting details.

## Solution

Harmony Ops lets a staff member paste a client inquiry and uses an LLM to convert the unstructured message into a structured booking draft.

The workflow is:

```text
Client inquiry
      ↓
Claude LLM extraction
      ↓
Zod schema validation
      ↓
Equipment catalog matching
      ↓
Deterministic LED / stage calculations
      ↓
Human review
      ↓
Save booking
      ↓
AI audit log
```

The LLM is used for tasks that involve ambiguity and natural language. Deterministic application logic is used for calculations that must be predictable and testable.

## Key Features

### AI-assisted booking extraction

Staff can paste a customer email or chat message into the booking form.

Claude extracts structured information such as:

- client name, email and phone
- event date
- setup, start, end and pickup times
- event type
- venue
- equipment
- services
- special notes

Each extracted value is classified as:

- `confirmed` — explicitly stated by the customer
- `assumed` — inferred from context and requires review
- `missing` — not provided

### Human-in-the-loop review

AI output is never saved directly.

The user reviews the extracted draft, edits missing or incorrect information, and explicitly confirms the booking before it is written to the database.

### Runtime schema validation

LLM responses are validated with Zod before the application uses them.

This protects the application from malformed or unexpected model output and prevents invalid data from flowing into the booking workflow.

### Deterministic equipment calculations

The LLM interprets what the customer requested, but it does not perform operational calculations.

For example, when a customer requests a `16 x 9 ft LED wall`, Harmony Ops passes the dimensions to the existing LED calculator.

The calculator determines values such as:

- number of panels
- actual screen dimensions
- pixel resolution
- power requirements
- cable requirements
- flight cases
- screen area

The same approach is used for stage calculations.

This separation keeps probabilistic AI away from calculations that require predictable results.

### AI audit trail

Harmony Ops records AI-assisted booking activity for traceability.

The audit record includes:

- original customer inquiry
- AI-generated structured result
- differences between the AI draft and the final user-approved booking
- model used
- timestamp

This makes it possible to understand how AI influenced a booking and where a staff member corrected the model.

### Booking and event management

Harmony Ops also includes:

- upcoming bookings
- today's events
- booking details
- booking editing
- event status tracking
- equipment and service tracking
- pricing settings

### LED calculator

Built-in P2.6 LED wall calculator with deterministic calculations for panel count, resolution, power, cables, area and related production requirements.

### Stage calculator

Calculates stage panel requirements and supporting components from requested stage dimensions.

## Technical Decisions

### Why use an LLM?

Customer inquiries are inconsistent and unstructured. Natural-language extraction is therefore a good use case for an LLM.

### Why not use AI for everything?

Panel counts, electrical requirements and stage calculations follow known business rules.

Traditional application logic is:

- faster
- predictable
- testable
- cheaper
- easier to debug

Harmony Ops therefore uses AI for interpretation and deterministic code for calculations.

### Why require human approval?

An AI-generated booking can contain assumptions or misunderstand ambiguous customer language.

A human review step prevents model output from silently becoming operational data.

### Why schema validation?

TypeScript types only protect the application at development time.

Data returned by an external AI model exists at runtime, so Zod validates the actual response before Harmony Ops accepts it.

## AI Reliability Testing

The extraction workflow is tested with different styles of customer inquiries, including:

- complete inquiries
- missing information
- vague requirements
- contradictory dates
- WhatsApp-style messages
- ambiguous equipment sizes
- quote deadlines that should not be interpreted as event dates
- incomplete customer contact information

The goal is not to assume the model is always correct. The system combines validation, confidence levels, human review and audit logging to manage uncertainty.

## Tech Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- Anthropic Claude API
- Zod
- Turso / libSQL
- Drizzle ORM
- Lucide React

## Architecture

```text
┌───────────────────────────┐
│ Client Email / Chat       │
└─────────────┬─────────────┘
              │
              ▼
┌───────────────────────────┐
│ Claude Extraction         │
│ Unstructured → Structured │
└─────────────┬─────────────┘
              │
              ▼
┌───────────────────────────┐
│ Zod Runtime Validation    │
└─────────────┬─────────────┘
              │
              ▼
┌───────────────────────────┐
│ Equipment Catalog         │
└─────────────┬─────────────┘
              │
              ▼
┌───────────────────────────┐
│ Deterministic Logic       │
│ LED / Stage Calculators   │
└─────────────┬─────────────┘
              │
              ▼
┌───────────────────────────┐
│ Human Review              │
└─────────────┬─────────────┘
              │
              ▼
┌───────────────────────────┐
│ Turso Database            │
│ Booking + Audit Record    │
└───────────────────────────┘
```

## Local Setup

Clone the repository and install dependencies:

```bash
git clone https://github.com/atmiya124/harmony-ops.git
cd harmony-ops
npm install
```

Create a `.env` file based on `.env.example`:

```env
ANTHROPIC_API_KEY=
TURSO_DATABASE_URL=
TURSO_AUTH_TOKEN=
```

Set up the database:

```bash
npm run db:push
npm run db:seed
```

Start the development server:

```bash
npm run dev
```

## Engineering Focus

Harmony Ops is intentionally designed as a small, practical internal tool rather than an AI-heavy product.

The core engineering principle is:

> Use AI where ambiguity exists. Use deterministic software where correctness can be encoded.

That keeps the user experience simple while still gaining value from AI where it is most useful.

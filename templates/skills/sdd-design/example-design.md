# Design

## Overview

Credit notes live in a new `returns` module. Issuing one stores it and publishes an event on the message broker (D1, ADR-NEW-1). Credit note numbers follow `CRN-<year>-<sequence>` (D2). The invoice module gains a due date and loses the reprint action.

## Requirements Traceability

| ID | Name | Components | Test Level |
|---|---|---|---|
| REQ-INV-1 | Issue invoice on confirmation | InvoiceService | Integration |
| REQ-INV-2 | Reprint invoice | InvoiceController | Integration |
| REQ-CRN-NEW-1 | Issue credit note | CreditNoteService | Integration |
| REQ-CRN-NEW-2 | Refuse a second credit note | CreditNoteService | Unit |
| DATA-CRN-NEW-1 | Credit note record | CreditNoteRepository | Integration |
| IF-CRN-NEW-1 | Credit note issued event | CreditNotePublisher | Contract |
| NFR-CRN-NEW-1 | Credit note response time | CreditNoteController | Performance |

## Components and Interfaces

### CreditNoteService
- Location: src/returns/ (new)
- Responsibility: Issue a credit note and refuse a second one for the same invoice.
- Depends on: CreditNoteRepository, CreditNotePublisher
- Provides: issue(invoiceNumber)

### CreditNotePublisher
- Location: src/returns/ (new)
- Responsibility: Publish the credit note issued event.
- Depends on: message broker
- Provides: publish(creditNote)

### InvoiceService
- Location: src/invoice/
- Responsibility: Add the due date to issued invoices.
- Depends on: payment terms
- Provides: issue(orderId)

## Data Model

The credit note table stores the fields of DATA-CRN-NEW-1, with a unique key on the invoice number.

## Error Handling

| Case | Behavior |
|---|---|
| The invoice already has a credit note | Keep the existing one and return the already credited message |
| The broker is unavailable | Keep the credit note and retry publishing |

## Testing Strategy

| Test Level | Runs on | Notes |
|---|---|---|
| Unit | Local | Refusal of a second credit note |
| Integration | Local | Issue flow, due date, removed reprint route |
| Contract | CI | Event shape against the accounting schema |
| Performance | Staging | p95 from issue to display |

## Migration

Create the credit note table before deploying the service.

## Steering changes at a glance

- /steering/messaging.md: New broker rules for credit-note events (ADR-NEW-1).
- /steering/tech.md: Stack section notes messaging on the broker.

# Delta

## New steering: /steering/messaging.md

- title: Messaging
- description: Rules for events on the message broker.
- tags: [messaging]

### ADDED

#### Purpose
- rationale: ADR-NEW-1

How capabilities publish events for other systems.

#### Rules

- Publish an event after the record is stored.
- Name events as past-tense facts, such as `credit-note-issued`.

#### Related

- [tech](/steering/tech.md)

## /steering/tech.md

### SECTIONS

#### Stack
- rationale: ADR-NEW-1

- Node.js services

##### Messaging

A message broker carries events to other systems.

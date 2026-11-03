# Summary

- Billing clerks issue whole-invoice credit notes for returned orders (REQ-CRN-NEW-1, DATA-CRN-NEW-1); accounting receives events (IF-CRN-NEW-1).
- Invoices show a due date on confirmation; reprint is removed (REQ-INV-1, REQ-INV-2).
- Credit note UI response time is bounded (NFR-CRN-NEW-1).
- Out of scope: partial refunds.
Open questions: 1; Undecided: 1

## Role and screen map

| Screen / operation | Billing clerk | Accounting system |
|---|---|---|
| Issue credit note for a returned invoice | Record a whole-invoice credit note REQ-CRN-NEW-1, DATA-CRN-NEW-1 | Receive credit-note-issued event IF-CRN-NEW-1 |
| Confirm order / view invoice | See due date on issued invoice REQ-INV-1 | impossible: accounting has no invoice UI |
| Credit note list after issue | See issued credit note within 2 s NFR-CRN-NEW-1 | undecided |

# Context

## Actors

- Billing clerk: issues credit notes for returned orders.
- Accounting system: receives issued credit notes.

## Current behavior

- REQ-INV-1 issues an invoice when an order is confirmed.
- REQ-INV-2 lets a clerk reprint an invoice.

## Proposal Coverage

- Credit notes for returned orders:
  - REQ-CRN-NEW-1 Issue credit note for whole invoice
  - REQ-CRN-NEW-2 Refuse a second credit note
  - DATA-CRN-NEW-1 Credit note record
- Send credit notes to accounting:
  - IF-CRN-NEW-1 Credit note issued event
- Quick credit note screen:
  - NFR-CRN-NEW-1 Credit note response time
- Show the due date on invoices:
  - REQ-INV-1 Issue invoice on confirmation
- Stop reprinting invoices:
  - REQ-INV-2 Reprint invoice
- Credit note numbering: design: number format and sequence storage
- Partial refunds: out of scope: the proposal defers them

## Assumptions

- One credit note covers one whole invoice.

# Open Questions

- [ ] Q3: Does a credit note expire?
  - [4] Never
  - [3] After one year

# Delta

## Coverage

| capability | spec.md | interfaces.md | data.md | quality.md |
|---|---|---|---|---|
| /specs/billing/invoice | changed | no change: no contract changes | no change: no stored field changes | no change: no quality target |
| /specs/returns/credit-note | changed | changed | changed | changed |

## New domain: /specs/returns

- title: Returns
- description: Handles returned orders.

## New capability: /specs/returns/credit-note

- code: CRN
- title: Credit note
- description: Credit notes for returned orders.
- tags: [returns]

## /specs/billing/invoice/spec.md

### MODIFIED

#### REQ-INV-1: Issue invoice on confirmation
- change: The invoice now shows its due date.

When an order is confirmed, the system SHALL issue an invoice that shows its due date.

##### Scenario: Issue on confirmation
- **Given** an order with payment terms
- **When** the order is confirmed
- **Then** an invoice with the due date is issued

### REMOVED

#### REQ-INV-2
- reason: Clerks download invoices instead of reprinting them.

## /specs/returns/credit-note/data.md

### METADATA

- title: Credit note record
- description: Stored credit notes.
- tags: [returns]

### SECTIONS

#### Purpose

Keep issued credit notes. DATA-CRN-NEW-1 is the record.

### ADDED

#### DATA-CRN-NEW-1: Credit note
- Classification: Confidential
- Retention: 7 years

The system SHALL persist each issued credit note.

| Element | Type | Required | Constraints | Description |
|---|---|---|---|---|
| invoiceNumber | string | yes | one credit note per invoice | Credited invoice |
| amount | decimal | yes | equals the invoice total | Credited amount |
| status | enum(issued, sent) | yes | | Delivery state |
| issuedAt | datetime | yes | | Issue time |

## /specs/returns/credit-note/interfaces.md

### METADATA

- title: Credit note events
- description: Events sent to accounting.
- tags: [returns]

### SECTIONS

#### Purpose

Tell accounting about issued credit notes.

### ADDED

#### IF-CRN-NEW-1: Credit note issued
- Kind: Event
- Direction: Provided
- Counterpart: External: Accounting system
- Compatibility: Backward compatible changes only

When a credit note is issued, the system SHALL send the credit note to the accounting system.

## /specs/returns/credit-note/quality.md

### METADATA

- title: Credit note quality
- description: Credit note response time.
- tags: [returns]

### SECTIONS

#### Purpose

Bound the time a clerk waits for a credit note.

### ADDED

#### NFR-CRN-NEW-1: Credit note response time
- Characteristic: Performance efficiency
- Measure: p95 time from issue to display
- Target: <= 2 s
- Condition: 20 clerks issuing at once
- Verification: Test

When a clerk issues a credit note, the system SHALL display it within 2 s at p95.

## /specs/returns/credit-note/spec.md

### SECTIONS

#### Purpose

Let a clerk cancel the charge of a returned order.

#### Scope

Issuing credit notes for whole invoices. Invoices themselves belong to [Invoice](/specs/billing/invoice/).

#### Related

- [Invoice](/specs/billing/invoice/)

### ADDED

#### REQ-CRN-NEW-1: Issue credit note
When a clerk issues a credit note for an issued invoice, the system SHALL record a credit note for the whole invoice amount.

##### Scenario: Credit a returned order
- **Given** an issued invoice without a credit note
- **When** the clerk issues a credit note for it
- **Then** a credit note for the whole amount is listed on the invoice

#### REQ-CRN-NEW-2: Refuse a second credit note
If a clerk issues a credit note for an invoice that already has one, then the system SHALL leave the existing credit note from REQ-CRN-NEW-1 unchanged and show that the invoice is already credited.

##### Scenario: Second credit note
- **Given** an issued invoice with a credit note
- **When** the clerk issues another credit note for it
- **Then** the invoice still has one credit note
- **And** a message says the invoice is already credited

## /steering/product.md

### SECTIONS

#### Operational Scenarios

- A customer confirms an order and receives an invoice.
- A clerk issues a credit note when an order is returned, and accounting receives it.

## /steering/glossary.md

### ADDED

#### Issued invoice

An invoice the system has sent to the customer.

<details>
<summary>Answered open questions</summary>

- [x] Q1: Second credit note for one invoice?
  - [5] Refuse it (chosen)
  - [3] Replace the first one
  - [2] Allow both
  Answer: REQ-CRN-NEW-2
- [x] Q2: Does the customer see credit notes?
  - [4] No (chosen)
  - [3] Yes, on the invoice page
  Answer: no delta

</details>

# Steering example

Each block below is one file in `__SDD_DOCS_DIR__/steering/`, and together they pass `check` once `/specs/billing/` exists. Copy the frontmatter, heading order, glossary term level, and link form. Write the bodies in `__SDD_LANG__` from the code, and replace every product fact.

## product.md

```markdown
---
type: Steering
title: Product
description: Purpose, users, and operational scenarios of the order service.
tags: [product]
---
# Product

## Purpose

The order service takes customer orders and bills them.

## Stakeholders and Users

- Customers place orders.
- Billing clerks handle invoices.

## Capabilities Overview

- [Billing](/specs/billing/): invoices for confirmed orders.

## External Systems

- The payment provider charges customers.

## Operational Scenarios

- A customer confirms an order and receives an invoice.

## Constraints

- Invoices are kept for seven years.

## Related

- [Glossary](/steering/glossary.md)
```

## glossary.md

```markdown
---
type: Steering
title: Glossary
description: Terms shared by two or more capabilities.
tags: [product]
---
# Glossary

## Terms

### Billing clerk

A staff member who handles invoices.

### confirmed order

An order the customer has committed to pay.

### Invoice

A bill for one confirmed order.

## Related

- [Product](/steering/product.md)
```

## architecture.md

```markdown
---
type: Steering
title: Architecture
description: Structure and quality priorities of the order service.
tags: [architecture]
---
# Architecture

## Overview

One Node.js service with a relational database.

## Quality Priorities

1. Correct invoices
2. Availability during business hours

## Context View

Customers use the web front end. The service calls the payment provider.

## Component View

- `src/orders` takes orders.
- `src/invoice` issues invoices.

## Runtime View

Confirming an order issues its invoice in the same transaction.

## Deployment View

One container per environment, deployed from CI.

## Cross-cutting Concerns

- Every request is logged with a request id.

## Related

- [Tech](/steering/tech.md)
```

## tech.md

```markdown
---
type: Steering
title: Tech
description: Stack, commands, and conventions of the order service.
tags: [tech]
---
# Tech

## Stack

- Node.js services
- PostgreSQL

## Development Environment

Node.js 22 and Docker Compose.

## Common Commands

- `npm test` runs the tests.
- `npm run dev` starts the service.

## Coding Conventions

ES modules, and one exported function per use case.

## Testing Approach

Unit tests beside the code, integration tests in `test/`.

## Related

- [Structure](/steering/structure.md)
```

## structure.md

```markdown
---
type: Steering
title: Structure
description: Repository layout and module boundaries of the order service.
tags: [structure]
---
# Structure

## Repository Layout

- `src/` holds one directory per module.
- `test/` holds integration tests.

## Module Boundaries

A module calls another module only through its exported functions.

## Naming Conventions

Files use kebab-case.

## Dependency Rules

`src/invoice` may import `src/orders`, not the reverse.

## Code-to-Specs Mapping

- `src/invoice` implements [Billing](/specs/billing/).

## Related

- [Architecture](/steering/architecture.md)
```

# Research

## Questions

- RQ1: How does the accounting system accept credit notes?
- RQ2: How are invoice numbers formatted today?

## Findings

### RQ1

- The accounting system reads events from the shared message broker. (source: https://accounting.example.com/docs/events, accessed 2026-10-27)
- A direct HTTP call is lost while accounting is down. (source: `curl -i https://accounting.example.com/health` returned 503 during the nightly batch)

### RQ2

- Invoice numbers are `INV-<year>-<sequence>`. (source: src/invoice.js:1)

## Options

### D1: Delivery to accounting
- Drivers: delivery survives an accounting outage
- Related: RQ1

| Option | Pros | Cons |
|---|---|---|
| Message broker event | Retries are built in | Adds a broker dependency |
| Direct HTTP call | Simple | Lost while accounting is down |

### D2: Credit note number format
- Drivers: matches invoice numbers
- Related: RQ2

| Option | Pros | Cons |
|---|---|---|
| `CRN-<year>-<sequence>` | Same shape as invoices | Needs its own sequence |
| Invoice number with a suffix | No new sequence | Breaks when one invoice gets two documents |

## Conclusions

- D1: Message broker event -> ADR-NEW-1
- D2: `CRN-<year>-<sequence>` -> No ADR (only the credit note capability uses it, and it is cheap to change)

# Delta

## ADDED

### ADR-NEW-1: Send accounting documents as broker events
- description: Accounting receives credit notes as message broker events.
- tags: [messaging]
- slug: broker-events-for-accounting

#### Context and Problem Statement

Accounting must receive every issued credit note, including those issued while it is down.

#### Decision Drivers

- Delivery survives an accounting outage
- One delivery path for all accounting documents

#### Considered Options

- Message broker event
- Direct HTTP call

#### Decision Outcome

Chosen option: message broker event, because the broker retries delivery while accounting is down.

##### Consequences

- Good, because no credit note is lost during an outage.
- Bad, because the service now depends on the broker.

#### Pros and Cons of the Options

##### Message broker event

- Good, because retries are built in.
- Bad, because it adds a broker dependency.

##### Direct HTTP call

- Good, because it is simple.
- Bad, because calls are lost while accounting is down.

#### Related

- [Credit note](/specs/returns/credit-note/)

# Testing Strategy

## Test layers

1. Unit tests:
- Actions, guards, pure transition logic.

2. Actor tests:
- Start actors, send events, assert snapshots and outputs.

3. Integration tests:
- Orchestrator plus real or fake worker actors.

4. Model/path tests:
- Generate critical paths from machine model.

## Priority scenarios

- Happy path completion.
- Cancellation at each in-flight stage.
- Retry exhaustion and terminal failure.
- Recovery from persisted snapshot.
- Out-of-order or duplicate events.

## Assertions to include

- Current state value.
- Context data invariants.
- Emitted events to collaborators.
- Invoked actor lifecycle (started/stopped as expected).

## Simulated time

Use simulated clocks for deterministic timeout testing.
Avoid wall-clock sleeps in tests.

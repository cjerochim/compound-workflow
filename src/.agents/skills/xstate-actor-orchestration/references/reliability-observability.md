# Reliability and Observability

## Retry and timeout policy

Represent policy as states, not hidden timers.

Common structure:
- `working`
- `retry_wait`
- `failed_transient`
- `failed_terminal`

Track attempt counts in context and cap retries.

## Persistence

Use persisted snapshots for resumable workflows:
- Capture via `actor.getPersistedSnapshot()`.
- Restore via `createActor(logic, { snapshot })`.

Use persistence when workflows must survive reload/restart.

## Inspection

Attach an inspector at root actor creation.
Listen for:
- `@xstate.actor`
- `@xstate.event`
- `@xstate.snapshot`
- `@xstate.microstep`

Use inspection for diagnostics and test assertions, not business decisions.

## Recovery design checklist

1. Can the same external side effect run twice safely?
2. Which state is safe to restore into?
3. What event can resume the workflow after restart?
4. Which failures are user-recoverable vs terminal?

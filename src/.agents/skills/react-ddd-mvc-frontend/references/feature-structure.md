# Feature Structure (DDD + MVC Hybrid)

Default structure for each frontend feature:

```text
src/features/<feature-name>/
  application/
    containers/
    controller/
  domain/
    entities/
  presentation/
    components/
    layout/
  infrastructure/
    services/
    mock-services/
```

## Notes

- Group work by domain.
- Use `src/features/common/` only for cross-domain shared concerns.
- Keep the shape consistent across features unless there is a clear, documented reason to deviate.


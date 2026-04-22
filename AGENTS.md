This repo uses bun as the default package manager. Do not use other package managers.

When using env vars, use the `env` package. Do not use `process.env`.

General dev should follow the Karpathy guidelines, use your karpathy-guidelines skill to ensure that the codebase is consistent.

When doing any backend development use your tdd skill and reference [testing.md](./docs/testing.md) to understand what tests are important. The only exception to this is refactors. Where the tests should be the trusted source of truth to ensure that the codebase is not broken, refactors should be done in isolation and tested in the same way as the original code.

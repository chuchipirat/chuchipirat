# Refactoring Guidelines

Consult this file when asked to refactor a file or component. Apply these checks:

## Code Organization & Structure

- Component size and single responsibility — are components doing too much?
- Proper separation of concerns (UI vs logic vs data fetching)
- File/folder structure and naming conventions
- Functions should do **one thing** — if you can extract a sub-function with a name that isn't just a restatement of the implementation, the function does too much
- Keep functions small — they should read like a short narrative, not a wall of logic
- Maintain consistent abstraction levels within a function — don't mix high-level orchestration with low-level details

## Naming

- Use intention-revealing names — a name should explain _why_ it exists and _what_ it does without needing a comment
- No misleading names — a name must not promise something the code doesn't deliver
- Make distinctions meaningful — if two things have different names, they must have different purposes (avoid `data`/`info` or `handler1`/`handler2`)
- **Never use single-letter or cryptic abbreviation names** — not even in short arrow functions or lambdas. A short scope does not justify an unreadable name.
  ```typescript
  // ❌ Never
  materials.filter((m) => m.usable)
  materials.find((m) => m.uid === uid)
  state.materials.map((m) => ({...m}))

  // ✅ Always
  materials.filter((material) => material.usable)
  materials.find((candidate) => candidate.uid === uid)   // "candidate" when the result is assigned to a same-type variable
  state.materials.map((material) => ({...material}))
  ```
  Acceptable exceptions: `_` for intentionally unused parameters, `i`/`j` only for pure numeric index loops where no better name exists (though even then prefer `index`).
- Use pronounceable, searchable names — the name must be greppable across the codebase
- Avoid mental mapping — no cryptic abbreviations; the reader should never have to translate

## Type Safety

- Proper TypeScript usage — avoid `any`, prefer `unknown` when the type is truly unknown
- Props interfaces well-defined and documented
- Generic types used appropriately
- Type inference vs explicit typing balance

## Functions & Arguments

- Prefer fewer arguments (0–1 ideal, 2 acceptable, 3+ should be wrapped into an object)
- Each argument should serve a clear purpose: asking a question, transforming data, or handling an event
- Data flows **in** through arguments and **out** through return values — avoid output arguments that mutate inputs
- Respect **Command-Query Separation** — a function either changes state or returns data, never both

## Performance

- Unnecessary re-renders (missing memoization with `useMemo`, `useCallback`, `React.memo`)
- Heavy computations that should be memoized

## State Management

- Is state at the right level? (avoiding prop drilling vs over-centralization)
- Could `useReducer` replace complex `useState` logic?
- Are derived values computed instead of stored?
- Proper use of refs vs state

## Side Effects & Data Flow

- `useEffect` dependencies correct and minimal
- No missing cleanup functions
- Async operations handled properly
- Clear data flow (unidirectional)
- **No hidden side effects** — if a function does more than its name promises, rename it or split it

## Error Handling

- Prefer exceptions/error boundaries over error codes or silent failures
- Extract error handling logic into separate functions — it's its own responsibility
- Async error paths explicitly handled (try/catch, `.catch()`, error states in UI)

## React Best Practices

- Key props on lists
- Controlled vs uncontrolled components used appropriately
- Custom hooks to extract reusable logic
- Proper error boundaries
- Prefer early returns to reduce nesting
- Prefer polymorphism/component composition over complex conditional rendering (`switch`/`if`-chains in JSX)

## Code Quality

- **DRY** — every piece of logic should have a single, authoritative representation; extract reusable components/hooks
- Readable variable/function names (see Naming section above)
- Comments explain **why**, not **what** — if the code already says it, the comment is noise
- Remove outdated or misleading comments — a wrong comment is worse than none
- Consistent code style

## Testability

- The code must be testable by unit tests
- If unit tests are missing, create them for the refactored code
- Database access and API calls must be mocked

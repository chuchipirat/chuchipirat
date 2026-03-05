# Migration Guide (Firebase → Supabase)

Consult this file when migrating domain entities from Firebase to Supabase/Postgres.

## 3-Layer Pattern

When migrating domain entities, follow this architecture:

```
UI Component  →  Domain Service (.class.ts)  →  Repository
   (tsx)         (pure business logic)           (persistence/CRUD)
```

**The UI never calls the Repository directly.** It accesses data through the `DatabaseContext` (`useDatabase()`) which exposes Repository methods, and calls Domain Service classes for business logic (validation, transformations, scaling).

### Layer Responsibilities

| Layer | Location | Responsibility | DB Access? |
|-------|----------|---------------|------------|
| **Repository** | `src/components/Database/Repository/` | CRUD, `toRow()`/`toDomain()` mapping, query filters | Yes |
| **Domain Service** | `src/components/<Feature>/<entity>.class.ts` | Validation, transformations, computed values, factories | **No** |
| **UI Component** | `src/components/<Feature>/<component>.tsx` | Rendering, user interaction, state management | Via `useDatabase()` |

## When to Keep a Domain Service vs. Domain Interface

- **Keep `.class.ts`** if the entity has **business logic** (validation, scaling, transformations, factory methods). Strip all DB/Firebase code during migration — it becomes a **pure logic service**.
  - Examples: `Recipe` (~19 business logic methods), `Product` (merging, conversion), `Event`, `Material`
- **Use only a Domain Interface** (defined in the Repository file) if the entity is a **simple data structure** with no business logic beyond what the Repository handles.
  - Examples: `GlobalSettings` (just two booleans), `SystemMessage` (only validTo normalization, handled in Repository)

## Migration Workflow for a `.class.ts` File

1. **Create Repository** (`<Entity>Repository.ts`): Define `Row` interface, `Domain` interface, `toRow()`/`toDomain()`, CRUD methods
2. **Strip DB code from `.class.ts`**: Remove all Firebase/Supabase calls, keep pure business logic (validation, transformations, factories)
3. **Update UI**: Replace `Entity.save({firebase, ...})` with `database.<entity>.save(...)` and keep `EntityService.validate(...)` calls
4. **If `.class.ts` becomes empty** (no business logic methods remain): Delete it, use `Domain` interface from Repository instead

## Migration Progress

| Phase | Scope | Status |
|-------|-------|--------|
| **Phase 1** | Supabase infrastructure, storage, environment setup | Done |
| **Phase 2** | Auth (Supabase Auth primary, Firebase fallback), user profiles, image storage | Done |
| **Phase 3** | GlobalSettings, SystemMessages, Admin UI restructuring | Done |
| **Phase 4** | Masterdata: Departments, Units, Materials, Products, Unit Conversions | Done |
| **Phase 5+** | Events, Recipes, Requests, Feeds, Stats | Pending (still on Firebase) |

## Migration Jobs

Firebase → Supabase data migration is handled by dedicated job classes in `src/components/Admin/MigrationJobs/`.

Each `MigrationJob` fetches Firebase records and writes them to Supabase via the corresponding Repository's `insert()` or `upsert()` using the `database.admin.*` service-role client (bypasses RLS).

**Existing jobs** (in dependency order):

1. `UserMigrationJob` — User profiles (Phase 2)
2. `ImageMigrationJob` — File uploads (Phase 2)
3. `DepartmentMigrationJob` — Departments (Phase 4)
4. `UnitMigrationJob` — Units (Phase 4)
5. `MaterialMigrationJob` — Materials (Phase 4)
6. `ProductMigrationJob` — Products (Phase 4, depends on departments/units)
7. `UnitConversionBasicMigrationJob` — Standard unit conversions (Phase 4, depends on units)
8. `UnitConversionProductMigrationJob` — Product-specific unit conversions (Phase 4, depends on products/units)

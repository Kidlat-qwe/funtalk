# Database setup (Neon / PostgreSQL)

## If you see `relation "userstbl" does not exist` (42P01)

Either the **base schema was never applied** to this database, or **session `search_path`** did not include `public` (common with Neon’s pooler).

### 1. Apply the base schema (empty / new database)

In the **Neon SQL Editor** (same database as `DB_NAME` in `backend/.env`):

1. Open `docs/DATABASE.md`, copy **the entire file** (it is valid SQL), paste, and run.
2. Run `docs/DATABASE_ADD_BILLING_TYPE_TO_USERS.sql`.
3. Run `docs/migrations/appointment_teacher_id_nullable.sql`.

### 2. Pin `search_path` for your DB role (recommended on Neon pooler)

Run once (replace the role name with your Neon user if different):

```sql
ALTER ROLE "Funtalkdb_owner" SET search_path TO public, pg_catalog;
```

The API also runs `SET search_path` on each new pooled connection as a fallback.

### 3. Create users

Login expects a row in `userstbl` (and your frontend’s Firebase flow). After schema load, register via the app or insert a test user consistent with your auth rules.

### 4. Restart the backend

Restart `node server.js` after schema changes.

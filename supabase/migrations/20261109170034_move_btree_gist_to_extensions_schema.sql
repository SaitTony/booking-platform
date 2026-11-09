-- Keep the PostgreSQL extension outside the exposed public API schema.
-- Existing GiST indexes retain their operator-class dependencies when the extension is relocated.
alter extension btree_gist set schema extensions;

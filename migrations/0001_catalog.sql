PRAGMA foreign_keys = ON;
CREATE TABLE products (id TEXT PRIMARY KEY, payload TEXT NOT NULL CHECK(json_valid(payload)), fetched_at TEXT NOT NULL);
CREATE INDEX products_fetched ON products(fetched_at);
CREATE TABLE bodies (id TEXT PRIMARY KEY, payload TEXT NOT NULL CHECK(json_valid(payload)));
CREATE TABLE avatars (id TEXT PRIMARY KEY, product_id TEXT NOT NULL UNIQUE REFERENCES products(id), body_id TEXT REFERENCES bodies(id), payload TEXT NOT NULL CHECK(json_valid(payload)));
CREATE TABLE compatibility (product_id TEXT NOT NULL REFERENCES products(id), target_type TEXT NOT NULL CHECK(target_type IN ('avatar','body')), target_id TEXT NOT NULL, payload TEXT NOT NULL CHECK(json_valid(payload)), PRIMARY KEY(product_id,target_type,target_id));
CREATE TABLE overrides (entity TEXT NOT NULL CHECK(entity IN ('product','avatar','compatibility')), entity_key TEXT NOT NULL, patch TEXT NOT NULL CHECK(json_valid(patch)), updated_at TEXT NOT NULL, PRIMARY KEY(entity,entity_key));
CREATE TABLE crawl_runs (id TEXT PRIMARY KEY, payload TEXT NOT NULL CHECK(json_valid(payload)));

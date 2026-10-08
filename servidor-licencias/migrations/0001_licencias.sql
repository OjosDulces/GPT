PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS licenses (
 id TEXT PRIMARY KEY,
 device_id TEXT NOT NULL UNIQUE,
 token_hash TEXT NOT NULL,
 trial_started_at INTEGER NOT NULL,
 trial_ends_at INTEGER NOT NULL CHECK(trial_ends_at=trial_started_at+1296000000),
 revoked INTEGER NOT NULL DEFAULT 0 CHECK(revoked IN (0,1))
);
CREATE TABLE IF NOT EXISTS orders (
 id TEXT PRIMARY KEY,
 license_id TEXT NOT NULL REFERENCES licenses(id),
 request_id TEXT NOT NULL,
 amount INTEGER NOT NULL CHECK(amount=9990),
 currency TEXT NOT NULL CHECK(currency='CLP'),
 duration_days INTEGER NOT NULL CHECK(duration_days=30),
 status TEXT NOT NULL DEFAULT 'created' CHECK(status IN ('created','pending','paid','expired','review','refunded')),
 preference_id TEXT,
 checkout_url TEXT,
 created_at INTEGER NOT NULL,
 expires_at INTEGER NOT NULL,
 UNIQUE(license_id, request_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS one_open_order ON orders(license_id) WHERE status IN ('created','pending','review');
CREATE TABLE IF NOT EXISTS payments (
 id TEXT PRIMARY KEY,
 order_id TEXT NOT NULL UNIQUE REFERENCES orders(id),
 license_id TEXT NOT NULL REFERENCES licenses(id),
 verified_at INTEGER NOT NULL,
 revoked_at INTEGER,
 starts_at INTEGER NOT NULL,
 ends_at INTEGER NOT NULL CHECK(ends_at=starts_at+2592000000)
);
CREATE INDEX IF NOT EXISTS entitlement_lookup ON payments(license_id, ends_at);
CREATE TABLE IF NOT EXISTS server_keys (id TEXT PRIMARY KEY, private_jwk TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS request_limits (id TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL);

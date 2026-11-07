BEGIN;
-- Schema fora de public: dados de login não são expostos pela Data API do Supabase.
CREATE SCHEMA IF NOT EXISTS violet_voltage;
REVOKE ALL ON SCHEMA violet_voltage FROM PUBLIC;

CREATE TABLE IF NOT EXISTS violet_voltage.products (
  partition_key text NOT NULL,
  row_key text PRIMARY KEY,
  data jsonb NOT NULL CHECK (jsonb_typeof(data) = 'object'),
  version text NOT NULL,
  CHECK (data->>'rowKey' = row_key AND data->>'partitionKey' = partition_key),
  CHECK ((data->>'estoque')::integer >= 0),
  CHECK ((data->>'priceCents')::bigint > 0)
);
CREATE TABLE IF NOT EXISTS violet_voltage.customers (
  partition_key text NOT NULL,
  row_key text PRIMARY KEY,
  data jsonb NOT NULL CHECK (jsonb_typeof(data) = 'object'),
  version text NOT NULL,
  CHECK (data->>'rowKey' = row_key AND data->>'partitionKey' = partition_key)
);
CREATE UNIQUE INDEX IF NOT EXISTS customers_public_id ON violet_voltage.customers ((data->>'id'));
CREATE TABLE IF NOT EXISTS violet_voltage.orders (
  partition_key text NOT NULL,
  row_key text PRIMARY KEY,
  data jsonb NOT NULL CHECK (jsonb_typeof(data) = 'object'),
  version text NOT NULL,
  CHECK (data->>'rowKey' = row_key AND data->>'partitionKey' = partition_key)
);
CREATE UNIQUE INDEX IF NOT EXISTS orders_request_id ON violet_voltage.orders (partition_key, (data->>'requestId'));
CREATE TABLE IF NOT EXISTS violet_voltage.images (
  name text PRIMARY KEY,
  content bytea NOT NULL CHECK (octet_length(content) <= 5242880),
  mime_type text NOT NULL CHECK (mime_type IN ('image/png','image/jpeg','image/webp'))
);
REVOKE ALL ON ALL TABLES IN SCHEMA violet_voltage FROM PUBLIC;
COMMIT;

BEGIN;
-- Etapa 31: várias instâncias subindo juntas esperam a vez (a trava some no COMMIT).
SELECT pg_advisory_xact_lock(hashtext('violet_voltage:migracao'));
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
-- Avisos de estoque ("Avise-me") e notificações da conta, particionados pelo cliente.
CREATE TABLE IF NOT EXISTS violet_voltage.alerts (
  partition_key text NOT NULL,
  row_key text PRIMARY KEY,
  data jsonb NOT NULL CHECK (jsonb_typeof(data) = 'object'),
  version text NOT NULL,
  CHECK (data->>'rowKey' = row_key AND data->>'partitionKey' = partition_key)
);
CREATE INDEX IF NOT EXISTS alerts_partition ON violet_voltage.alerts (partition_key);
CREATE TABLE IF NOT EXISTS violet_voltage.notifications (
  partition_key text NOT NULL,
  row_key text PRIMARY KEY,
  data jsonb NOT NULL CHECK (jsonb_typeof(data) = 'object'),
  version text NOT NULL,
  CHECK (data->>'rowKey' = row_key AND data->>'partitionKey' = partition_key)
);
CREATE INDEX IF NOT EXISTS notifications_partition ON violet_voltage.notifications (partition_key);
-- Perguntas e respostas dos produtos, particionadas pelo produto.
CREATE TABLE IF NOT EXISTS violet_voltage.questions (
  partition_key text NOT NULL,
  row_key text PRIMARY KEY,
  data jsonb NOT NULL CHECK (jsonb_typeof(data) = 'object'),
  version text NOT NULL,
  CHECK (data->>'rowKey' = row_key AND data->>'partitionKey' = partition_key)
);
CREATE INDEX IF NOT EXISTS questions_partition ON violet_voltage.questions (partition_key);
-- Frases que o assistente não entendeu, sem identificar o cliente (revisão no painel).
CREATE TABLE IF NOT EXISTS violet_voltage.assistant_log (
  partition_key text NOT NULL,
  row_key text PRIMARY KEY,
  data jsonb NOT NULL CHECK (jsonb_typeof(data) = 'object'),
  version text NOT NULL,
  CHECK (data->>'rowKey' = row_key AND data->>'partitionKey' = partition_key)
);
-- Etapa 33: encomendas (por cliente) e fichas de parceria de fornecedores.
CREATE TABLE IF NOT EXISTS violet_voltage.requests (
  partition_key text NOT NULL,
  row_key text PRIMARY KEY,
  data jsonb NOT NULL CHECK (jsonb_typeof(data) = 'object'),
  version text NOT NULL,
  CHECK (data->>'rowKey' = row_key AND data->>'partitionKey' = partition_key)
);
CREATE INDEX IF NOT EXISTS requests_partition ON violet_voltage.requests (partition_key);
CREATE TABLE IF NOT EXISTS violet_voltage.partners (
  partition_key text NOT NULL,
  row_key text PRIMARY KEY,
  data jsonb NOT NULL CHECK (jsonb_typeof(data) = 'object'),
  version text NOT NULL,
  CHECK (data->>'rowKey' = row_key AND data->>'partitionKey' = partition_key)
);
-- Etapa 34+: coupons.
CREATE TABLE IF NOT EXISTS violet_voltage.coupons (
  partition_key text NOT NULL,
  row_key text PRIMARY KEY,
  data jsonb NOT NULL CHECK (jsonb_typeof(data) = 'object'),
  version text NOT NULL,
  CHECK (data->>'rowKey' = row_key AND data->>'partitionKey' = partition_key)
);
-- Etapa 34+: carts.
CREATE TABLE IF NOT EXISTS violet_voltage.carts (
  partition_key text NOT NULL,
  row_key text PRIMARY KEY,
  data jsonb NOT NULL CHECK (jsonb_typeof(data) = 'object'),
  version text NOT NULL,
  CHECK (data->>'rowKey' = row_key AND data->>'partitionKey' = partition_key)
);
REVOKE ALL ON ALL TABLES IN SCHEMA violet_voltage FROM PUBLIC;
COMMIT;

-- Better Auth's database rate limiter updates rows by their id. The original
-- table used the bucket key as its primary key, which makes session lookups
-- fail at runtime with the relations-v2 adapter.
ALTER TABLE "rate_limit" ADD COLUMN IF NOT EXISTS "id" text;

-- Existing deployments may already contain buckets. A deterministic value
-- preserves those buckets while giving every row the required identifier.
UPDATE "rate_limit"
SET "id" = md5('rate-limit:' || "key")
WHERE "id" IS NULL;

ALTER TABLE "rate_limit" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE "rate_limit" DROP CONSTRAINT IF EXISTS "rate_limit_pkey";
ALTER TABLE "rate_limit" ADD CONSTRAINT "rate_limit_pkey" PRIMARY KEY ("id");
ALTER TABLE "rate_limit" ADD CONSTRAINT "rate_limit_key_unique" UNIQUE ("key");

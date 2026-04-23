


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."create_transaction"(
  "p_user_id" "uuid", 
  "p_type" "text", 
  "p_transaction_timestamp" timestamp with time zone, 
  "p_location" "text", 
  "p_merchant" "text", 
  "p_category" "text", 
  "p_payment_method" "text", 
  "p_subtotal" numeric, 
  "p_tax_amount" numeric, 
  "p_admin_fee" numeric, 
  "p_total_amount" numeric, 
  "p_financial_nature" "text", 
  "p_is_fixed_cost" boolean, 
  "p_items" "jsonb"
) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_transaction_id uuid;
  v_item jsonb;
BEGIN
  -- SECURITY GUARD: Verify user identity for requests originating from the Frontend (Authenticated Role).
  -- This prevents malicious actors from spoofing IDs and injecting data into other users' accounts via public APIs.
  -- The backend Telegram Bot (Service Role) will automatically bypass this check.
  IF auth.role() = 'authenticated' AND p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: ID mismatch detected.';
  END IF;

  -- A. Insert macro data into the main transactions table
  INSERT INTO public.transactions (
    user_id, type, transaction_timestamp, location, merchant, 
    category, payment_method, subtotal, tax_amount, admin_fee, 
    total_amount, financial_nature, is_fixed_cost
  ) VALUES (
    p_user_id, p_type, p_transaction_timestamp, p_location, p_merchant, 
    p_category, p_payment_method, p_subtotal, p_tax_amount, p_admin_fee, 
    p_total_amount, p_financial_nature, p_is_fixed_cost
  ) RETURNING id INTO v_transaction_id;

  -- B. Loop through the JSONB array to insert micro line items into transaction_items
  IF jsonb_array_length(p_items) > 0 THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
      INSERT INTO public.transaction_items (
        transaction_id, raw_name, standard_name, quantity, unit, 
        base_price, discount, final_price
      ) VALUES (
        v_transaction_id, 
        v_item->>'raw_name', 
        COALESCE(v_item->>'standard_name', v_item->>'raw_name'), 
        COALESCE((v_item->>'quantity')::numeric, 1), 
        COALESCE(v_item->>'unit', 'pcs'), 
        COALESCE((v_item->>'base_price')::numeric, 0), 
        COALESCE((v_item->>'discount')::numeric, 0), 
        COALESCE((v_item->>'final_price')::numeric, 0)
      );
    END LOOP;
  END IF;

  RETURN v_transaction_id;
END;
$$;


ALTER FUNCTION "public"."create_transaction"("p_user_id" "uuid", "p_type" "text", "p_transaction_timestamp" timestamp with time zone, "p_location" "text", "p_merchant" "text", "p_category" "text", "p_payment_method" "text", "p_subtotal" numeric, "p_tax_amount" numeric, "p_admin_fee" numeric, "p_total_amount" numeric, "p_financial_nature" "text", "p_is_fixed_cost" boolean, "p_items" "jsonb") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."budgets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "category" "text" NOT NULL,
    "amount" numeric NOT NULL,
    "period" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."budgets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "telegram_id" bigint,
    "full_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "role" "text" DEFAULT 'member'::"text"
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sinking_funds" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "goal_name" "text" NOT NULL,
    "target_amount" numeric NOT NULL,
    "target_date" "date" NOT NULL,
    "current_saved" numeric DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "user_id" "uuid" NOT NULL
);


ALTER TABLE "public"."sinking_funds" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."transaction_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "transaction_id" "uuid",
    "raw_name" "text" NOT NULL,
    "standard_name" "text" NOT NULL,
    "brand" "text",
    "quantity" numeric NOT NULL,
    "unit" "text" NOT NULL,
    "base_price" numeric NOT NULL,
    "discount" numeric DEFAULT 0,
    "final_price" numeric NOT NULL
);


ALTER TABLE "public"."transaction_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "type" "text" NOT NULL,
    "transaction_timestamp" timestamp with time zone NOT NULL,
    "location" "text",
    "merchant" "text" NOT NULL,
    "category" "text" NOT NULL,
    "payment_method" "text",
    "subtotal" numeric,
    "tax_amount" numeric DEFAULT 0,
    "admin_fee" numeric DEFAULT 0,
    "total_amount" numeric NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "deleted_at" timestamp with time zone,
    "user_id" "uuid" NOT NULL,
    "financial_nature" "text" DEFAULT 'need'::"text",
    "is_fixed_cost" boolean DEFAULT false,
    CONSTRAINT "transactions_financial_nature_check" CHECK (("financial_nature" = ANY (ARRAY['need'::"text", 'want'::"text", 'saving'::"text", 'capex'::"text"]))),
    CONSTRAINT "transactions_type_check" CHECK (("type" = ANY (ARRAY['income'::"text", 'expense'::"text"])))
);


ALTER TABLE "public"."transactions" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_budget_pacing_raw" WITH ("security_invoker"='true') AS
 SELECT "b"."category",
    "b"."amount" AS "budget_limit",
    "t"."total_amount",
    "t"."transaction_timestamp"
   FROM ("public"."budgets" "b"
     LEFT JOIN "public"."transactions" "t" ON ((("b"."category" = "t"."category") AND ("t"."type" = 'expense'::"text") AND ("t"."deleted_at" IS NULL))));


ALTER VIEW "public"."vw_budget_pacing_raw" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_burn_rate_predictor" WITH ("security_invoker"='true') AS
 WITH "current_month_vars" AS (
         SELECT COALESCE("sum"("transactions"."total_amount"), (0)::numeric) AS "spent_so_far",
            EXTRACT(day FROM CURRENT_DATE) AS "days_passed",
            EXTRACT(day FROM (("date_trunc"('month'::"text", (CURRENT_DATE)::timestamp with time zone) + '1 mon'::interval) - '1 day'::interval)) AS "total_days_in_month"
           FROM "public"."transactions"
          WHERE (("transactions"."type" = 'expense'::"text") AND ("transactions"."is_fixed_cost" = false) AND ("date_trunc"('month'::"text", "transactions"."transaction_timestamp") = "date_trunc"('month'::"text", (CURRENT_DATE)::timestamp with time zone)))
        )
 SELECT "spent_so_far",
    ("spent_so_far" / GREATEST("days_passed", (1)::numeric)) AS "daily_burn_rate",
    (("spent_so_far" / GREATEST("days_passed", (1)::numeric)) * "total_days_in_month") AS "projected_end_of_month_expense"
   FROM "current_month_vars";


ALTER VIEW "public"."vw_burn_rate_predictor" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_cfo_disposable_income" WITH ("security_invoker"='true') AS
 WITH "monthly_metrics" AS (
         SELECT "sum"(
                CASE
                    WHEN ("transactions"."type" = 'income'::"text") THEN "transactions"."total_amount"
                    ELSE (0)::numeric
                END) AS "gross_income",
            "sum"(
                CASE
                    WHEN (("transactions"."type" = 'expense'::"text") AND ("transactions"."is_fixed_cost" = true)) THEN "transactions"."total_amount"
                    ELSE (0)::numeric
                END) AS "total_fixed_costs"
           FROM "public"."transactions"
          WHERE ("date_trunc"('month'::"text", "transactions"."transaction_timestamp") = "date_trunc"('month'::"text", (CURRENT_DATE)::timestamp with time zone))
        ), "sinking_goal" AS (
         SELECT "sum"((("sinking_funds"."target_amount" - "sinking_funds"."current_saved") / GREATEST((1)::numeric, ((EXTRACT(year FROM "age"(("sinking_funds"."target_date")::timestamp with time zone, (CURRENT_DATE)::timestamp with time zone)) * (12)::numeric) + EXTRACT(month FROM "age"(("sinking_funds"."target_date")::timestamp with time zone, (CURRENT_DATE)::timestamp with time zone)))))) AS "monthly_target"
           FROM "public"."sinking_funds"
        )
 SELECT "gross_income",
    "total_fixed_costs",
    ( SELECT "sinking_goal"."monthly_target"
           FROM "sinking_goal") AS "mandatory_savings",
    (("gross_income" - "total_fixed_costs") - ( SELECT "sinking_goal"."monthly_target"
           FROM "sinking_goal")) AS "real_disposable_income"
   FROM "monthly_metrics";


ALTER VIEW "public"."vw_cfo_disposable_income" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_expense_by_category" WITH ("security_invoker"='true') AS
 SELECT "category",
    "sum"("total_amount") AS "total_amount"
   FROM "public"."transactions"
  WHERE (("type" = 'expense'::"text") AND ("deleted_at" IS NULL) AND ("date_trunc"('month'::"text", "transaction_timestamp") = "date_trunc"('month'::"text", "timezone"('utc'::"text", "now"()))))
  GROUP BY "category"
  ORDER BY ("sum"("total_amount")) DESC;


ALTER VIEW "public"."vw_expense_by_category" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_expense_by_category_raw" WITH ("security_invoker"='true') AS
 SELECT "category",
    "total_amount",
    "transaction_timestamp"
   FROM "public"."transactions"
  WHERE (("type" = 'expense'::"text") AND ("deleted_at" IS NULL));


ALTER VIEW "public"."vw_expense_by_category_raw" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_item_explorer" WITH ("security_invoker"='true') AS
 SELECT "ti"."id" AS "item_id",
    "t"."id" AS "transaction_id",
    "t"."transaction_timestamp",
    "t"."merchant",
    "t"."category",
    "ti"."raw_name",
    "ti"."standard_name",
    "ti"."quantity",
    "ti"."unit",
    "ti"."base_price",
    "ti"."discount",
    "ti"."final_price"
   FROM ("public"."transaction_items" "ti"
     JOIN "public"."transactions" "t" ON (("ti"."transaction_id" = "t"."id")))
  WHERE ("t"."deleted_at" IS NULL)
  ORDER BY "t"."transaction_timestamp" DESC;


ALTER VIEW "public"."vw_item_explorer" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_item_price_trends" WITH ("security_invoker"='true') AS
 SELECT ("t"."transaction_timestamp")::"date" AS "date",
    "ti"."standard_name",
    "ti"."unit",
    ("ti"."final_price" / NULLIF("ti"."quantity", (0)::numeric)) AS "unit_price"
   FROM ("public"."transaction_items" "ti"
     JOIN "public"."transactions" "t" ON (("ti"."transaction_id" = "t"."id")))
  WHERE ("t"."deleted_at" IS NULL)
  ORDER BY "t"."transaction_timestamp";


ALTER VIEW "public"."vw_item_price_trends" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_monthly_cashflow" WITH ("security_invoker"='true') AS
 SELECT ("date_trunc"('month'::"text", "transaction_timestamp"))::"date" AS "month",
    "sum"(
        CASE
            WHEN ("type" = 'income'::"text") THEN "total_amount"
            ELSE (0)::numeric
        END) AS "total_income",
    "sum"(
        CASE
            WHEN ("type" = 'expense'::"text") THEN "total_amount"
            ELSE (0)::numeric
        END) AS "total_expense",
    "sum"(
        CASE
            WHEN ("type" = 'income'::"text") THEN "total_amount"
            ELSE (- "total_amount")
        END) AS "net_surplus"
   FROM "public"."transactions"
  WHERE ("deleted_at" IS NULL)
  GROUP BY (("date_trunc"('month'::"text", "transaction_timestamp"))::"date")
  ORDER BY (("date_trunc"('month'::"text", "transaction_timestamp"))::"date") DESC;


ALTER VIEW "public"."vw_monthly_cashflow" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_price_anomalies" WITH ("security_invoker"='true') AS
 WITH "item_stats" AS (
         SELECT "transaction_items"."standard_name",
            "transaction_items"."unit",
            "avg"(("transaction_items"."base_price" / NULLIF("transaction_items"."quantity", (0)::numeric))) AS "avg_historical_price"
           FROM "public"."transaction_items"
          GROUP BY "transaction_items"."standard_name", "transaction_items"."unit"
        ), "latest_prices" AS (
         SELECT DISTINCT ON ("ti"."standard_name") "ti"."standard_name",
            "t"."transaction_timestamp" AS "latest_date",
            "t"."merchant" AS "latest_merchant",
            ("ti"."base_price" / NULLIF("ti"."quantity", (0)::numeric)) AS "latest_unit_price"
           FROM ("public"."transaction_items" "ti"
             JOIN "public"."transactions" "t" ON (("ti"."transaction_id" = "t"."id")))
          WHERE ("t"."deleted_at" IS NULL)
          ORDER BY "ti"."standard_name", "t"."transaction_timestamp" DESC
        )
 SELECT "lp"."standard_name",
    "lp"."latest_merchant",
    "lp"."latest_date",
    "s"."avg_historical_price",
    "lp"."latest_unit_price",
    ((("lp"."latest_unit_price" - "s"."avg_historical_price") / NULLIF("s"."avg_historical_price", (0)::numeric)) * (100)::numeric) AS "inflation_pct"
   FROM ("latest_prices" "lp"
     JOIN "item_stats" "s" ON (("lp"."standard_name" = "s"."standard_name")));


ALTER VIEW "public"."vw_price_anomalies" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_top_merchants" WITH ("security_invoker"='true') AS
 SELECT "merchant",
    "payment_method",
    "sum"("total_amount") AS "total_amount"
   FROM "public"."transactions"
  WHERE (("type" = 'expense'::"text") AND ("deleted_at" IS NULL) AND ("date_trunc"('month'::"text", "transaction_timestamp") = "date_trunc"('month'::"text", "timezone"('utc'::"text", "now"()))))
  GROUP BY "merchant", "payment_method"
  ORDER BY ("sum"("total_amount")) DESC
 LIMIT 10;


ALTER VIEW "public"."vw_top_merchants" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_top_merchants_raw" WITH ("security_invoker"='true') AS
 SELECT "merchant",
    "payment_method",
    "total_amount",
    "transaction_timestamp"
   FROM "public"."transactions"
  WHERE (("type" = 'expense'::"text") AND ("deleted_at" IS NULL));


ALTER VIEW "public"."vw_top_merchants_raw" OWNER TO "postgres";


ALTER TABLE ONLY "public"."budgets"
    ADD CONSTRAINT "budgets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."budgets"
    ADD CONSTRAINT "budgets_user_id_category_period_key" UNIQUE ("user_id", "category", "period");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_telegram_id_key" UNIQUE ("telegram_id");



ALTER TABLE ONLY "public"."sinking_funds"
    ADD CONSTRAINT "sinking_funds_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transaction_items"
    ADD CONSTRAINT "transaction_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_category_trgm" ON "public"."transactions" USING "gin" ("category" "public"."gin_trgm_ops");



CREATE INDEX "idx_merchant_trgm" ON "public"."transactions" USING "gin" ("merchant" "public"."gin_trgm_ops");



ALTER TABLE ONLY "public"."budgets"
    ADD CONSTRAINT "budgets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "fk_user" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sinking_funds"
    ADD CONSTRAINT "sinking_funds_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."transaction_items"
    ADD CONSTRAINT "transaction_items_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE CASCADE;



CREATE POLICY "Users can only see their own budgets" ON "public"."budgets" TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can only see their own items" ON "public"."transaction_items" TO "authenticated" USING (("transaction_id" IN ( SELECT "transactions"."id"
   FROM "public"."transactions"
  WHERE ("transactions"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can only see their own profile" ON "public"."profiles" TO "authenticated" USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can only see their own sinking funds" ON "public"."sinking_funds" TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can only see their own transactions" ON "public"."transactions" TO "authenticated" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."budgets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sinking_funds" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."transaction_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."transactions" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."create_transaction"("p_user_id" "uuid", "p_type" "text", "p_transaction_timestamp" timestamp with time zone, "p_location" "text", "p_merchant" "text", "p_category" "text", "p_payment_method" "text", "p_subtotal" numeric, "p_tax_amount" numeric, "p_admin_fee" numeric, "p_total_amount" numeric, "p_financial_nature" "text", "p_is_fixed_cost" boolean, "p_items" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_transaction"("p_user_id" "uuid", "p_type" "text", "p_transaction_timestamp" timestamp with time zone, "p_location" "text", "p_merchant" "text", "p_category" "text", "p_payment_method" "text", "p_subtotal" numeric, "p_tax_amount" numeric, "p_admin_fee" numeric, "p_total_amount" numeric, "p_financial_nature" "text", "p_is_fixed_cost" boolean, "p_items" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_transaction"("p_user_id" "uuid", "p_type" "text", "p_transaction_timestamp" timestamp with time zone, "p_location" "text", "p_merchant" "text", "p_category" "text", "p_payment_method" "text", "p_subtotal" numeric, "p_tax_amount" numeric, "p_admin_fee" numeric, "p_total_amount" numeric, "p_financial_nature" "text", "p_is_fixed_cost" boolean, "p_items" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "postgres";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "anon";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "service_role";



GRANT ALL ON FUNCTION "public"."show_limit"() TO "postgres";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "service_role";


















GRANT ALL ON TABLE "public"."budgets" TO "anon";
GRANT ALL ON TABLE "public"."budgets" TO "authenticated";
GRANT ALL ON TABLE "public"."budgets" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."sinking_funds" TO "anon";
GRANT ALL ON TABLE "public"."sinking_funds" TO "authenticated";
GRANT ALL ON TABLE "public"."sinking_funds" TO "service_role";



GRANT ALL ON TABLE "public"."transaction_items" TO "anon";
GRANT ALL ON TABLE "public"."transaction_items" TO "authenticated";
GRANT ALL ON TABLE "public"."transaction_items" TO "service_role";



GRANT ALL ON TABLE "public"."transactions" TO "anon";
GRANT ALL ON TABLE "public"."transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."transactions" TO "service_role";



GRANT ALL ON TABLE "public"."vw_budget_pacing_raw" TO "anon";
GRANT ALL ON TABLE "public"."vw_budget_pacing_raw" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_budget_pacing_raw" TO "service_role";



GRANT ALL ON TABLE "public"."vw_burn_rate_predictor" TO "anon";
GRANT ALL ON TABLE "public"."vw_burn_rate_predictor" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_burn_rate_predictor" TO "service_role";



GRANT ALL ON TABLE "public"."vw_cfo_disposable_income" TO "anon";
GRANT ALL ON TABLE "public"."vw_cfo_disposable_income" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_cfo_disposable_income" TO "service_role";



GRANT ALL ON TABLE "public"."vw_expense_by_category" TO "anon";
GRANT ALL ON TABLE "public"."vw_expense_by_category" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_expense_by_category" TO "service_role";



GRANT ALL ON TABLE "public"."vw_expense_by_category_raw" TO "anon";
GRANT ALL ON TABLE "public"."vw_expense_by_category_raw" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_expense_by_category_raw" TO "service_role";



GRANT ALL ON TABLE "public"."vw_item_explorer" TO "anon";
GRANT ALL ON TABLE "public"."vw_item_explorer" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_item_explorer" TO "service_role";



GRANT ALL ON TABLE "public"."vw_item_price_trends" TO "anon";
GRANT ALL ON TABLE "public"."vw_item_price_trends" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_item_price_trends" TO "service_role";



GRANT ALL ON TABLE "public"."vw_monthly_cashflow" TO "anon";
GRANT ALL ON TABLE "public"."vw_monthly_cashflow" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_monthly_cashflow" TO "service_role";



GRANT ALL ON TABLE "public"."vw_price_anomalies" TO "anon";
GRANT ALL ON TABLE "public"."vw_price_anomalies" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_price_anomalies" TO "service_role";



GRANT ALL ON TABLE "public"."vw_top_merchants" TO "anon";
GRANT ALL ON TABLE "public"."vw_top_merchants" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_top_merchants" TO "service_role";



GRANT ALL ON TABLE "public"."vw_top_merchants_raw" TO "anon";
GRANT ALL ON TABLE "public"."vw_top_merchants_raw" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_top_merchants_raw" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































drop extension if exists "pg_net";



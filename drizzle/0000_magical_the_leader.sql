CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS "ai-app-template_account" (
	"user_id" varchar(255) NOT NULL,
	"type" varchar(255) NOT NULL,
	"provider" varchar(255) NOT NULL,
	"provider_account_id" varchar(255) NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" varchar(255),
	"scope" varchar(255),
	"id_token" text,
	"session_state" varchar(255),
	CONSTRAINT "ai-app-template_account_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai-app-template_chat" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"title" varchar(255) NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai-app-template_message" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"order" serial NOT NULL,
	"chat_id" varchar(255) NOT NULL,
	"content" json NOT NULL,
	"parts" json,
	"role" varchar(50) NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai-app-template_request" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"prompt_tokens" integer NOT NULL,
	"completion_tokens" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai-app-template_session" (
	"session_token" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"expires" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai-app-template_user" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"name" varchar(255),
	"email" varchar(255) NOT NULL,
	"email_verified" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
	"image" varchar(255),
	"is_admin" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai-app-template_verification_token" (
	"identifier" varchar(255) NOT NULL,
	"token" varchar(255) NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	CONSTRAINT "ai-app-template_verification_token_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai-app-template_account" ADD CONSTRAINT "ai-app-template_account_user_id_ai-app-template_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."ai-app-template_user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai-app-template_chat" ADD CONSTRAINT "ai-app-template_chat_user_id_ai-app-template_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."ai-app-template_user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai-app-template_message" ADD CONSTRAINT "ai-app-template_message_chat_id_ai-app-template_chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."ai-app-template_chat"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai-app-template_request" ADD CONSTRAINT "ai-app-template_request_user_id_ai-app-template_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."ai-app-template_user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai-app-template_session" ADD CONSTRAINT "ai-app-template_session_user_id_ai-app-template_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."ai-app-template_user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "account_user_id_idx" ON "ai-app-template_account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_user_id_idx" ON "ai-app-template_chat" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "message_chat_id_idx" ON "ai-app-template_message" USING btree ("chat_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "request_user_id_idx" ON "ai-app-template_request" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "request_user_time_idx" ON "ai-app-template_request" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "session_user_id_idx" ON "ai-app-template_session" USING btree ("user_id");
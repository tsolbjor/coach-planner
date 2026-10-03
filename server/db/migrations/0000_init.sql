CREATE TABLE "plan_invites" (
	"id" text PRIMARY KEY NOT NULL,
	"plan_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"role" text NOT NULL,
	"email" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"max_uses" integer,
	"uses" integer DEFAULT 0 NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "plan_invites_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "plan_invites_role_check" CHECK ("plan_invites"."role" in ('editor', 'viewer'))
);
--> statement-breakpoint
CREATE TABLE "plan_members" (
	"plan_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plan_members_plan_id_user_id_pk" PRIMARY KEY("plan_id","user_id"),
	CONSTRAINT "plan_members_role_check" CHECK ("plan_members"."role" in ('editor', 'viewer'))
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"data" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "plans_kind_check" CHECK ("plans"."kind" in ('match', 'tournament'))
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text,
	"name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "plan_invites" ADD CONSTRAINT "plan_invites_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_invites" ADD CONSTRAINT "plan_invites_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_members" ADD CONSTRAINT "plan_members_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_members" ADD CONSTRAINT "plan_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "plan_invites_plan_idx" ON "plan_invites" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "plan_members_user_idx" ON "plan_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "plans_owner_idx" ON "plans" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "plans_updated_idx" ON "plans" USING btree ("updated_at");
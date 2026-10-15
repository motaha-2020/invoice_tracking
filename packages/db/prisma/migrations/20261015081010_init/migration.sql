-- CreateEnum
CREATE TYPE "ao_status" AS ENUM ('pending_approval', 'active', 'closed');

-- CreateEnum
CREATE TYPE "ao_change_kind" AS ENUM ('increase', 'commitment_renewal');

-- CreateEnum
CREATE TYPE "role" AS ENUM ('admin', 'pmo', 'company', 'supervisor', 'exec_mgr', 'gm', 'tech_affairs', 'tech_office', 'planning', 'sector_head', 'presidency_head', 'committee', 'stores', 'finance');

-- CreateEnum
CREATE TYPE "doc_stage" AS ENUM ('submit', 'finance');

-- CreateEnum
CREATE TYPE "invoice_status" AS ENUM ('draft', 'active', 'returned', 'on_hold', 'paid');

-- CreateEnum
CREATE TYPE "invoice_kind" AS ENUM ('civil', 'electrical', 'combined', 'planning');

-- CreateEnum
CREATE TYPE "deduction_type" AS ENUM ('asbuilt', 'handover', 'tax', 'penalty', 'other');

-- CreateEnum
CREATE TYPE "step_action" AS ENUM ('submit', 'approve', 'return', 'resubmit', 'category', 'qty', 'hold', 'release', 'pay', 'deductions');

-- CreateEnum
CREATE TYPE "scope_type" AS ENUM ('all', 'company', 'presidency', 'sector', 'general_dept', 'dept', 'central');

-- CreateEnum
CREATE TYPE "email_status" AS ENUM ('pending', 'sent', 'failed');

-- CreateTable
CREATE TABLE "presidencies" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "presidencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sectors" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "presidency_id" TEXT NOT NULL,

    CONSTRAINT "sectors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tech_units" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sector_id" TEXT NOT NULL,

    CONSTRAINT "tech_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "general_depts" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sector_id" TEXT NOT NULL,

    CONSTRAINT "general_depts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "depts" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "general_dept_id" TEXT NOT NULL,

    CONSTRAINT "depts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "centrals" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dept_id" TEXT NOT NULL,

    CONSTRAINT "centrals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_types" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "project_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type_id" TEXT NOT NULL,
    "central_id" TEXT NOT NULL,
    "start_date" DATE,
    "notes" TEXT,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "commercial_reg" TEXT,
    "tax_no" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contracts" (
    "id" TEXT NOT NULL,
    "contract_no" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "award_date" DATE,
    "start_date" DATE,
    "end_date" DATE,
    "currency" TEXT NOT NULL DEFAULT 'EGP',
    "contract_value" DECIMAL(18,2),
    "vat_pct" DECIMAL(5,2) NOT NULL DEFAULT 14,
    "pay_monthly_pct" DECIMAL(5,2) NOT NULL DEFAULT 70,
    "pay_asbuilt_pct" DECIMAL(5,2) NOT NULL DEFAULT 20,
    "pay_handover_pct" DECIMAL(5,2) NOT NULL DEFAULT 10,
    "planning_pay_pct" DECIMAL(5,2) NOT NULL DEFAULT 100,
    "final_guarantee_pct" DECIMAL(5,2) NOT NULL DEFAULT 5,
    "delay_fine_pct_week" DECIMAL(5,2),
    "delay_fine_cap_pct" DECIMAL(5,2),
    "warranty_months" INTEGER,
    "out_of_scope_uplift" TEXT,
    "stamp_engineering_pct" DECIMAL(6,3) NOT NULL DEFAULT 0.3,
    "stamp_applied_arts_pct" DECIMAL(6,3) NOT NULL DEFAULT 0.3,
    "stamp_construction_pct" DECIMAL(6,3) NOT NULL DEFAULT 0.05,
    "tax_pct" DECIMAL(5,2),
    "retention_pct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "advance_pct" DECIMAL(5,2) NOT NULL DEFAULT 0,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_items" (
    "id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "item_no" TEXT NOT NULL,
    "parent_no" TEXT,
    "is_group" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT NOT NULL,
    "unit" TEXT,
    "contract_qty" DECIMAL(18,4),
    "unit_price" DECIMAL(18,2),
    "work_type" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "contract_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignment_orders" (
    "id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "ao_no" TEXT NOT NULL,
    "ao_date" DATE,
    "name" TEXT NOT NULL,
    "project_id" TEXT,
    "status" "ao_status" NOT NULL DEFAULT 'active',
    "value" DECIMAL(18,2),
    "financial_commitment" DECIMAL(18,2),
    "planning_annex_value" DECIMAL(18,2),
    "area" TEXT,
    "central_text" TEXT,
    "out_of_scope" BOOLEAN NOT NULL DEFAULT false,
    "duration" TEXT,
    "final_guarantee_pct" DECIMAL(5,2),
    "stamps_total" DECIMAL(18,2),
    "source_note" TEXT,

    CONSTRAINT "assignment_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ao_changes" (
    "id" TEXT NOT NULL,
    "ao_id" TEXT NOT NULL,
    "kind" "ao_change_kind" NOT NULL,
    "change_date" DATE,
    "base_value" DECIMAL(18,2),
    "increase" DECIMAL(18,2),
    "new_total" DECIMAL(18,2),
    "reference" TEXT,
    "note" TEXT,

    CONSTRAINT "ao_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ao_sites" (
    "id" TEXT NOT NULL,
    "ao_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT,

    CONSTRAINT "ao_sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ao_items" (
    "id" TEXT NOT NULL,
    "ao_id" TEXT NOT NULL,
    "contract_item_id" TEXT NOT NULL,
    "site_id" TEXT,
    "planned_qty" DECIMAL(18,4) NOT NULL,

    CONSTRAINT "ao_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "materials" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "supplied_by" TEXT,
    "group_name" TEXT,

    CONSTRAINT "materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ao_materials" (
    "id" TEXT NOT NULL,
    "ao_id" TEXT NOT NULL,
    "material_id" TEXT NOT NULL,
    "planned_qty" DECIMAL(18,4) NOT NULL,

    CONSTRAINT "ao_materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_issues" (
    "id" TEXT NOT NULL,
    "ao_id" TEXT NOT NULL,
    "material_id" TEXT NOT NULL,
    "qty" DECIMAL(18,4) NOT NULL,
    "returned_qty" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "issue_date" DATE NOT NULL,
    "issue_ref" TEXT NOT NULL,

    CONSTRAINT "material_issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_steps" (
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "short" TEXT NOT NULL,
    "role" "role" NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "workflow_steps_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "categories" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "category_steps" (
    "category_code" TEXT NOT NULL,
    "step_key" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "sla_days" INTEGER,

    CONSTRAINT "category_steps_pkey" PRIMARY KEY ("category_code","step_key")
);

-- CreateTable
CREATE TABLE "doc_types" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "doc_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "required_docs" (
    "project_type_id" TEXT NOT NULL,
    "doc_type_id" TEXT NOT NULL,
    "stage" "doc_stage" NOT NULL DEFAULT 'submit',

    CONSTRAINT "required_docs_pkey" PRIMARY KEY ("project_type_id","doc_type_id","stage")
);

-- CreateTable
CREATE TABLE "return_reasons" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "return_reasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holidays" (
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "holidays_pkey" PRIMARY KEY ("date")
);

-- CreateTable
CREATE TABLE "settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "ao_id" TEXT NOT NULL,
    "invoice_no" TEXT NOT NULL,
    "seq" INTEGER NOT NULL DEFAULT 1,
    "period" TEXT,
    "kind" "invoice_kind" NOT NULL DEFAULT 'civil',
    "path_name" TEXT NOT NULL,
    "status" "invoice_status" NOT NULL DEFAULT 'draft',
    "current_step" TEXT,
    "since" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "category" TEXT,
    "suggested_category" TEXT,
    "return_to" TEXT,
    "returned_from" TEXT,
    "held_at" TEXT,
    "hold_reason" TEXT,
    "submitted_at" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "payment_ref" TEXT,
    "payment_method" TEXT,
    "payment_amount" DECIMAL(18,2),
    "migrated" BOOLEAN NOT NULL DEFAULT false,
    "migrated_amount" DECIMAL(18,2),
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_revisions" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "n" INTEGER NOT NULL,
    "note" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_lines" (
    "id" TEXT NOT NULL,
    "revision_id" TEXT NOT NULL,
    "contract_item_id" TEXT,
    "new_item_no" TEXT,
    "new_description" TEXT,
    "new_unit" TEXT,
    "agreed_price" DECIMAL(18,2),
    "site_id" TEXT,
    "qty" DECIMAL(18,4) NOT NULL,
    "approved_qty" DECIMAL(18,4),
    "approve_note" TEXT,
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "invoice_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_materials" (
    "id" TEXT NOT NULL,
    "revision_id" TEXT NOT NULL,
    "material_id" TEXT NOT NULL,
    "executed_qty" DECIMAL(18,4) NOT NULL,
    "billed_qty" DECIMAL(18,4),

    CONSTRAINT "invoice_materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL,
    "revision_id" TEXT NOT NULL,
    "doc_type_id" TEXT,
    "file_name" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "uploaded_by_id" TEXT,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_deductions" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "type" "deduction_type" NOT NULL,
    "name" TEXT NOT NULL,
    "pct" DECIMAL(6,3),
    "amount" DECIMAL(18,2),
    "releasable" BOOLEAN NOT NULL DEFAULT false,
    "released_at" TIMESTAMP(3),
    "release_ref" TEXT,

    CONSTRAINT "invoice_deductions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "step_log" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "action" "step_action" NOT NULL,
    "from_step" TEXT,
    "to_step" TEXT,
    "category" TEXT,
    "note" TEXT,
    "on_behalf" BOOLEAN NOT NULL DEFAULT false,
    "by_id" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "step_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "step_log_reasons" (
    "log_id" TEXT NOT NULL,
    "reason_id" TEXT NOT NULL,

    CONSTRAINT "step_log_reasons_pkey" PRIMARY KEY ("log_id","reason_id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "password_hash" TEXT,
    "totp_secret" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "role" NOT NULL,
    "scope_type" "scope_type" NOT NULL,
    "scope_id" TEXT,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role" "role" NOT NULL,
    "permission" TEXT NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role","permission")
);

-- CreateTable
CREATE TABLE "delegations" (
    "id" TEXT NOT NULL,
    "from_user_id" TEXT NOT NULL,
    "to_user_id" TEXT NOT NULL,
    "starts_on" DATE NOT NULL,
    "ends_on" DATE NOT NULL,
    "note" TEXT,

    CONSTRAINT "delegations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,
    "user_agent" TEXT,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invite_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'invite',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),

    CONSTRAINT "invite_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "invoice_id" TEXT,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_outbox" (
    "id" TEXT NOT NULL,
    "to_email" TEXT NOT NULL,
    "to_name" TEXT,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "invoice_id" TEXT,
    "status" "email_status" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMP(3),

    CONSTRAINT "email_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT,
    "details" JSONB,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_batches" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "user_id" TEXT,
    "rows" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "report" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "presidencies_code_key" ON "presidencies"("code");

-- CreateIndex
CREATE UNIQUE INDEX "sectors_code_key" ON "sectors"("code");

-- CreateIndex
CREATE INDEX "sectors_presidency_id_idx" ON "sectors"("presidency_id");

-- CreateIndex
CREATE UNIQUE INDEX "tech_units_code_key" ON "tech_units"("code");

-- CreateIndex
CREATE UNIQUE INDEX "general_depts_code_key" ON "general_depts"("code");

-- CreateIndex
CREATE INDEX "general_depts_sector_id_idx" ON "general_depts"("sector_id");

-- CreateIndex
CREATE UNIQUE INDEX "depts_code_key" ON "depts"("code");

-- CreateIndex
CREATE INDEX "depts_general_dept_id_idx" ON "depts"("general_dept_id");

-- CreateIndex
CREATE UNIQUE INDEX "centrals_code_key" ON "centrals"("code");

-- CreateIndex
CREATE INDEX "centrals_dept_id_idx" ON "centrals"("dept_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_types_code_key" ON "project_types"("code");

-- CreateIndex
CREATE UNIQUE INDEX "projects_code_key" ON "projects"("code");

-- CreateIndex
CREATE INDEX "projects_central_id_idx" ON "projects"("central_id");

-- CreateIndex
CREATE UNIQUE INDEX "companies_code_key" ON "companies"("code");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_contract_no_key" ON "contracts"("contract_no");

-- CreateIndex
CREATE INDEX "contracts_company_id_idx" ON "contracts"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "contract_items_contract_id_item_no_key" ON "contract_items"("contract_id", "item_no");

-- CreateIndex
CREATE INDEX "assignment_orders_project_id_idx" ON "assignment_orders"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "assignment_orders_contract_id_ao_no_key" ON "assignment_orders"("contract_id", "ao_no");

-- CreateIndex
CREATE INDEX "ao_changes_ao_id_idx" ON "ao_changes"("ao_id");

-- CreateIndex
CREATE UNIQUE INDEX "ao_sites_ao_id_code_key" ON "ao_sites"("ao_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "ao_items_ao_id_contract_item_id_site_id_key" ON "ao_items"("ao_id", "contract_item_id", "site_id");

-- CreateIndex
CREATE UNIQUE INDEX "materials_code_key" ON "materials"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ao_materials_ao_id_material_id_key" ON "ao_materials"("ao_id", "material_id");

-- CreateIndex
CREATE INDEX "material_issues_ao_id_material_id_idx" ON "material_issues"("ao_id", "material_id");

-- CreateIndex
CREATE UNIQUE INDEX "category_steps_category_code_seq_key" ON "category_steps"("category_code", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "doc_types_code_key" ON "doc_types"("code");

-- CreateIndex
CREATE INDEX "invoices_status_current_step_idx" ON "invoices"("status", "current_step");

-- CreateIndex
CREATE INDEX "invoices_ao_id_idx" ON "invoices"("ao_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_contract_id_invoice_no_key" ON "invoices"("contract_id", "invoice_no");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_revisions_invoice_id_n_key" ON "invoice_revisions"("invoice_id", "n");

-- CreateIndex
CREATE INDEX "invoice_lines_revision_id_idx" ON "invoice_lines"("revision_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_materials_revision_id_material_id_key" ON "invoice_materials"("revision_id", "material_id");

-- CreateIndex
CREATE INDEX "attachments_revision_id_idx" ON "attachments"("revision_id");

-- CreateIndex
CREATE INDEX "invoice_deductions_invoice_id_idx" ON "invoice_deductions"("invoice_id");

-- CreateIndex
CREATE INDEX "step_log_invoice_id_at_idx" ON "step_log"("invoice_id", "at");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "user_roles_role_scope_type_scope_id_idx" ON "user_roles"("role", "scope_type", "scope_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_user_id_role_scope_type_scope_id_key" ON "user_roles"("user_id", "role", "scope_type", "scope_id");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "invite_tokens_user_id_idx" ON "invite_tokens"("user_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_idx" ON "notifications"("user_id", "read_at");

-- CreateIndex
CREATE INDEX "email_outbox_status_created_at_idx" ON "email_outbox"("status", "created_at");

-- CreateIndex
CREATE INDEX "audit_log_entity_entity_id_idx" ON "audit_log"("entity", "entity_id");

-- CreateIndex
CREATE INDEX "audit_log_at_idx" ON "audit_log"("at");

-- AddForeignKey
ALTER TABLE "sectors" ADD CONSTRAINT "sectors_presidency_id_fkey" FOREIGN KEY ("presidency_id") REFERENCES "presidencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tech_units" ADD CONSTRAINT "tech_units_sector_id_fkey" FOREIGN KEY ("sector_id") REFERENCES "sectors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "general_depts" ADD CONSTRAINT "general_depts_sector_id_fkey" FOREIGN KEY ("sector_id") REFERENCES "sectors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "depts" ADD CONSTRAINT "depts_general_dept_id_fkey" FOREIGN KEY ("general_dept_id") REFERENCES "general_depts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "centrals" ADD CONSTRAINT "centrals_dept_id_fkey" FOREIGN KEY ("dept_id") REFERENCES "depts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "project_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_central_id_fkey" FOREIGN KEY ("central_id") REFERENCES "centrals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_items" ADD CONSTRAINT "contract_items_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_orders" ADD CONSTRAINT "assignment_orders_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_orders" ADD CONSTRAINT "assignment_orders_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ao_changes" ADD CONSTRAINT "ao_changes_ao_id_fkey" FOREIGN KEY ("ao_id") REFERENCES "assignment_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ao_sites" ADD CONSTRAINT "ao_sites_ao_id_fkey" FOREIGN KEY ("ao_id") REFERENCES "assignment_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ao_items" ADD CONSTRAINT "ao_items_ao_id_fkey" FOREIGN KEY ("ao_id") REFERENCES "assignment_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ao_items" ADD CONSTRAINT "ao_items_contract_item_id_fkey" FOREIGN KEY ("contract_item_id") REFERENCES "contract_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ao_items" ADD CONSTRAINT "ao_items_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "ao_sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ao_materials" ADD CONSTRAINT "ao_materials_ao_id_fkey" FOREIGN KEY ("ao_id") REFERENCES "assignment_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ao_materials" ADD CONSTRAINT "ao_materials_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_issues" ADD CONSTRAINT "material_issues_ao_id_fkey" FOREIGN KEY ("ao_id") REFERENCES "assignment_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_issues" ADD CONSTRAINT "material_issues_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_steps" ADD CONSTRAINT "category_steps_category_code_fkey" FOREIGN KEY ("category_code") REFERENCES "categories"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_steps" ADD CONSTRAINT "category_steps_step_key_fkey" FOREIGN KEY ("step_key") REFERENCES "workflow_steps"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "required_docs" ADD CONSTRAINT "required_docs_project_type_id_fkey" FOREIGN KEY ("project_type_id") REFERENCES "project_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "required_docs" ADD CONSTRAINT "required_docs_doc_type_id_fkey" FOREIGN KEY ("doc_type_id") REFERENCES "doc_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_ao_id_fkey" FOREIGN KEY ("ao_id") REFERENCES "assignment_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_revisions" ADD CONSTRAINT "invoice_revisions_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_revision_id_fkey" FOREIGN KEY ("revision_id") REFERENCES "invoice_revisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_contract_item_id_fkey" FOREIGN KEY ("contract_item_id") REFERENCES "contract_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "ao_sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_materials" ADD CONSTRAINT "invoice_materials_revision_id_fkey" FOREIGN KEY ("revision_id") REFERENCES "invoice_revisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_materials" ADD CONSTRAINT "invoice_materials_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_revision_id_fkey" FOREIGN KEY ("revision_id") REFERENCES "invoice_revisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_doc_type_id_fkey" FOREIGN KEY ("doc_type_id") REFERENCES "doc_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_deductions" ADD CONSTRAINT "invoice_deductions_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "step_log" ADD CONSTRAINT "step_log_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "step_log" ADD CONSTRAINT "step_log_by_id_fkey" FOREIGN KEY ("by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "step_log_reasons" ADD CONSTRAINT "step_log_reasons_log_id_fkey" FOREIGN KEY ("log_id") REFERENCES "step_log"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "step_log_reasons" ADD CONSTRAINT "step_log_reasons_reason_id_fkey" FOREIGN KEY ("reason_id") REFERENCES "return_reasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delegations" ADD CONSTRAINT "delegations_from_user_id_fkey" FOREIGN KEY ("from_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delegations" ADD CONSTRAINT "delegations_to_user_id_fkey" FOREIGN KEY ("to_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invite_tokens" ADD CONSTRAINT "invite_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_outbox" ADD CONSTRAINT "email_outbox_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

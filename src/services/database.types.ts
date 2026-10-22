export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
type Table<Row extends Record<string, unknown>> = { Row: Row; Insert: Partial<Row>; Update: Partial<Row>; Relationships: [] };
type OwnerId = { user_id: string; id: string };

export interface Database {
  public: {
    Tables: {
      categories: Table<OwnerId & { name: string; type: 'income' | 'expense' | 'both' }>;
      counterparties: Table<OwnerId & { name: string; kind: 'customer' | 'supplier' | 'other' }>;
      transactions: Table<OwnerId & { type: 'income' | 'expense'; amount: number; currency: 'MMK'; date: string; due_date: string | null; occurred_at: string | null; opening_day_disposition: 'already_in_opening' | 'after_reference' | null; category_id: string | null; description: string | null; reference: string | null; counterparty_id: string | null; cash_status: 'settled' | 'pending'; confirmation_status: 'not_applicable' | 'unconfirmed' | 'confirmed'; source: 'manual' | 'receipt_image' | 'screenshot' | 'recurring'; ocr_review_status: 'not_applicable' | 'pending_review' | 'reviewed'; payment_occurrence_id: string | null; created_at: string; updated_at: string }>;
      receivables: Table<OwnerId & { amount: number; currency: 'MMK'; date: string; counterparty: string; description: string | null; category_id: string | null; status: 'unpaid' | 'paid'; settled_at: string | null; linked_income_transaction_id: string | null; created_at: string; updated_at: string }>;
      balance_adjustments: Table<OwnerId & { amount: number; currency: 'MMK'; date: string; occurred_at: string; description: string; created_at: string }>;
      scheduled_rules: Table<OwnerId & { type: 'income' | 'expense'; amount: number; category_id: string | null; description: string | null; counterparty_id: string | null; schedule: Json; active: boolean; created_at: string; updated_at: string }>;
      payment_occurrences: Table<OwnerId & { rule_id: string; original_due_date: string; status: string; payment_transaction_id: string | null; payment_date: string | null; payment_amount: number | null; history: Json }>;
      duplicate_reviews: Table<OwnerId & { first_transaction_id: string; second_transaction_id: string; fingerprint: string; resolution: 'keep_both' | 'duplicate_removed'; redundant_transaction_id: string | null; reviewed_at: string }>;
      readiness_documents: Table<{ user_id: string; document_key: string; available: boolean }>;
      workspace_settings: Table<{ user_id: string; time_zone: string; opening_balance: Json | null; updated_at: string }>;
      workspace_imports: Table<{ user_id: string; source_email: string; status: 'imported' | 'skipped'; record_counts: Json; completed_at: string }>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

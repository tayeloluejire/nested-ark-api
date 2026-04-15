export interface EscrowWallet {
  id: string;
  project_id: string;
  user_id: string;
  balance: number;
  held_amount: number;
  status: string;
  created_at: Date;
  updated_at: Date;
}

export interface EscrowTransaction {
  id: string;
  wallet_id: string;
  transaction_type: string;
  amount: number;
  status: string;
  description: string;
  reference_id?: string;
  created_at: Date;
}

export interface PaymentHold {
  id: string;
  transaction_id: string;
  wallet_id: string;
  amount: number;
  reason: string;
  status: string;
  expires_at: Date;
  created_at: Date;
}

export interface EscrowDeposit {
  project_id: string;
  amount: number;
  description?: string;
  payment_method?: string;
}

export interface PaymentRelease {
  transaction_id: string;
  milestone_id: string;
  amount: number;
  description?: string;
}

export interface EscrowBalance {
  wallet_id: string;
  available: number;
  held: number;
  total: number;
  currency: string;
}

export interface TransactionLog {
  id: string;
  user_id: string;
  wallet_id: string;
  transaction_type: string;
  amount: number;
  balance_before: number;
  balance_after: number;
  status: string;
  timestamp: Date;
}

export interface SettlementRecord {
  id: string;
  wallet_id: string;
  total_amount: number;
  sponsor_share: number;
  contractor_share: number;
  investor_shares: Record<string, number>;
  platform_fee: number;
  status: string;
  created_at: Date;
}

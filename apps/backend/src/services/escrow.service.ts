import { Pool } from "pg";
import { v4 as uuidv4 } from "uuid";
import {
  EscrowWallet,
  EscrowTransaction,
  PaymentHold,
  EscrowDeposit,
  PaymentRelease,
  EscrowBalance,
  TransactionLog,
  SettlementRecord,
} from "../types/escrow.types";

export class EscrowService {
  constructor(private pool: Pool) {}

  // Ensure escrow tables exist
  private async ensureTablesExist(): Promise<void> {
    try {
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS escrow_wallets (
          id UUID PRIMARY KEY,
          project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          balance DECIMAL(15,2) DEFAULT 0,
          held_amount DECIMAL(15,2) DEFAULT 0,
          status VARCHAR(50) DEFAULT 'ACTIVE',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS escrow_transactions (
          id UUID PRIMARY KEY,
          wallet_id UUID NOT NULL REFERENCES escrow_wallets(id) ON DELETE CASCADE,
          transaction_type VARCHAR(50) NOT NULL,
          amount DECIMAL(15,2) NOT NULL,
          status VARCHAR(50) DEFAULT 'PENDING',
          description TEXT,
          reference_id VARCHAR(255),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS payment_holds (
          id UUID PRIMARY KEY,
          transaction_id UUID NOT NULL REFERENCES escrow_transactions(id) ON DELETE CASCADE,
          wallet_id UUID NOT NULL REFERENCES escrow_wallets(id) ON DELETE CASCADE,
          amount DECIMAL(15,2) NOT NULL,
          reason VARCHAR(255),
          status VARCHAR(50) DEFAULT 'ACTIVE',
          expires_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS transaction_logs (
          id UUID PRIMARY KEY,
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          wallet_id UUID NOT NULL REFERENCES escrow_wallets(id) ON DELETE CASCADE,
          transaction_type VARCHAR(50) NOT NULL,
          amount DECIMAL(15,2) NOT NULL,
          balance_before DECIMAL(15,2),
          balance_after DECIMAL(15,2),
          status VARCHAR(50) DEFAULT 'COMPLETED',
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_escrow_wallets_project ON escrow_wallets(project_id);
        CREATE INDEX IF NOT EXISTS idx_escrow_wallets_user ON escrow_wallets(user_id);
        CREATE INDEX IF NOT EXISTS idx_escrow_transactions_wallet ON escrow_transactions(wallet_id);
        CREATE INDEX IF NOT EXISTS idx_payment_holds_wallet ON payment_holds(wallet_id);
        CREATE INDEX IF NOT EXISTS idx_transaction_logs_user ON transaction_logs(user_id);
      `);
    } catch (error: any) {
      console.log("Escrow tables already exist or error:", error.message);
    }
  }

  // Create or get wallet for project
  async getOrCreateWallet(projectId: string, userId: string): Promise<EscrowWallet> {
    await this.ensureTablesExist();

    const existing = await this.pool.query(
      "SELECT * FROM escrow_wallets WHERE project_id = $1",
      [projectId]
    );

    if (existing.rows.length > 0) {
      return existing.rows[0];
    }

    const id = uuidv4();
    const now = new Date();

    const result = await this.pool.query(
      `INSERT INTO escrow_wallets (id, project_id, user_id, balance, held_amount, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [id, projectId, userId, 0, 0, "ACTIVE", now, now]
    );

    return result.rows[0];
  }

  // ENDPOINT 1: Deposit funds into escrow
  async depositFunds(
    projectId: string,
    userId: string,
    amount: number,
    description?: string
  ): Promise<EscrowTransaction> {
    if (amount <= 0) {
      throw new Error("Amount must be greater than 0");
    }

    const wallet = await this.getOrCreateWallet(projectId, userId);
    const transactionId = uuidv4();
    const now = new Date();

    // Create transaction record
    const transactionResult = await this.pool.query(
      `INSERT INTO escrow_transactions (id, wallet_id, transaction_type, amount, status, description, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [transactionId, wallet.id, "DEPOSIT", amount, "COMPLETED", description || "Funds deposited", now]
    );

    // Update wallet balance
    await this.pool.query(
      `UPDATE escrow_wallets 
       SET balance = balance + $2, updated_at = NOW()
       WHERE id = $1`,
      [wallet.id, amount]
    );

    // Log transaction
    const balanceBefore = parseFloat(String(wallet.balance));
    const balanceAfter = balanceBefore + amount;

    await this.pool.query(
      `INSERT INTO transaction_logs (id, user_id, wallet_id, transaction_type, amount, balance_before, balance_after, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [uuidv4(), userId, wallet.id, "DEPOSIT", amount, balanceBefore, balanceAfter, "COMPLETED"]
    );

    return transactionResult.rows[0];
  }

  // ENDPOINT 2: Get wallet balance
  async getWalletBalance(walletId: string): Promise<EscrowBalance> {
    await this.ensureTablesExist();

    const result = await this.pool.query(
      "SELECT balance, held_amount FROM escrow_wallets WHERE id = $1",
      [walletId]
    );

    if (result.rows.length === 0) {
      throw new Error("Wallet not found");
    }

    const wallet = result.rows[0];
    const available = parseFloat(String(wallet.balance)) - parseFloat(String(wallet.held_amount));

    return {
      wallet_id: walletId,
      available,
      held: parseFloat(String(wallet.held_amount)),
      total: parseFloat(String(wallet.balance)),
      currency: "USD",
    };
  }

  // ENDPOINT 3: Place payment hold (for milestone completion)
  async placePaymentHold(
    walletId: string,
    transactionId: string,
    amount: number,
    reason: string,
    expiresIn: number = 7 // days
  ): Promise<PaymentHold> {
    const holdId = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresIn);

    const result = await this.pool.query(
      `INSERT INTO payment_holds (id, transaction_id, wallet_id, amount, reason, status, expires_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       RETURNING *`,
      [holdId, transactionId, walletId, amount, reason, "ACTIVE", expiresAt]
    );

    // Update held amount
    await this.pool.query(
      `UPDATE escrow_wallets 
       SET held_amount = held_amount + $2
       WHERE id = $1`,
      [walletId, amount]
    );

    return result.rows[0];
  }

  // ENDPOINT 4: Release payment (automatic on milestone approval)
  async releasePayment(
    holdId: string,
    milestoneId: string,
    recipientId: string
  ): Promise<EscrowTransaction> {
    // Get payment hold details
    const holdResult = await this.pool.query(
      "SELECT * FROM payment_holds WHERE id = $1",
      [holdId]
    );

    if (holdResult.rows.length === 0) {
      throw new Error("Payment hold not found");
    }

    const hold = holdResult.rows[0];
    const amount = parseFloat(String(hold.amount));

    // Create release transaction
    const transactionId = uuidv4();
    const releaseResult = await this.pool.query(
      `INSERT INTO escrow_transactions (id, wallet_id, transaction_type, amount, status, description, reference_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       RETURNING *`,
      [
        transactionId,
        hold.wallet_id,
        "RELEASE",
        amount,
        "COMPLETED",
        `Payment released for milestone ${milestoneId}`,
        milestoneId,
      ]
    );

    // Update wallet balance (deduct from held)
    await this.pool.query(
      `UPDATE escrow_wallets 
       SET held_amount = held_amount - $2, balance = balance - $2
       WHERE id = $1`,
      [hold.wallet_id, amount]
    );

    // Mark hold as released
    await this.pool.query(
      `UPDATE payment_holds 
       SET status = $2
       WHERE id = $1`,
      ["RELEASED", hold.id]
    );

    // Log transaction
    const walletResult = await this.pool.query(
      "SELECT balance FROM escrow_wallets WHERE id = $1",
      [hold.wallet_id]
    );
    const newBalance = parseFloat(String(walletResult.rows[0].balance));
    const balanceBefore = newBalance + amount;

    await this.pool.query(
      `INSERT INTO transaction_logs (id, user_id, wallet_id, transaction_type, amount, balance_before, balance_after, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        uuidv4(),
        recipientId,
        hold.wallet_id,
        "RELEASE",
        amount,
        balanceBefore,
        newBalance,
        "COMPLETED",
      ]
    );

    return releaseResult.rows[0];
  }

  // ENDPOINT 5: Get transaction history
  async getTransactionHistory(walletId: string, limit: number = 50): Promise<EscrowTransaction[]> {
    const result = await this.pool.query(
      `SELECT * FROM escrow_transactions 
       WHERE wallet_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2`,
      [walletId, limit]
    );

    return result.rows;
  }

  // ENDPOINT 6: Get transaction details
  async getTransactionDetails(transactionId: string): Promise<any> {
    const result = await this.pool.query(
      "SELECT * FROM escrow_transactions WHERE id = $1",
      [transactionId]
    );

    if (result.rows.length === 0) {
      throw new Error("Transaction not found");
    }

    return result.rows[0];
  }

  // ENDPOINT 7: Get active holds
  async getActiveHolds(walletId: string): Promise<PaymentHold[]> {
    const result = await this.pool.query(
      `SELECT * FROM payment_holds 
       WHERE wallet_id = $1 AND status = $2 
       ORDER BY created_at DESC`,
      [walletId, "ACTIVE"]
    );

    return result.rows;
  }

  // ENDPOINT 8: Cancel payment hold
  async cancelPaymentHold(holdId: string): Promise<void> {
    const holdResult = await this.pool.query(
      "SELECT * FROM payment_holds WHERE id = $1",
      [holdId]
    );

    if (holdResult.rows.length === 0) {
      throw new Error("Payment hold not found");
    }

    const hold = holdResult.rows[0];

    // Update hold status
    await this.pool.query(
      `UPDATE payment_holds 
       SET status = $2
       WHERE id = $1`,
      [holdId, "CANCELLED"]
    );

    // Reduce held amount
    await this.pool.query(
      `UPDATE escrow_wallets 
       SET held_amount = held_amount - $2
       WHERE id = $1`,
      [hold.wallet_id, hold.amount]
    );
  }

  // ENDPOINT 9: Withdraw funds
  async withdrawFunds(walletId: string, amount: number, recipientId: string): Promise<EscrowTransaction> {
    const wallet = await this.pool.query(
      "SELECT * FROM escrow_wallets WHERE id = $1",
      [walletId]
    );

    if (wallet.rows.length === 0) {
      throw new Error("Wallet not found");
    }

    const walletData = wallet.rows[0];
    const available = parseFloat(String(walletData.balance)) - parseFloat(String(walletData.held_amount));

    if (available < amount) {
      throw new Error(`Insufficient funds. Available: ${available}, Requested: ${amount}`);
    }

    const transactionId = uuidv4();

    // Create withdrawal transaction
    const result = await this.pool.query(
      `INSERT INTO escrow_transactions (id, wallet_id, transaction_type, amount, status, description, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING *`,
      [transactionId, walletId, "WITHDRAWAL", amount, "COMPLETED", "Funds withdrawn"]
    );

    // Update wallet balance
    await this.pool.query(
      `UPDATE escrow_wallets 
       SET balance = balance - $2, updated_at = NOW()
       WHERE id = $1`,
      [walletId, amount]
    );

    // Log transaction
    const balanceBefore = parseFloat(String(walletData.balance));
    const balanceAfter = balanceBefore - amount;

    await this.pool.query(
      `INSERT INTO transaction_logs (id, user_id, wallet_id, transaction_type, amount, balance_before, balance_after, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        uuidv4(),
        recipientId,
        walletId,
        "WITHDRAWAL",
        amount,
        balanceBefore,
        balanceAfter,
        "COMPLETED",
      ]
    );

    return result.rows[0];
  }

  // ENDPOINT 10: Distribute settlement
  async distributeSettlement(
    walletId: string,
    totalAmount: number,
    sponsorShare: number,
    contractorShare: number,
    investorShares: Record<string, number>,
    platformFee: number
  ): Promise<SettlementRecord> {
    const settlement = {
      id: uuidv4(),
      wallet_id: walletId,
      total_amount: totalAmount,
      sponsor_share: sponsorShare,
      contractor_share: contractorShare,
      investor_shares: investorShares,
      platform_fee: platformFee,
      status: "COMPLETED",
      created_at: new Date(),
    };

    // Verify total equals sum of shares
    const totalShares =
      sponsorShare +
      contractorShare +
      platformFee +
      Object.values(investorShares).reduce((a: number, b: number) => a + b, 0);

    if (Math.abs(totalShares - totalAmount) > 0.01) {
      throw new Error("Settlement shares do not equal total amount");
    }

    // Create transaction for each beneficiary
    // Sponsor distribution
    if (sponsorShare > 0) {
      await this.pool.query(
        `INSERT INTO escrow_transactions (id, wallet_id, transaction_type, amount, status, description, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [uuidv4(), walletId, "SETTLEMENT_SPONSOR", sponsorShare, "COMPLETED", "Sponsor settlement share"]
      );
    }

    // Contractor distribution
    if (contractorShare > 0) {
      await this.pool.query(
        `INSERT INTO escrow_transactions (id, wallet_id, transaction_type, amount, status, description, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [uuidv4(), walletId, "SETTLEMENT_CONTRACTOR", contractorShare, "COMPLETED", "Contractor settlement share"]
      );
    }

    // Investor distributions
    for (const [investorId, share] of Object.entries(investorShares)) {
      if (share > 0) {
        await this.pool.query(
          `INSERT INTO escrow_transactions (id, wallet_id, transaction_type, amount, status, description, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
          [uuidv4(), walletId, "SETTLEMENT_INVESTOR", share, "COMPLETED", `Investor ${investorId} settlement share`]
        );
      }
    }

    // Platform fee
    if (platformFee > 0) {
      await this.pool.query(
        `INSERT INTO escrow_transactions (id, wallet_id, transaction_type, amount, status, description, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [uuidv4(), walletId, "PLATFORM_FEE", platformFee, "COMPLETED", "Platform fee"]
      );
    }

    // Reset wallet balance to 0
    await this.pool.query(
      `UPDATE escrow_wallets 
       SET balance = 0, held_amount = 0, updated_at = NOW()
       WHERE id = $1`,
      [walletId]
    );

    return settlement;
  }

  // Get wallet by project ID
  async getWalletByProject(projectId: string): Promise<EscrowWallet> {
    const result = await this.pool.query(
      "SELECT * FROM escrow_wallets WHERE project_id = $1",
      [projectId]
    );

    if (result.rows.length === 0) {
      throw new Error("Wallet for project not found");
    }

    return result.rows[0];
  }

  // Get all wallets for user
  async getUserWallets(userId: string): Promise<EscrowWallet[]> {
    const result = await this.pool.query(
      "SELECT * FROM escrow_wallets WHERE user_id = $1 ORDER BY created_at DESC",
      [userId]
    );

    return result.rows;
  }
}

import { Request, Response } from "express";
import { Pool } from "pg";
import { EscrowService } from "../services/escrow.service";

export class EscrowController {
  private escrowService: EscrowService;

  constructor(private pool: Pool) {
    this.escrowService = new EscrowService(pool);
  }

  // ENDPOINT 1: Deposit funds
  async depositFunds(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      const { project_id, amount, description, payment_method } = req.body;

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      if (!project_id || !amount) {
        return res.status(400).json({
          error: "Validation Error",
          message: "project_id and amount required",
        });
      }

      if (amount <= 0) {
        return res.status(400).json({
          error: "Validation Error",
          message: "Amount must be greater than 0",
        });
      }

      const transaction = await this.escrowService.depositFunds(
        project_id,
        userId,
        amount,
        description
      );

      return res.status(201).json({
        success: true,
        message: "Funds deposited successfully",
        transaction,
      });
    } catch (error: any) {
      return res.status(400).json({
        error: "Deposit Failed",
        message: error.message,
      });
    }
  }

  // ENDPOINT 2: Get wallet balance
  async getWalletBalance(req: Request, res: Response) {
    try {
      const { wallet_id } = req.params;

      if (!wallet_id) {
        return res.status(400).json({
          error: "Validation Error",
          message: "wallet_id required",
        });
      }

      const balance = await this.escrowService.getWalletBalance(wallet_id);

      return res.status(200).json({
        success: true,
        balance,
      });
    } catch (error: any) {
      return res.status(400).json({
        error: "Get Balance Failed",
        message: error.message,
      });
    }
  }

  // ENDPOINT 3: Place payment hold
  async placePaymentHold(req: Request, res: Response) {
    try {
      const { wallet_id, transaction_id, amount, reason, expires_in } = req.body;

      if (!wallet_id || !transaction_id || !amount) {
        return res.status(400).json({
          error: "Validation Error",
          message: "wallet_id, transaction_id, and amount required",
        });
      }

      const hold = await this.escrowService.placePaymentHold(
        wallet_id,
        transaction_id,
        amount,
        reason || "Payment hold",
        expires_in || 7
      );

      return res.status(201).json({
        success: true,
        message: "Payment hold placed successfully",
        hold,
      });
    } catch (error: any) {
      return res.status(400).json({
        error: "Hold Failed",
        message: error.message,
      });
    }
  }

  // ENDPOINT 4: Release payment
  async releasePayment(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      const { hold_id, milestone_id } = req.body;

      if (!hold_id || !milestone_id) {
        return res.status(400).json({
          error: "Validation Error",
          message: "hold_id and milestone_id required",
        });
      }

      const transaction = await this.escrowService.releasePayment(
        hold_id,
        milestone_id,
        userId
      );

      return res.status(200).json({
        success: true,
        message: "Payment released successfully",
        transaction,
      });
    } catch (error: any) {
      return res.status(400).json({
        error: "Release Failed",
        message: error.message,
      });
    }
  }

  // ENDPOINT 5: Get transaction history
  async getTransactionHistory(req: Request, res: Response) {
    try {
      const { wallet_id } = req.params;
      const { limit } = req.query;

      if (!wallet_id) {
        return res.status(400).json({
          error: "Validation Error",
          message: "wallet_id required",
        });
      }

      const transactions = await this.escrowService.getTransactionHistory(
        wallet_id,
        limit ? parseInt(limit as string) : 50
      );

      return res.status(200).json({
        success: true,
        transactions,
        count: transactions.length,
      });
    } catch (error: any) {
      return res.status(500).json({
        error: "Server Error",
        message: error.message,
      });
    }
  }

  // ENDPOINT 6: Get transaction details
  async getTransactionDetails(req: Request, res: Response) {
    try {
      const { transaction_id } = req.params;

      if (!transaction_id) {
        return res.status(400).json({
          error: "Validation Error",
          message: "transaction_id required",
        });
      }

      const transaction = await this.escrowService.getTransactionDetails(transaction_id);

      return res.status(200).json({
        success: true,
        transaction,
      });
    } catch (error: any) {
      return res.status(400).json({
        error: "Get Details Failed",
        message: error.message,
      });
    }
  }

  // ENDPOINT 7: Get active holds
  async getActiveHolds(req: Request, res: Response) {
    try {
      const { wallet_id } = req.params;

      if (!wallet_id) {
        return res.status(400).json({
          error: "Validation Error",
          message: "wallet_id required",
        });
      }

      const holds = await this.escrowService.getActiveHolds(wallet_id);

      return res.status(200).json({
        success: true,
        holds,
        count: holds.length,
      });
    } catch (error: any) {
      return res.status(500).json({
        error: "Server Error",
        message: error.message,
      });
    }
  }

  // ENDPOINT 8: Cancel payment hold
  async cancelPaymentHold(req: Request, res: Response) {
    try {
      const { hold_id } = req.body;

      if (!hold_id) {
        return res.status(400).json({
          error: "Validation Error",
          message: "hold_id required",
        });
      }

      await this.escrowService.cancelPaymentHold(hold_id);

      return res.status(200).json({
        success: true,
        message: "Payment hold cancelled successfully",
      });
    } catch (error: any) {
      return res.status(400).json({
        error: "Cancel Failed",
        message: error.message,
      });
    }
  }

  // ENDPOINT 9: Withdraw funds
  async withdrawFunds(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      const { wallet_id, amount } = req.body;

      if (!wallet_id || !amount) {
        return res.status(400).json({
          error: "Validation Error",
          message: "wallet_id and amount required",
        });
      }

      if (amount <= 0) {
        return res.status(400).json({
          error: "Validation Error",
          message: "Amount must be greater than 0",
        });
      }

      const transaction = await this.escrowService.withdrawFunds(wallet_id, amount, userId);

      return res.status(200).json({
        success: true,
        message: "Funds withdrawn successfully",
        transaction,
      });
    } catch (error: any) {
      return res.status(400).json({
        error: "Withdrawal Failed",
        message: error.message,
      });
    }
  }

  // ENDPOINT 10: Distribute settlement
  async distributeSettlement(req: Request, res: Response) {
    try {
      const {
        wallet_id,
        total_amount,
        sponsor_share,
        contractor_share,
        investor_shares,
        platform_fee,
      } = req.body;

      if (!wallet_id || !total_amount) {
        return res.status(400).json({
          error: "Validation Error",
          message: "wallet_id and total_amount required",
        });
      }

      const settlement = await this.escrowService.distributeSettlement(
        wallet_id,
        total_amount,
        sponsor_share || 0,
        contractor_share || 0,
        investor_shares || {},
        platform_fee || 0
      );

      return res.status(201).json({
        success: true,
        message: "Settlement distributed successfully",
        settlement,
      });
    } catch (error: any) {
      return res.status(400).json({
        error: "Settlement Failed",
        message: error.message,
      });
    }
  }

  // Get user wallets
  async getUserWallets(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const wallets = await this.escrowService.getUserWallets(userId);

      return res.status(200).json({
        success: true,
        wallets,
        count: wallets.length,
      });
    } catch (error: any) {
      return res.status(500).json({
        error: "Server Error",
        message: error.message,
      });
    }
  }

  // Get wallet by project
  async getWalletByProject(req: Request, res: Response) {
    try {
      const { project_id } = req.params;

      if (!project_id) {
        return res.status(400).json({
          error: "Validation Error",
          message: "project_id required",
        });
      }

      const wallet = await this.escrowService.getWalletByProject(project_id);

      return res.status(200).json({
        success: true,
        wallet,
      });
    } catch (error: any) {
      return res.status(400).json({
        error: "Get Wallet Failed",
        message: error.message,
      });
    }
  }
}

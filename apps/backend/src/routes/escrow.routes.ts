import { Router } from "express";
import { Pool } from "pg";
import { EscrowController } from "../controllers/escrow.controller";

export function escrowRoutes(pool: Pool): Router {
  const router = Router();
  const controller = new EscrowController(pool);

  router.post("/deposit", (req, res) => controller.depositFunds(req, res));
  router.get("/balance/:wallet_id", (req, res) => controller.getWalletBalance(req, res));
  router.post("/hold", (req, res) => controller.placePaymentHold(req, res));
  router.post("/release", (req, res) => controller.releasePayment(req, res));
  router.get("/transactions/:wallet_id", (req, res) => controller.getTransactionHistory(req, res));
  router.get("/transaction/:transaction_id", (req, res) => controller.getTransactionDetails(req, res));
  router.get("/holds/:wallet_id", (req, res) => controller.getActiveHolds(req, res));
  router.post("/hold/cancel", (req, res) => controller.cancelPaymentHold(req, res));
  router.post("/withdraw", (req, res) => controller.withdrawFunds(req, res));
  router.post("/settle", (req, res) => controller.distributeSettlement(req, res));
  router.get("/wallets/user", (req, res) => controller.getUserWallets(req, res));
  router.get("/wallet/project/:project_id", (req, res) => controller.getWalletByProject(req, res));

  return router;
}

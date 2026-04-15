import { Router } from "express";
import { Pool } from "pg";
import { ContractorController } from "../controllers/contractor.controller";
import { ContractorService } from "../services/contractor.service";

export function contractorRoutes(pool: Pool): Router {
  const router = Router();
  const contractorService = new ContractorService(pool);
  const controller = new ContractorController(contractorService);

  router.post("/profile", (req, res) => controller.createProfile(req, res));
  router.get("/profile/me", (req, res) => controller.getMyProfile(req, res));
  router.put("/profile", (req, res) => controller.updateProfile(req, res));
  router.get("/", (req, res) => controller.listContractors(req, res));
  router.get("/:contractorId", (req, res) => controller.getContractorById(req, res));
  router.get("/:contractorId/stats", (req, res) => controller.getContractorStats(req, res));
  router.post("/bids", (req, res) => controller.placeBid(req, res));
  router.get("/bids/my", (req, res) => controller.getMyBids(req, res));
  router.get("/bids/milestone/:milestoneId", (req, res) => controller.getBidsForMilestone(req, res));
  router.put("/bids/:bidId/status", (req, res) => controller.updateBidStatus(req, res));

  return router;
}

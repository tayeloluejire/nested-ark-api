/// <reference path="../../types/express.d.ts" />

import { Router, Request, Response } from "express";
import { Pool } from "pg";
import { MilestoneController } from "./milestone.controller";
import { MilestoneService } from "../../services/milestone.service";

export function createMilestoneRoutes(pool: Pool): Router {
  const router = Router();
  const milestoneService = new MilestoneService(pool);
  const controller = new MilestoneController(milestoneService);

  // Middleware
  const auth = (req: Request, res: Response, next: any) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    (req.user as any) = { id: "user-id-placeholder" };
    next();
  };

  router.use(auth);

  // Milestone routes
  router.post("/project/:projectId", (req, res) => controller.createMilestone(req, res));
  router.get("/:milestoneId", (req, res) => controller.getMilestone(req, res));
  router.get("/project/:projectId", (req, res) => controller.getMilestonesByProject(req, res));
  router.put("/:milestoneId/status", (req, res) => controller.updateMilestoneStatus(req, res));
  router.put("/:milestoneId/progress", (req, res) => controller.updateMilestoneProgress(req, res));
  router.put("/:milestoneId/contractor", (req, res) => controller.assignContractor(req, res));

  // Evidence routes
  router.post("/:milestoneId/evidence", (req, res) => controller.submitEvidence(req, res));
  router.get("/:milestoneId/evidence", (req, res) => controller.getEvidence(req, res));

  // Approval routes
  router.post("/:milestoneId/approve/request", (req, res) => controller.requestApproval(req, res));
  router.post("/:milestoneId/approve/:approvalId", (req, res) => controller.approveMilestone(req, res));
  router.get("/:milestoneId/approvals", (req, res) => controller.getApprovals(req, res));

  // Stats route
  router.get("/project/:projectId/stats", (req, res) => controller.getMilestoneStats(req, res));

  return router;
}

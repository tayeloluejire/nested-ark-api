import { Router } from "express";
import { Pool } from "pg";
import { MilestoneController } from "../controllers/milestone.controller";
import { MilestoneService } from "../services/milestone.service";

export function milestoneRoutes(pool: Pool): Router {
  const router = Router();
  const milestoneService = new MilestoneService(pool);
  const controller = new MilestoneController(milestoneService);

  router.post("/projects/:projectId/milestones", (req, res) => controller.createMilestone(req, res));
  router.get("/projects/:projectId/milestones", (req, res) => controller.getMilestonesByProject(req, res));
  router.get("/projects/:projectId/milestones/stats", (req, res) => controller.getMilestoneStats(req, res));
  router.get("/:milestoneId", (req, res) => controller.getMilestone(req, res));
  router.put("/:milestoneId/status", (req, res) => controller.updateMilestoneStatus(req, res));
  router.put("/:milestoneId/progress", (req, res) => controller.updateMilestoneProgress(req, res));
  router.post("/:milestoneId/assign", (req, res) => controller.assignContractor(req, res));
  router.post("/:milestoneId/evidence", (req, res) => controller.submitEvidence(req, res));
  router.get("/:milestoneId/evidence", (req, res) => controller.getEvidence(req, res));
  router.post("/:milestoneId/approval", (req, res) => controller.requestApproval(req, res));
  router.put("/approvals/:approvalId", (req, res) => controller.approveMilestone(req, res));
  router.get("/:milestoneId/approvals", (req, res) => controller.getApprovals(req, res));

  return router;
}

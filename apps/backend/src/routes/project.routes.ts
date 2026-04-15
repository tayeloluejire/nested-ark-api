import { Router } from "express";
import { Pool } from "pg";
import { ProjectController } from "../controllers/project.controller";
import { ProjectService } from "../services/project.service";
import { EscrowService } from "../services/escrow.service";

export function projectRoutes(pool: Pool): Router {
  const router = Router();
  const escrowService = new EscrowService(pool);
  const projectService = new ProjectService(pool, escrowService);
  const controller = new ProjectController(projectService);

  router.post("/", (req, res) => controller.createProject(req, res));
  router.get("/", (req, res) => controller.listProjects(req, res));
  router.get("/featured", (req, res) => controller.getFeaturedProjects(req, res));
  router.get("/category/:category", (req, res) => controller.getProjectsByCategory(req, res));
  router.get("/:projectId", (req, res) => controller.getProject(req, res));
  router.put("/:projectId", (req, res) => controller.updateProject(req, res));
  router.delete("/:projectId", (req, res) => controller.deleteProject(req, res));
  router.get("/:projectId/stats", (req, res) => controller.getProjectStats(req, res));

  return router;
}

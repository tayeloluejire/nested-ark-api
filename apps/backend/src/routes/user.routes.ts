import { Router } from "express";
import { Pool } from "pg";
import { UserController } from "../controllers/user.controller";
import { UserService } from "../services/user.service";

export function userRoutes(pool: Pool): Router {
  const router = Router();
  const userService = new UserService(pool);
  const controller = new UserController(userService);

  router.get("/profile", (req, res) => controller.getProfile(req, res));
  router.put("/profile", (req, res) => controller.updateProfile(req, res));
  router.post("/identity/documents", (req, res) => controller.uploadIdentityDocument(req, res));
  router.get("/identity/documents", (req, res) => controller.getIdentityDocuments(req, res));
  router.delete("/identity/documents/:documentId", (req, res) => controller.deleteIdentityDocument(req, res));
  router.post("/kyc", (req, res) => controller.submitKYC(req, res));
  router.get("/kyc/status", (req, res) => controller.getKYCStatus(req, res));
  router.post("/phone/generate-code", (req, res) => controller.generatePhoneCode(req, res));
  router.post("/phone/verify", (req, res) => controller.verifyPhone(req, res));

  return router;
}

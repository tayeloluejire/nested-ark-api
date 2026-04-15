import { Router, Request, Response, NextFunction } from "express";
import { Pool } from "pg";
import { AuthController } from "./auth.controller";
import jwt from "jsonwebtoken";

function authMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({
        error: "Unauthorized",
      });
      return;
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "your_secret_key") as any;

    (req as any).userId = decoded.userId;
    (req as any).email = decoded.email;
    (req as any).role = decoded.role;

    next();
  } catch (error: any) {
    res.status(401).json({
      error: "Unauthorized",
      message: "Invalid token",
    });
  }
}

export function createAuthRoutes(pool: Pool) {
  const router = Router();
  const authController = new AuthController(pool);

  router.post("/register", (req: Request, res: Response) => authController.register(req, res));
  router.post("/login", (req: Request, res: Response) => authController.login(req, res));
  
  // NEW: Forgot Password Route (Matches the endpoint called by frontend)
  router.post("/forgot-password", (req: Request, res: Response) => authController.forgotPassword(req, res));
  
  router.get("/me", authMiddleware, (req: Request, res: Response) => authController.getMe(req, res));

  return router;
}
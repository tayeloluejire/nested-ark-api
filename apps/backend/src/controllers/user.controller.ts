import { Request, Response } from "express";
import { UserService } from "../services/user.service";
import { UpdateProfileRequest, IdentityDocumentRequest } from "../types/user.types";

export class UserController {
  constructor(private userService: UserService) {}

  async getProfile(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      const fullProfile = await this.userService.getFullProfile(userId);
      res.json({ success: true, profile: fullProfile });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async updateProfile(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      const data: UpdateProfileRequest = req.body;
      const profile = await this.userService.updateProfile(userId, data);
      res.json({ success: true, profile });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async uploadIdentityDocument(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      const data: IdentityDocumentRequest = req.body;
      if (!data.document_type || !data.file_url || !data.document_number) {
        res.status(400).json({ error: "document_type, file_url and document_number required" });
        return;
      }
      const doc = await this.userService.uploadIdentityDocument(userId, data);
      res.status(201).json({ success: true, document: doc });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getIdentityDocuments(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      const docs = await this.userService.getIdentityDocuments(userId);
      res.json({ success: true, documents: docs });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async deleteIdentityDocument(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      const { documentId } = req.params;
      // Verify document belongs to user before any action
      await this.userService.getIdentityDocumentById(documentId, userId);
      res.json({ success: true, message: "Document removed" });
    } catch (error: any) {
      res.status(404).json({ error: error.message });
    }
  }

  async submitKYC(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      const kyc = await this.userService.submitKYC(userId, req.body);
      res.status(201).json({ success: true, kyc });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getKYCStatus(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      const kyc = await this.userService.getKYCStatus(userId);
      res.json({ success: true, kyc });
    } catch (error: any) {
      res.status(404).json({ error: error.message });
    }
  }

  async generatePhoneCode(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      const code = await this.userService.generatePhoneVerificationCode(userId);
      // In production, send via SMS — here we just confirm it was generated
      res.json({ success: true, message: "Verification code sent" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async verifyPhone(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      const { code } = req.body;
      if (!code) {
        res.status(400).json({ error: "code required" });
        return;
      }
      const verified = await this.userService.verifyPhoneCode(userId, code);
      if (!verified) {
        res.status(400).json({ error: "Invalid or expired verification code" });
        return;
      }
      res.json({ success: true, message: "Phone verified" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}

import { Request, Response } from "express";
import { MilestoneService } from "../services/milestone.service";

export class MilestoneController {
  constructor(private milestoneService: MilestoneService) {}

  async createMilestone(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const { title, budget_allocation } = req.body;
      if (!title || !budget_allocation) {
        res.status(400).json({ error: "Missing required fields" });
        return;
      }
      const milestone = await this.milestoneService.createMilestone(req.body, projectId);
      res.status(201).json({ success: true, milestone });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getMilestone(req: Request, res: Response) {
    try {
      const { milestoneId } = req.params;
      const milestone = await this.milestoneService.getMilestoneById(milestoneId);
      res.json({ success: true, milestone });
    } catch (error: any) {
      res.status(404).json({ error: error.message });
    }
  }

  async getMilestonesByProject(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const milestones = await this.milestoneService.getMilestonesByProject(projectId);
      res.json({ success: true, milestones });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async updateMilestoneStatus(req: Request, res: Response) {
    try {
      const { milestoneId } = req.params;
      const { status } = req.body;
      if (!status) {
        res.status(400).json({ error: "Status required" });
        return;
      }
      const milestone = await this.milestoneService.updateMilestoneStatus(milestoneId, status);
      res.json({ success: true, milestone });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async updateMilestoneProgress(req: Request, res: Response) {
    try {
      const { milestoneId } = req.params;
      const { progress } = req.body;
      if (progress === undefined || progress < 0 || progress > 100) {
        res.status(400).json({ error: "Progress must be between 0 and 100" });
        return;
      }
      const milestone = await this.milestoneService.updateMilestoneProgress(milestoneId, progress);
      res.json({ success: true, milestone });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async assignContractor(req: Request, res: Response) {
    try {
      const { milestoneId } = req.params;
      const { contractorId } = req.body;
      if (!contractorId) {
        res.status(400).json({ error: "contractorId required" });
        return;
      }
      const milestone = await this.milestoneService.assignContractorToMilestone(milestoneId, contractorId);
      res.json({ success: true, milestone });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async submitEvidence(req: Request, res: Response) {
    try {
      const { milestoneId } = req.params;
      const { evidence_type, file_url } = req.body;
      if (!evidence_type || !file_url) {
        res.status(400).json({ error: "evidence_type and file_url required" });
        return;
      }
      const contractorId = (req as any).userId || "";
      const evidence = await this.milestoneService.submitEvidence(req.body, milestoneId, contractorId);
      res.status(201).json({ success: true, evidence });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getEvidence(req: Request, res: Response) {
    try {
      const { milestoneId } = req.params;
      const evidence = await this.milestoneService.getEvidenceForMilestone(milestoneId);
      res.json({ success: true, evidence });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async requestApproval(req: Request, res: Response) {
    try {
      const { milestoneId } = req.params;
      const { approverId } = req.body;
      if (!approverId) {
        res.status(400).json({ error: "approverId required" });
        return;
      }
      const approval = await this.milestoneService.createApprovalRequest(milestoneId, approverId);
      res.status(201).json({ success: true, approval });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async approveMilestone(req: Request, res: Response) {
    try {
      const { approvalId } = req.params;
      const { approved = true, comments } = req.body;
      const approval = await this.milestoneService.approveMilestone(approvalId, approved, comments);
      res.json({ success: true, approval });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getApprovals(req: Request, res: Response) {
    try {
      const { milestoneId } = req.params;
      const approvals = await this.milestoneService.getApprovalsForMilestone(milestoneId);
      res.json({ success: true, approvals });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getMilestoneStats(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const stats = await this.milestoneService.getMilestoneStats(projectId);
      res.json({ success: true, stats });
    } catch (error: any) {
      res.status(404).json({ error: error.message });
    }
  }
}

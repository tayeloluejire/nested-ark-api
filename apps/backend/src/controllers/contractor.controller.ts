import { Request, Response } from "express";
import { ContractorService } from "../services/contractor.service";

export class ContractorController {
  constructor(private contractorService: ContractorService) {}

  async createProfile(req: Request, res: Response) {
    try {
      const { company_name, bio, specialization, years_experience, hourly_rate } = req.body;
      if (!company_name || !specialization || !hourly_rate) {
        res.status(400).json({ error: "Missing required fields" });
        return;
      }
      const contractor = await this.contractorService.createContractorProfile((req.user as any).id, req.body);
      res.status(201).json({ success: true, contractor });
      return;
    } catch (error: any) {
      res.status(500).json({ error: error.message });
      return;
    }
  }

  async getContractorById(req: Request, res: Response) {
    try {
      const { contractorId } = req.params;
      const contractor = await this.contractorService.getContractorById(contractorId);
      res.json({ success: true, contractor });
      return;
    } catch (error: any) {
      res.status(404).json({ error: error.message });
      return;
    }
  }

  async getMyProfile(req: Request, res: Response) {
    try {
      const contractor = await this.contractorService.getContractorByUserId((req.user as any).id);
      res.json({ success: true, contractor });
      return;
    } catch (error: any) {
      res.status(404).json({ error: error.message });
      return;
    }
  }

  async updateProfile(req: Request, res: Response) {
    try {
      const contractor = await this.contractorService.getContractorByUserId((req.user as any).id);
      const updated = await this.contractorService.updateContractorProfile(contractor.id, req.body);
      res.json({ success: true, contractor: updated });
      return;
    } catch (error: any) {
      res.status(500).json({ error: error.message });
      return;
    }
  }

  async listContractors(req: Request, res: Response) {
    try {
      const { specialization, min_rating, verified, limit = 20, offset = 0 } = req.query;
      const filters: any = {};
      if (specialization) filters.specialization = specialization;
      if (min_rating) filters.min_rating = parseFloat(min_rating as string);
      if (verified) filters.verified = true;
      
      const contractors = await this.contractorService.listContractors(filters, parseInt(limit as string), parseInt(offset as string));
      res.json({ success: true, contractors, limit, offset });
      return;
    } catch (error: any) {
      res.status(500).json({ error: error.message });
      return;
    }
  }

  async placeBid(req: Request, res: Response) {
    try {
      const { milestone_id, project_id, bid_amount, estimated_duration_days, proposal } = req.body;
      if (!milestone_id || !bid_amount || !proposal) {
        res.status(400).json({ error: "Missing required fields" });
        return;
      }
      const contractor = await this.contractorService.getContractorByUserId((req.user as any).id);
      const bid = await this.contractorService.placeBid({
        contractor_id: contractor.id,
        milestone_id,
        project_id,
        bid_amount,
        estimated_duration_days,
        proposal
      });
      res.status(201).json({ success: true, bid });
      return;
    } catch (error: any) {
      res.status(500).json({ error: error.message });
      return;
    }
  }

  async getBidsForMilestone(req: Request, res: Response) {
    try {
      const { milestoneId } = req.params;
      const bids = await this.contractorService.getBidsForMilestone(milestoneId);
      res.json({ success: true, bids });
      return;
    } catch (error: any) {
      res.status(500).json({ error: error.message });
      return;
    }
  }

  async getMyBids(req: Request, res: Response) {
    try {
      const contractor = await this.contractorService.getContractorByUserId((req.user as any).id);
      const bids = await this.contractorService.getBidsForContractor(contractor.id);
      res.json({ success: true, bids });
      return;
    } catch (error: any) {
      res.status(500).json({ error: error.message });
      return;
    }
  }

  async updateBidStatus(req: Request, res: Response) {
    try {
      const { bidId } = req.params;
      const { status } = req.body;
      if (!status) {
        res.status(400).json({ error: "Status required" });
        return;
      }
      const bid = await this.contractorService.updateBidStatus(bidId, status);
      res.json({ success: true, bid });
      return;
    } catch (error: any) {
      res.status(500).json({ error: error.message });
      return;
    }
  }

  async getContractorStats(req: Request, res: Response) {
    try {
      const { contractorId } = req.params;
      const stats = await this.contractorService.getContractorStats(contractorId);
      res.json({ success: true, stats });
      return;
    } catch (error: any) {
      res.status(404).json({ error: error.message });
      return;
    }
  }
}

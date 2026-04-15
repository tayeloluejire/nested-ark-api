import { Request, Response } from "express";
import { ProjectService } from "../services/project.service";

export class ProjectController {
  constructor(private projectService: ProjectService) {}

  async createProject(req: Request, res: Response) {
    try {
      const { title, description, location, country, budget, currency, category, timeline_months, target_completion_date } = req.body;
      if (!title || !description || !location || !country || !budget) {
        res.status(400).json({ error: "Missing required fields" });
        return;
      }
      const project = await this.projectService.createProject(req.body, (req.user as any).id);
      res.status(201).json({ success: true, project });
      return;
    } catch (error: any) {
      res.status(500).json({ error: error.message });
      return;
    }
  }

  async getProject(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const project = await this.projectService.getProjectById(projectId);
      res.json({ success: true, project });
      return;
    } catch (error: any) {
      res.status(404).json({ error: error.message });
      return;
    }
  }

  async listProjects(req: Request, res: Response) {
    try {
      const { status, category, country, sponsor_id, limit = 20, offset = 0 } = req.query;
      const filters: any = {};
      if (status) filters.status = status;
      if (category) filters.category = category;
      if (country) filters.country = country;
      if (sponsor_id) filters.sponsor_id = sponsor_id;
      
      const projects = await this.projectService.listProjects(filters, parseInt(limit as string), parseInt(offset as string));
      res.json({ success: true, projects, limit, offset });
      return;
    } catch (error: any) {
      res.status(500).json({ error: error.message });
      return;
    }
  }

  async updateProject(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const project = await this.projectService.updateProject(projectId, req.body);
      res.json({ success: true, project });
      return;
    } catch (error: any) {
      res.status(500).json({ error: error.message });
      return;
    }
  }

  async deleteProject(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      await this.projectService.deleteProject(projectId);
      res.json({ success: true, message: "Project deleted" });
      return;
    } catch (error: any) {
      res.status(500).json({ error: error.message });
      return;
    }
  }

  async getProjectStats(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const stats = await this.projectService.getProjectStats(projectId);
      res.json({ success: true, stats });
      return;
    } catch (error: any) {
      res.status(404).json({ error: error.message });
      return;
    }
  }

  async getFeaturedProjects(req: Request, res: Response) {
    try {
      const { limit = 10 } = req.query;
      const projects = await this.projectService.featuredProjects(parseInt(limit as string));
      res.json({ success: true, projects });
      return;
    } catch (error: any) {
      res.status(500).json({ error: error.message });
      return;
    }
  }

  async getProjectsByCategory(req: Request, res: Response) {
    try {
      const { category } = req.params;
      const { limit = 20 } = req.query;
      const projects = await this.projectService.getProjectsByCategory(category, parseInt(limit as string));
      res.json({ success: true, projects });
      return;
    } catch (error: any) {
      res.status(500).json({ error: error.message });
      return;
    }
  }
}

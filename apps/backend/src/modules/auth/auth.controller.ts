import { Request, Response } from "express";
import { Pool } from "pg";
import { AuthService } from "../../services/auth.service";
import nodemailer from 'nodemailer';

export class AuthController {
  private authService: AuthService;

  constructor(private pool: Pool) {
    this.authService = new AuthService(pool);
  }

  // --- NEW: FORGOT PASSWORD LOGIC ---
  async forgotPassword(req: Request, res: Response) {
    const { email } = req.body;

    try {
      // Check if user exists in DB first
      const userResult = await this.pool.query("SELECT id FROM users WHERE email = $1", [email]);
      
      if (userResult.rows.length === 0) {
        // We return 200 even if user doesn't exist for security (prevents email enumeration)
        return res.status(200).json({ message: 'Recovery link dispatched if account exists.' });
      }

      // Configure Transporter using Render Env Variables
      const transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: parseInt(process.env.EMAIL_PORT || '587'),
        secure: process.env.EMAIL_PORT === '465', 
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });

      const mailOptions = {
        from: `"Nested Ark Core" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "RECOVERY PROTOCOL: Reset Operator Access Key",
        html: `
          <div style="background: #050505; color: white; padding: 40px; font-family: sans-serif; border: 1px solid #333; border-radius: 8px;">
            <h1 style="color: #2dd4bf; letter-spacing: 2px;">RECOVERY INITIATED</h1>
            <p style="color: #a1a1aa;">An operator access key reset was requested for this coordinate.</p>
            <div style="margin: 30px 0;">
              <a href="https://nested-ark-frontend.vercel.app/reset-password?email=${encodeURIComponent(email)}" 
                 style="background: white; color: black; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 4px; text-transform: uppercase; font-size: 12px;">
                 Reset Access Key
              </a>
            </div>
            <p style="margin-top: 20px; color: #52525b; font-size: 10px; text-transform: uppercase;">If you did not initiate this, ignore this transmission.</p>
          </div>
        `,
      };

      await transporter.sendMail(mailOptions);
      return res.status(200).json({ message: 'Recovery link dispatched.' });
    } catch (error: any) {
      console.error("Mail Error:", error);
      return res.status(500).json({ 
        error: "Mail Protocol Failed", 
        message: "Internal server error during dispatch." 
      });
    }
  }

  // --- EXISTING LOGIC (UNCHANGED) ---
  async register(req: Request, res: Response) {
    try {
      const { email, password, full_name, phone, role } = req.body;
      if (!email || !password || !full_name || !role) {
        return res.status(400).json({ error: "Validation Error", message: "Missing required fields" });
      }
      const result = await this.authService.register(email, password, full_name, phone, role);
      return res.status(201).json({
        message: "User registered successfully",
        user: { id: result.id, email: result.email, full_name: result.full_name, role: result.role },
        tokens: { access_token: result.access_token, refresh_token: result.refresh_token, expires_in: result.expires_in },
      });
    } catch (error: any) {
      return res.status(400).json({ error: "Registration Failed", message: error.message });
    }
  }

  async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: "Validation Error", message: "Missing email or password" });
      }
      const result = await this.authService.login(email, password);
      return res.status(200).json({
        message: "Login successful",
        user: { id: result.id, email: result.email, full_name: result.full_name, role: result.role },
        tokens: { access_token: result.access_token, refresh_token: result.refresh_token, expires_in: result.expires_in },
      });
    } catch (error: any) {
      return res.status(401).json({ error: "Login Failed", message: error.message });
    }
  }

  async getMe(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized", message: "No user ID" });
      const user = await this.authService.getUserById(userId);
      return res.status(200).json({ user });
    } catch (error: any) {
      return res.status(500).json({ error: "Server Error", message: error.message });
    }
  }
}
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";

export class AuthService {
  constructor(private pool: Pool) {}

  async register(email: string, password: string, fullName: string, phone: string, role: string) {
    const existingUser = await this.pool.query(
      "SELECT id FROM users WHERE email = $1",
      [email]
    );

    if (existingUser.rows.length > 0) {
      throw new Error("User with this email already exists");
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = uuidv4();
    const now = new Date();

    await this.pool.query(
      `INSERT INTO users (id, email, password_hash, full_name, phone, role, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [userId, email, hashedPassword, fullName, phone || null, role, "ACTIVE", now, now]
    );

    const tokens = this.generateTokens(userId, email, role);

    return {
      id: userId,
      email,
      full_name: fullName,
      role,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_in: tokens.expires_in,
    };
  }

  async login(email: string, password: string) {
    const result = await this.pool.query(
      "SELECT id, email, password_hash, full_name, role FROM users WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0) {
      throw new Error("Invalid email or password");
    }

    const user = result.rows[0];
    const passwordValid = await bcrypt.compare(password, user.password_hash);

    if (!passwordValid) {
      throw new Error("Invalid email or password");
    }

    const tokens = this.generateTokens(user.id, user.email, user.role);

    return {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_in: tokens.expires_in,
    };
  }

  generateTokens(userId: string, email: string, role: string) {
    const accessToken = jwt.sign(
      { userId, email, role, type: "access" },
      process.env.JWT_SECRET || "your_secret_key",
      { expiresIn: '24h' as any }
    );

    const refreshToken = jwt.sign(
      { userId, email, role, type: "refresh" },
      process.env.JWT_SECRET || "your_secret_key",
      { expiresIn: '30d' as any }
    );

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: 86400,
    };
  }

  verifyToken(token: string) {
    try {
      return jwt.verify(token, process.env.JWT_SECRET || "your_secret_key");
    } catch (error) {
      throw new Error("Invalid or expired token");
    }
  }

  async getUserById(userId: string) {
    const result = await this.pool.query(
      "SELECT id, email, full_name, phone, role, identity_verified, kyc_status, created_at FROM users WHERE id = $1",
      [userId]
    );

    if (result.rows.length === 0) {
      throw new Error("User not found");
    }

    return result.rows[0];
  }
}

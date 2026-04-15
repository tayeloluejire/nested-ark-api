import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { sendRecoveryEmail } from "../utils/mailer";

export async function requestReset(req: Request, res: Response) {

  try {

    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        error: "Email required"
      });
    }

    const token = jwt.sign(
      { email },
      process.env.JWT_SECRET as string,
      { expiresIn: "15m" }
    );

    const resetLink =
      `${process.env.FRONTEND_URL}/reset-password/${token}`;

    await sendRecoveryEmail(email, resetLink);

    return res.json({
      message: "Recovery email sent"
    });

  } catch (err) {

    console.error(err);

    return res.status(500).json({
      error: "Recovery protocol failed"
    });

  }

}
import crypto from "crypto";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendResetPasswordEmail } from "@/lib/email";

export async function POST(req) {
  try {
    const { email } = await req.json();

    const normalizedEmail =
      email.trim().toLowerCase();

    const user =
      await prisma.user.findUnique({
        where: {
          email: normalizedEmail
        }
      });

    // Always return success
    if (!user) {
      return NextResponse.json({
        success: true
      });
    }

    const token =
      crypto.randomUUID();

    const expiry =
      new Date(
        Date.now() +
          1000 * 60 * 30
      );

    await prisma.user.update({
      where: {
        id: user.id
      },
      data: {
        resetToken: token,
        resetTokenExpiry: expiry
      }
    });

    const resetLink =
      `${process.env.NEXTAUTH_URL}` +
      `/reset-password?token=${token}`;
console.log("RESET LINK:");
console.log(resetLink);
    await sendResetPasswordEmail(
      user.email,
      user.name || "User",
      resetLink
    );
console.log("RESET LINK123:");
console.log(resetLink);
    return NextResponse.json({
      success: true
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error:
          "Unable to process request"
      },
      {
        status: 500
      }
    );
  }
}
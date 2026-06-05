import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(req) {
  try {
    const {
      token,
      password
    } = await req.json();

    const user =
      await prisma.user.findFirst({
        where: {
          resetToken: token,
          resetTokenExpiry: {
            gt: new Date()
          }
        }
      });

    if (!user) {
      return NextResponse.json(
        {
          error:
            "Invalid or expired token"
        },
        {
          status: 400
        }
      );
    }

    const hashedPassword =
      await bcrypt.hash(
        password,
        10
      );

    await prisma.user.update({
      where: {
        id: user.id
      },
      data: {
        password:
          hashedPassword,

        resetToken: null,
        resetTokenExpiry:
          null
      }
    });

    return NextResponse.json({
      success: true
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error:
          "Unable to reset password"
      },
      {
        status: 500
      }
    );
  }
}
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { sendWelcomeEmail } from "@/lib/welcome-email";

export async function POST(req) {
  try {
    const body = await req.json();

    const { name, email, password } = body;

    if (!name || !email || !password) {
      return NextResponse.json(
        {
          error: "All fields are required"
        },
        { status: 400 }
      );
    }

    const existingUser =
      await prisma.user.findUnique({
        where: { email }
      });

    if (existingUser) {
      return NextResponse.json(
        {
          error: "Email already registered"
        },
        { status: 400 }
      );
    }

    const hashedPassword =
      await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword
      }
    });

    return NextResponse.json({
      success: true,
      userId: user.id
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error: "Something went wrong"
      },
      { status: 500 }
    );
  }
}
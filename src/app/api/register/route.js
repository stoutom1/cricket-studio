import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import {sendWelcomeEmail} from "@/lib/email";

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
console.log("I am in register route before checking existing user");
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
console.log("I am in register route");
    const hashedPassword =
      await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword
      }
    });

    try {
  await sendWelcomeEmail(
    user.name,
    user.email
  );
} catch (emailError) {
  console.error(
    "Welcome email failed:",
    emailError
  );
}

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
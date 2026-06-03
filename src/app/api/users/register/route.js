import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

export async function POST(request) {
  const session =
    await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const body =
    await request.json();

  const user =
    await prisma.user.create({
      data: {
        email: session.user.email,
        name: body.name,
        password: "oauth-user"
      }
    });

  return NextResponse.json(user);
}
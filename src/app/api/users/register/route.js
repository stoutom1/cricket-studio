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
    
    const { name, email, password } = body;

    //console.log("password:", password);
    
if (!name || !email || !password) {
      return NextResponse.json(
        {
          error: "All fields are required"
        },
        { status: 400 }
      );
    }  

  /*const user =
    await prisma.user.create({
      data: {
        email: session.user.email,
        name: body.name,
        password: "oauth-user"
      }
    });
*/
  const hashedPassword =
      await bcrypt.hash(password, 10);
  const user =
    await prisma.user.create({
      data: {
        email: session.user.email,
        name: body.name,
        password: hashedPassword
      }
    });

  return NextResponse.json(user);
}
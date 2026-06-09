import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(
  request,
  { params }
) {
  try {
    const { id } = await params;
    const matchId = Number(id);
    
    const body = await request.json();
    const { matchEndType } = body;
    //const status = matchEndType === "Lock"? "COMPLETED_LOCKED": "COMPLETED";
    let status;

    if (matchEndType === "Lock") {
      status = "COMPLETED_LOCKED";
    } else if (matchEndType === "Abandon") {
      status = "ABANDONED";
    } else {
      status = "COMPLETED";
    }
    await prisma.match.update({
      where: {
        id: matchId
      },
      data: {
        status: status
      }
    });
    

    return NextResponse.json({
      success: true
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error: "Failed to end match"
      },
      {
        status: 500
      }
    );
  }
}
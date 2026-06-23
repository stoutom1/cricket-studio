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
    let endedAt;
    let lockedAt;
    let statusText;

    if (matchEndType === "Lock") {
      status = "COMPLETED_LOCKED";
      statusText = "COMPLETED_LOCKED"
      lockedAt = new Date();
    } else if (matchEndType === "Abandon") {
      status = "ABANDONED";
      statusText = "ABANDONED"
      endedAt = new Date();
    } else {
      status = "COMPLETED";
      endedAt = new Date();
      statusText = "MATCH COMPLETED"
    }
    await prisma.match.update({
      where: {
        id: matchId
      },
      data: {
        status: status,
        endedAt: endedAt,
        lockedAt: lockedAt,
        statusText: statusText,
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
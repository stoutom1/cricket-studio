import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(
  request,
  { params }
) {
  try {
    const { id } = await params;

    const matchId = Number(id);
console.log("match ended matchId", matchId);
    await prisma.match.update({
      where: {
        id: matchId
      },
      data: {
        status: "COMPLETED_LOCKED"
      }
    });
    
console.log("match ended matchId123", matchId);
    return NextResponse.json({
      success: true
    });
  } catch (error) {
    console.error(error);
console.log("match ended matchId555", matchId);
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
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(
  request,
  { params }
) {
  try {
    const { id } = await params;

    const matchId = Number(id);

    await prisma.match.update({
      where: {
        id: matchId
      },
      data: {
        status: "COMPLETED_LOCKED"
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
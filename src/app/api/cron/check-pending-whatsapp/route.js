import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stuckMessages =
await prisma.birthdayReminderLog.findMany({

    where: {

        status: "PENDING",

        callbackExpectedAt: {

            lt: new Date()

        }

    }

});
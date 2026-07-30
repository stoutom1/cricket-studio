const stuckMessages =
await prisma.birthdayReminderLog.findMany({

    where: {

        status: "PENDING",

        callbackExpectedAt: {

            lt: new Date()

        }

    }

});
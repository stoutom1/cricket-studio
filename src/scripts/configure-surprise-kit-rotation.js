const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const league = await prisma.league.findFirst({
    where: {
      name: {
        equals: "Surprise Cricket League",
        mode: "insensitive",
      },
    },
    select: {
      id: true,
      name: true,
      kitRotationMode: true,
    },
  });

  if (!league) {
    throw new Error(
      'League named "Surprise Cricket League" was not found.'
    );
  }

  const updatedLeague = await prisma.league.update({
    where: {
      id: league.id,
    },
    data: {
      kitRotationMode: "LEAGUE_PLAYER",
    },
    select: {
      id: true,
      name: true,
      kitRotationMode: true,
    },
  });

  console.log("Updated league:", updatedLeague);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
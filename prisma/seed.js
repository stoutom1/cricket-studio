const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function upsertTeamWithPlayers(teamName, players) {
  let team = await prisma.team.findUnique({
    where: { name: teamName }
  });

  if (!team) {
    team = await prisma.team.create({
      data: { name: teamName }
    });
    console.log(`✅ Team created: ${teamName}`);
  }

  for (const name of players) {
    const existing = await prisma.player.findFirst({
      where: { teamId: team.id, name }
    });

    if (!existing) {
      await prisma.player.create({
        data: { name, teamId: team.id }
      });
      console.log(`✅ Player created: ${teamName} / ${name}`);
    }
  }
}

async function main() {
  const email = "demo@example.com";
  const existingUser = await prisma.user.findUnique({
    where: { email }
  });

  if (!existingUser) {
    const hashedPassword = await bcrypt.hash("demo123", 10);
    await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: "Demo User"
      }
    });
    console.log("✅ Demo user created: demo@example.com / demo123");
  }

  await upsertTeamWithPlayers("Lions", [
    "Arjun",
    "Rohit",
    "Kabir",
    "Manav",
    "Vikram",
    "Ishaan"
  ]);

  await upsertTeamWithPlayers("Tigers", [
    "Ayaan",
    "Dev",
    "Kunal",
    "Nikhil",
    "Samar",
    "Yuvraj"
  ]);

  await upsertTeamWithPlayers("Eagles", [
    "Aditya",
    "Harsh",
    "Parth",
    "Reyansh",
    "Tanish",
    "Vihaan"
  ]);

  await upsertTeamWithPlayers("Hawks", [
    "Aarav",
    "Dhruv",
    "Krish",
    "Laksh",
    "Pranav",
    "Shaurya"
  ]);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error("❌ Seed error:", error);
    await prisma.$disconnect();
    process.exit(1);
  });
import { config } from 'dotenv';
config({ path: '../../.env' });

import bcrypt from 'bcrypt';

import { Role } from '@gloo/shared';

import { prisma } from '../src/lib/prisma';

const SECTORS = ['Gestão', 'Comercial', 'Marketing & Aquisição', 'Produto & Serviço'];

async function main() {
  await Promise.all(
    SECTORS.map((name) =>
      prisma.sector.upsert({
        where: { name },
        create: { name },
        update: {},
      }),
    ),
  );

  const adminEmail = 'linemarques316@gmail.com';
  const passwordHash = await bcrypt.hash('Bezzosz@12', 12);

  await prisma.user.upsert({
    where: { email: adminEmail },
    create: {
      email: adminEmail,
      passwordHash,
      name: 'Line Marques',
      role: Role.ADMIN,
    },
    update: {},
  });

  console.log('Seed complete: 4 sectors + 1 admin user.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

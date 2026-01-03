const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Start seeding ...');

    // Create Cities
    const cities = [
        { name: 'Paris', country: 'France', avgDailyCost: 200, description: 'City of Lights' },
        { name: 'Tokyo', country: 'Japan', avgDailyCost: 250, description: 'Futuristic and Traditional' },
        { name: 'New York', country: 'USA', avgDailyCost: 300, description: 'The Big Apple' },
        { name: 'London', country: 'UK', avgDailyCost: 220, description: 'History and Culture' },
        { name: 'Rome', country: 'Italy', avgDailyCost: 180, description: 'Eternal City' }
    ];

    for (const c of cities) {
        const city = await prisma.city.create({
            data: c,
        });
        console.log(`Created city with id: ${city.id}`);

        // Create Activities
        await prisma.activity.createMany({
            data: [
                { cityId: city.id, name: 'City Tour', category: 'Sightseeing', cost: 0 },
                { cityId: city.id, name: 'Museum Visit', category: 'Culture', cost: 25 },
                { cityId: city.id, name: 'Local Food Tasting', category: 'Food', cost: 50 },
            ]
        });
    }

    console.log('Seeding finished.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

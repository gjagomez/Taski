// Borra y recrea la base de datos con los datos de demostración: npm run db:reset
import { dropDatabase, createDatabaseIfMissing, pool } from './pool.js';
import { createSchema } from './schema.js';
import { seedIfEmpty } from './seed.js';
import { seedWorkspaceIfEmpty } from './seedWorkspace.js';

await dropDatabase();
await createDatabaseIfMissing();
await createSchema();
await seedIfEmpty();
await seedWorkspaceIfEmpty();
await pool.end();
console.log('✅ Base de datos reiniciada');

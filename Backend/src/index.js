import 'dotenv/config';
import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { typeDefs } from './graphql/typeDefs.js';
import { resolvers } from './graphql/resolvers.js';
import { createDatabaseIfMissing } from './db/pool.js';
import { createSchema } from './db/schema.js';
import { seedIfEmpty } from './db/seed.js';
import { seedWorkspaceIfEmpty } from './db/seedWorkspace.js';
import { workspaceTypeDefs, workspaceResolvers } from './graphql/workspace.js';
import { aiTypeDefs, aiResolvers } from './graphql/ai.js';
import { rolesTypeDefs, rolesResolvers } from './graphql/roles.js';
import { startAiServer } from './ai.js';
import { userFromRequest } from './auth.js';
import { withSanitizedArgs } from './security.js';

await createDatabaseIfMissing();
await createSchema();
await seedIfEmpty();
await seedWorkspaceIfEmpty();

const server = new ApolloServer({
  typeDefs: [typeDefs, workspaceTypeDefs, aiTypeDefs, rolesTypeDefs],
  // Todos los argumentos se limpian/validan antes de llegar a los resolvers
  resolvers: withSanitizedArgs([resolvers, workspaceResolvers, aiResolvers, rolesResolvers]),
});

const { url } = await startStandaloneServer(server, {
  listen: { port: Number(process.env.PORT || 4000) },
  context: async ({ req }) => ({ user: await userFromRequest(req), userCache: new Map() }),
});

console.log(`🚀 API GraphQL lista en ${url}`);
startAiServer();

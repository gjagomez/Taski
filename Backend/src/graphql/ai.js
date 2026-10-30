import { one, query } from '../db/pool.js';
import { requireAuth } from '../auth.js';
import { fail } from '../domain.js';
import { aiStatus, analyzeDocument, suggestSubitems } from '../ai.js';
import { buildChart } from '../aiChart.js';
import { itemScope, requireFileAccess, requireItemAccess } from '../wsAccess.js';

export const aiTypeDefs = `#graphql
  type AiStatus { available: Boolean!, model: String!, message: String! }
  type AiSubitemSuggestion { name: String!, hours: Float! }
  type AiDocTask { name: String!, hours: Float!, priority: String! }
  type AiDocAnalysis {
    fileName: String!
    summary: String!
    truncated: Boolean!
    pages: Int
    tasks: [AiDocTask!]!
  }

  type AiChartSeries { name: String!, color: String!, values: [Float!]! }
  type AiChart {
    title: String!
    chartType: String!
    metricLabel: String!
    xLabel: String!
    stackLabel: String
    filters: [String!]!
    categories: [String!]!
    series: [AiChartSeries!]!
    insight: String!
    spec: String!
  }

  extend type Query {
    aiStatus: AiStatus!
  }

  extend type Mutation {
    aiSuggestSubitems(itemId: ID!): [AiSubitemSuggestion!]!
    aiAnalyzeFile(fileId: ID!): AiDocAnalysis!
    aiChart(prompt: String!, previousSpec: String): AiChart!
  }
`;

export const aiResolvers = {
  Query: {
    aiStatus: (_, __, ctx) => {
      requireAuth(ctx);
      return aiStatus();
    },
  },
  Mutation: {
    aiChart: async (_, { prompt, previousSpec }, ctx) => {
      requireAuth(ctx);
      if (!prompt?.trim()) fail('Describe la gráfica que necesitas');
      try {
        return await buildChart(prompt.trim().slice(0, 500), previousSpec, await itemScope(ctx));
      } catch (err) {
        const offline = err.cause?.code === 'ECONNREFUSED' || /fetch failed/i.test(err.message);
        fail(offline ? 'LM Studio no está disponible. Abre LM Studio e inicia el servidor local.' : `No se pudo generar la gráfica: ${err.message}`);
      }
    },
    aiAnalyzeFile: async (_, { fileId }, ctx) => {
      requireAuth(ctx);
      await requireFileAccess(ctx, String(fileId));
      try {
        return await analyzeDocument(String(fileId));
      } catch (err) {
        const offline = err.cause?.code === 'ECONNREFUSED' || /fetch failed/i.test(err.message);
        fail(offline ? 'LM Studio no está disponible. Abre LM Studio e inicia el servidor local.' : err.message);
      }
    },
    aiSuggestSubitems: async (_, { itemId }, ctx) => {
      requireAuth(ctx);
      await requireItemAccess(ctx, itemId);
      const item = await one(
        'SELECT i.name, i.area, g.name AS stage FROM ws_items i JOIN ws_groups g ON g.id = i.group_id WHERE i.id = ?',
        [itemId]
      );
      if (!item) fail('El elemento no existe', 'NOT_FOUND');
      const existing = (await query('SELECT name FROM ws_subitems WHERE item_id = ?', [itemId])).map((s) => s.name);
      try {
        return await suggestSubitems({ ...item, existing });
      } catch (err) {
        const offline = err.cause?.code === 'ECONNREFUSED' || /fetch failed/i.test(err.message);
        fail(offline ? 'LM Studio no está disponible. Abre LM Studio e inicia el servidor local.' : `La IA no pudo generar sugerencias: ${err.message}`);
      }
    },
  },
};

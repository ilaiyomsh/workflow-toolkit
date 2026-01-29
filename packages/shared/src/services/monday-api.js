import fetch from 'node-fetch';
import logger from './logger/index.js';

const MONDAY_API_URL = 'https://api.monday.com/v2';
const TAG = 'monday_api';

/**
 * Creates an API client adapter for the formula engine resolver.
 * @param {string} token - The short-lived API token.
 * @returns {Object} - An object with a query function.
 */
export function createApiClient(token) {
  return {
    query: async (query, variables = {}) => {
      const response = await fetch(MONDAY_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token,
          'API-Version': '2025-10'
        },
        body: JSON.stringify({ query, variables })
      });

      const result = await response.json();

      // The Resolver expects data directly, without the wrapper
      return result.data;
    }
  };
}

/**
 * Fetches all formula columns from a board.
 * @param {string} token - The API token.
 * @param {string} boardId - The board ID.
 * @returns {Array} Array of {title, value} for dropdown options.
 */
export async function getFormulaColumns(token, boardId) {
  const query = `
    query GetBoardColumns($boardId: [ID!]) {
      boards(ids: $boardId) {
        columns(types: [formula]) {
          id
          title
        }
      }
    }
  `;

  const variables = { boardId: [String(boardId)] };
  const requestBody = { query, variables };

  logger.info('Monday API Request - getFormulaColumns', TAG, {
    url: MONDAY_API_URL,
    method: 'POST',
    apiVersion: '2025-10',
    query: query.trim(),
    variables
  });

  const response = await fetch(MONDAY_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token,
      'API-Version': '2025-10'
    },
    body: JSON.stringify(requestBody)
  });

  const result = await response.json();

  logger.info('Monday API Response - getFormulaColumns', TAG, {
    status: response.status,
    statusText: response.statusText,
    response: result
  });

  if (result.errors) {
    logger.error('Monday API returned errors', TAG, { errors: result.errors });
    throw new Error(result.errors[0].message);
  }

  const board = result.data?.boards?.[0];
  if (!board) throw new Error(`Board ${boardId} not found`);

  return board.columns.map(col => ({
    title: col.title,
    value: col.id
  }));
}

export default {
  createApiClient,
  getFormulaColumns,
};

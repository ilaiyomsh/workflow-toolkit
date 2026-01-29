/**
 * Update Connected Items Block
 * Updates a column on ALL items connected via a Connect Boards column.
 */

export { executeAction } from './action.js';
export { fieldHandlers } from './fields.js';

/**
 * Block metadata
 */
export const metadata = {
  name: 'update-connected-items',
  displayName: 'Update Connected Items',
  description: 'Updates a column on ALL items connected via a Connect Boards column',
  version: '1.0.0',
  author: 'Workflow ToolKit',

  // Input fields configuration (for documentation)
  // Note: boardId_A, itemId, connectBoardsColumnId, and connectedBoardId are
  // Monday.com built-in fields configured in Developer Center
  inputFields: [
    {
      key: 'boardId_A',
      type: 'board',
      builtIn: true,
      description: 'The board containing the item with connections (Monday.com built-in)',
    },
    {
      key: 'itemId',
      type: 'item',
      builtIn: true,
      description: 'The item whose connections to process (Monday.com built-in)',
    },
    {
      key: 'connectBoardsColumnId',
      type: 'connect_boards_column',
      builtIn: true,
      description: 'The Connect Boards column to read connections from (Monday.com built-in)',
    },
    {
      key: 'connectedBoardId',
      type: 'connected_board',
      builtIn: true,
      description: 'The target board ID - automatically provided by Monday.com (built-in)',
    },
    {
      key: 'targetColumnId',
      type: 'custom_field',
      description: 'The column to update on connected items',
      remoteOptionsUrl: '/monday/get_target_columns',
      dependency: 'connectedBoardId',
    },
    {
      key: 'newValue',
      type: 'text',
      description: 'The new value to set (status label, text, number, etc.)',
    },
  ],

  // Output fields configuration
  outputFields: [
    {
      key: 'updatedCount',
      type: 'number',
      description: 'Number of items successfully updated',
    },
    {
      key: 'itemIds',
      type: 'text',
      description: 'Comma-separated list of updated item IDs',
    },
  ],
};

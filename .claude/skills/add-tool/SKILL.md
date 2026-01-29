---
name: add-tool
description: Add a new tool with blocks to the Workflow Toolkit. Use when the user wants to create a new Monday.com workflow automation tool or add a new block to an existing tool.
argument-hint: [tool-name] [block-name]
allowed-tools: Read, Write, Bash, Glob, Grep
---

# Add a New Tool to the Workflow Toolkit

You are helping create a new tool or block in the Monday.com Workflow Toolkit automation framework.

## Arguments

- `$0` - Tool name (kebab-case, e.g., `email-sender`, `data-validator`)
- `$1` - Block name (kebab-case, e.g., `send-email`, `validate-data`)

Both arguments are required. If only one is provided, prompt the user for the missing argument.

## Project Structure

The Workflow Toolkit follows this structure:

```
workflow-toolkit/
├── packages/
│   ├── formula-engine/      # Shared formula engine
│   └── shared/              # Shared utilities, middlewares, services
├── server/                  # Express server
└── tools/                   # All tools live here
    └── [tool-name]/
        ├── package.json
        ├── tool.config.js
        └── blocks/
            └── [block-name]/
                ├── block.config.js
                ├── index.js
                ├── action.js
                └── fields.js
```

## Step 1: Check if Tool Exists

First, check if the tool directory already exists:

```bash
ls -la tools/$0 2>/dev/null || echo "Tool does not exist"
```

## Step 2: Create Tool (if new)

If the tool doesn't exist, create it with these files:

### tools/$0/package.json

```json
{
  "name": "@workflow-toolkit/$0",
  "version": "1.0.0",
  "description": "[DESCRIPTION] - Blocks for [PURPOSE]",
  "type": "module",
  "main": "blocks/[first-block]/index.js",
  "dependencies": {
    "@workflow-toolkit/shared": "workspace:*"
  },
  "keywords": [
    "monday.com",
    "$0",
    "workflow"
  ],
  "license": "MIT"
}
```

### tools/$0/tool.config.js

```javascript
/**
 * [Tool Name] Tool Configuration
 * Metadata for the [Tool Name] Tool.
 */

export default {
  name: '$0',
  displayName: '[Display Name] Tool',
  description: '[Description of what this tool does]',
  version: '1.0.0',
  author: 'Workflow ToolKit',
};
```

## Step 3: Create Block

Create the block directory and files:

### tools/$0/blocks/$1/block.config.js

```javascript
/**
 * [Block Name] Block Configuration
 * Metadata for the [Block Name] block.
 */

export default {
  name: '$1',
  displayName: '[Display Name]',
  description: '[Description of what this block does]',
  version: '1.0.0',

  // Input fields configuration
  // IMPORTANT: Use Monday.com's built-in field types when possible
  // Built-in fields: boardId_A, itemId, connectBoardsColumnId, connectedBoardId
  inputFields: [
    {
      key: 'boardId_A',
      type: 'board',
      builtIn: true,
      description: 'The board containing the item (Monday.com built-in)',
    },
    {
      key: 'itemId',
      type: 'item',
      builtIn: true,
      description: 'The item to process (Monday.com built-in)',
    },
    // Add custom fields only when built-in fields don't cover the need
    // Custom fields require a remote options URL
  ],

  // Output fields configuration
  outputFields: [
    {
      key: 'result',
      type: 'text',
      description: 'The result of the operation',
    },
  ],
};
```

### tools/$0/blocks/$1/index.js

```javascript
/**
 * [Block Name] Block
 * [Description of what this block does]
 */

export { executeAction } from './action.js';
export { fieldHandlers } from './fields.js';

/**
 * Block metadata
 */
export const metadata = {
  name: '$1',
  displayName: '[Display Name]',
  description: '[Description]',
  version: '1.0.0',
  author: 'Workflow ToolKit',

  inputFields: [
    {
      key: 'boardId_A',
      type: 'board',
      builtIn: true,
      description: 'The board containing the item (Monday.com built-in)',
    },
    {
      key: 'itemId',
      type: 'item',
      builtIn: true,
      description: 'The item to process (Monday.com built-in)',
    },
  ],

  outputFields: [
    {
      key: 'result',
      type: 'text',
      description: 'The result of the operation',
    },
  ],
};
```

### tools/$0/blocks/$1/action.js

```javascript
/**
 * [Block Name] Action
 * [Description of what this action does]
 */

import { createApiClient, logger, extractFieldValues } from '@workflow-toolkit/shared';

const TAG = '$1_action';

/**
 * Controller for the '[Block Name]' action.
 * [Description of what this controller does]
 */
export async function executeAction(req, res) {
  const { accountId, userId, shortLivedToken } = req.session;
  const { inputFields } = req.body.payload;

  logger.info('Raw inputFields received', TAG, { inputFields });

  // Extract field values using Monday.com's built-in field keys
  // IMPORTANT: Use the exact field keys configured in Developer Center
  // Built-in fields: boardId_A, itemId, connectBoardsColumnId, connectedBoardId
  // Monday.com may send values directly (not wrapped in {value: ...})
  const { boardId_A, itemId } = extractFieldValues(inputFields, ['boardId_A', 'itemId']);

  // Create aliases for clarity in code
  const boardId = boardId_A;

  const loggingOptions = {
    accountId,
    userId,
    boardId,
    itemId,
  };

  logger.info('[Block name] action received', TAG, loggingOptions);

  // Validate required fields
  if (!boardId || !itemId) {
    logger.error('Missing required fields', TAG, loggingOptions);
    return res.status(400).json({
      severityCode: 4000,
      notificationErrorTitle: 'Missing required fields',
      notificationErrorDescription: 'Please provide all required fields',
      runtimeErrorDescription: 'Missing required input fields',
    });
  }

  try {
    const apiClient = createApiClient(shortLivedToken);

    // TODO: Implement your logic here
    const result = 'success';

    logger.info('Action completed successfully', TAG, { result });

    return res.status(200).json({
      outputFields: {
        result,
      },
    });
  } catch (err) {
    logger.error('Action failed', TAG, { ...loggingOptions, error: err.message, stack: err.stack });

    // Handle specific errors
    if (err.message.includes('not found') || err.message.includes('404')) {
      return res.status(404).json({
        severityCode: 6000,
        notificationErrorTitle: 'Resource not found',
        notificationErrorDescription: 'The requested resource does not exist',
        runtimeErrorDescription: err.message,
        disableErrorDescription: 'Please check that all resources are valid',
      });
    }

    return res.status(500).json({
      severityCode: 4000,
      notificationErrorTitle: 'Internal server error',
      notificationErrorDescription: 'An error occurred while processing the request',
      runtimeErrorDescription: err.message,
    });
  }
}
```

### tools/$0/blocks/$1/fields.js

```javascript
/**
 * [Block Name] - Field Handlers
 * Custom field handlers for the $1 block.
 *
 * IMPORTANT: Only create field handlers for custom fields.
 * Monday.com built-in fields (board, item, connect boards column, etc.)
 * don't need handlers - they're handled automatically.
 */

import { createApiClient, logger } from '@workflow-toolkit/shared';

const TAG = '$1_fields';

/**
 * Example field handler for custom column selection
 * Used when you need to show columns from a specific board
 *
 * Monday.com sends payload like:
 * {
 *   "payload": {
 *     "dependencyData": {
 *       "boardId_A": { "value": 12345 }
 *     }
 *   }
 * }
 */
export async function getColumnsHandler(req, res) {
  logger.info('getColumns called', TAG);

  const { shortLivedToken } = req.session;
  const payload = req.body?.payload;
  const dependencyData = payload?.dependencyData;
  const inputFields = payload?.inputFields;

  // Extract board ID from dependency data
  // Check multiple possible locations as Monday.com may send it differently
  const boardId = dependencyData?.boardId_A?.value
    || dependencyData?.boardId_A
    || payload?.boardId_A?.value
    || payload?.boardId_A
    || inputFields?.boardId_A?.value
    || inputFields?.boardId_A;

  logger.info('Extracted boardId', TAG, { boardId });

  if (!boardId) {
    logger.warn('No boardId found, returning empty array', TAG);
    return res.status(200).send([]);
  }

  try {
    const apiClient = createApiClient(shortLivedToken);

    const query = `
      query GetColumns($boardId: [ID!]!) {
        boards(ids: $boardId) {
          columns {
            id
            title
            type
          }
        }
      }
    `;

    const data = await apiClient.query(query, { boardId: [String(boardId)] });

    const board = data?.boards?.[0];
    if (!board) {
      logger.warn('Board not found', TAG, { boardId });
      return res.status(200).send([]);
    }

    // Filter and map columns as needed
    const columns = board.columns.map(col => ({
      title: col.title,
      value: col.id
    }));

    logger.info('Columns retrieved', TAG, { count: columns.length });
    return res.status(200).send(columns);
  } catch (err) {
    logger.error('Failed to get columns', TAG, { boardId, error: err.message });
    return res.status(500).send({ message: 'internal server error' });
  }
}

/**
 * Export field handlers
 * Map the field handler name (used in remote options URL) to the function
 *
 * Remote options URL format: /monday/get_columns
 * The auto-loader registers handlers at: POST /monday/{handler_name}
 */
export const fieldHandlers = {
  'get_columns': getColumnsHandler,
  // Add more field handlers as needed
};
```

## Step 4: Install Dependencies

After creating the files, run:

```bash
pnpm install
```

## Step 5: Verify Auto-Discovery

Start the server and check logs for block discovery:

```bash
pnpm dev
```

Look for: `Block loaded: $1`

## Monday.com Developer Center Configuration

After creating the block, configure it in the Developer Center:

### Built-in Field Types

Use these built-in field types when possible (no custom field needed):

| Field Type | Field Key | Description |
|------------|-----------|-------------|
| Board | `boardId_A` | Source board selection |
| Item | `itemId` | Item selection |
| Connect Boards Column | `connectBoardsColumnId` | Connect column selection |
| Connected Board | `connectedBoardId` | Auto-provided when connect column selected |
| Text | `newValue` | Free text input |

### Custom Field Configuration

For custom fields (like column selectors), create a Field for automation block:

1. Go to **Features** > **Create feature** > **Field for automation block**
2. Configure:
   - **Field name**: Your Field Name
   - **Field key**: `yourFieldKey`
   - **Schema type**: String
   - **Remote options URL**: `https://<your-server>/monday/get_columns`
3. Add **Mandatory dependency** on the field that provides context (e.g., `boardId_A` or `connectedBoardId`)

### Action Block Configuration

1. Go to **Features** > **Create feature** > **Automation block**
2. Set **Run URL**: `https://<your-server>/monday/execute_action/$1`
3. Add input fields in order (dependencies must come before dependents)
4. Add output fields

## Coding Conventions

Follow these conventions from CLAUDE.md:

- **ES6 Modules** - Use `import/export` syntax
- **Async/Await** - For all API calls
- **Naming:**
  - kebab-case for files/blocks
  - camelCase for functions
  - UPPER_SNAKE_CASE for constants
- **Logging:** Use tagged logging with `const TAG = 'module_name'`

## Response Formats

**Success:**
```javascript
{ outputFields: { fieldName: value } }
```

**Error:**
```javascript
{
  severityCode: 4000,  // 4000=error, 6000=not found (disables automation)
  notificationErrorTitle: "User-friendly title",
  notificationErrorDescription: "User-friendly message",
  runtimeErrorDescription: "Technical details"
}
```

## Input Field Extraction

Always extract values using the helper:
```javascript
import { extractFieldValues } from '@workflow-toolkit/shared';
const { boardId_A, itemId } = extractFieldValues(inputFields, ['boardId_A', 'itemId']);
```

This handles both direct values and `{value: ...}` wrapped values from Monday.com.

## Environment Setup

Ensure `.env` file exists in project root with:
```
MONDAY_SIGNING_SECRET=your_signing_secret_from_developer_center
PORT=8080
DEBUG=true
```

Get the signing secret from: **Developer Center** > Your App > **OAuth** > **Signing Secret**

## API Endpoints

After creation, the block will be available at:

- `POST /monday/execute_action/$1` - Execute the action
- `POST /monday/{field_handler_name}` - Field handlers (if defined)

## Testing

1. Start server: `pnpm dev`
2. Start tunnel: `ngrok http 8080`
3. Update URLs in Developer Center with tunnel URL
4. Create a workflow in Monday.com and test

## Next Steps

After creating the tool:

1. Customize the input/output fields in `block.config.js`
2. Implement the business logic in `action.js`
3. Add any custom field handlers in `fields.js` (only for non-built-in fields)
4. Create a `CONFIGURATION.md` file documenting Developer Center setup
5. Test the block in a workflow

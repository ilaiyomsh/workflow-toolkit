---
name: add-tool
description: Add a new tool with blocks to the Workflow Toolkit. Use when the user wants to create a new Monday.com workflow automation tool or add a new block to an existing tool.
argument-hint: [tool-name] [block-name]
allowed-tools: Read, Write, Bash, Glob, Grep
---

# Add a New Tool to the Workflow Toolkit

Create clean, compact tools using shared utilities from `@workflow-toolkit/shared`.

## Arguments

- `$0` - Tool name (kebab-case, e.g., `email-sender`)
- `$1` - Block name (kebab-case, e.g., `send-email`)

## Available Shared Functions

**IMPORTANT:** Use these shared functions - don't reimplement them in tools!

```javascript
import {
  // API & Logging
  createApiClient,        // Create Monday.com API client
  logger,                 // Tagged logging

  // Field Extraction
  extractFieldValues,     // Extract values from inputFields

  // Column Operations (use these!)
  getColumnType,          // Get column type from board
  formatValueForColumnType, // Format value for any column type (20+ types)
  updateColumnValue,      // Update a column value via API

  // Field Handlers
  getFormulaColumns,      // Get formula columns from board
} from '@workflow-toolkit/shared';
```

## Project Structure

```
tools/[tool-name]/
├── package.json
├── tool.config.js
└── blocks/[block-name]/
    ├── block.config.js
    ├── index.js
    ├── action.js       # Keep minimal - use shared functions
    └── fields.js       # Only for custom fields
```

## Step 1: Check if Tool Exists

```bash
ls -la tools/$0 2>/dev/null || echo "Tool does not exist"
```

## Step 2: Create Tool (if new)

### tools/$0/package.json

```json
{
  "name": "@workflow-toolkit/$0",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "@workflow-toolkit/shared": "workspace:*"
  }
}
```

### tools/$0/tool.config.js

```javascript
export default {
  name: '$0',
  displayName: '[Display Name] Tool',
  description: '[Description]',
  version: '1.0.0',
};
```

## Step 3: Create Block

### tools/$0/blocks/$1/block.config.js

```javascript
export default {
  name: '$1',
  displayName: '[Display Name]',
  description: '[Description]',
  version: '1.0.0',
  inputFields: [
    { key: 'boardId_A', type: 'board', builtIn: true },
    { key: 'itemId', type: 'item', builtIn: true },
  ],
  outputFields: [
    { key: 'result', type: 'text' },
  ],
};
```

### tools/$0/blocks/$1/index.js

```javascript
export { executeAction } from './action.js';
export { fieldHandlers } from './fields.js';

export const metadata = {
  name: '$1',
  displayName: '[Display Name]',
  description: '[Description]',
  version: '1.0.0',
};
```

### tools/$0/blocks/$1/action.js

```javascript
/**
 * [Block Name] Action
 */

import {
  createApiClient,
  logger,
  extractFieldValues,
  getColumnType,           // Use shared function
  formatValueForColumnType, // Use shared function
  updateColumnValue,        // Use shared function
} from '@workflow-toolkit/shared';

const TAG = '$1_action';

export async function executeAction(req, res) {
  const { shortLivedToken } = req.session;
  const { inputFields } = req.body.payload;

  const { boardId_A, itemId } = extractFieldValues(inputFields, ['boardId_A', 'itemId']);
  const boardId = boardId_A;

  logger.info('Action received', TAG, { boardId, itemId });

  if (!boardId || !itemId) {
    return res.status(400).json({
      severityCode: 4000,
      notificationErrorTitle: 'Missing required fields',
      notificationErrorDescription: 'Please provide all required fields',
    });
  }

  try {
    const apiClient = createApiClient(shortLivedToken);

    // Example: Update a column value using shared functions
    // const columnType = await getColumnType(apiClient, boardId, columnId);
    // const formattedValue = formatValueForColumnType(columnType, value);
    // await updateColumnValue(apiClient, boardId, itemId, columnId, formattedValue);

    // TODO: Implement your specific logic here
    const result = 'success';

    return res.status(200).json({ outputFields: { result } });
  } catch (err) {
    logger.error('Action failed', TAG, { error: err.message });
    return res.status(500).json({
      severityCode: 4000,
      notificationErrorTitle: 'Error',
      notificationErrorDescription: err.message,
    });
  }
}
```

### tools/$0/blocks/$1/fields.js

```javascript
/**
 * [Block Name] - Field Handlers
 * Only create handlers for custom fields (not built-in Monday.com fields)
 */

import { createApiClient, logger } from '@workflow-toolkit/shared';

const TAG = '$1_fields';

// Example: Custom column selector
export async function getColumnsHandler(req, res) {
  const { shortLivedToken } = req.session;
  const { dependencyData } = req.body?.payload || {};

  const boardId = dependencyData?.boardId_A?.value || dependencyData?.boardId_A;

  if (!boardId) return res.status(200).send([]);

  try {
    const apiClient = createApiClient(shortLivedToken);
    const data = await apiClient.query(`
      query ($boardId: [ID!]!) {
        boards(ids: $boardId) {
          columns { id title type }
        }
      }
    `, { boardId: [String(boardId)] });

    const columns = data?.boards?.[0]?.columns?.map(col => ({
      title: col.title,
      value: col.id
    })) || [];

    return res.status(200).send(columns);
  } catch (err) {
    logger.error('Failed to get columns', TAG, { error: err.message });
    return res.status(500).send({ message: 'internal server error' });
  }
}

export const fieldHandlers = {
  'get_columns': getColumnsHandler,
};
```

## Step 4: Install & Verify

```bash
pnpm install
pnpm dev
# Look for: Block loaded: $1
```

## Monday.com Developer Center

### Built-in Field Types (no custom field needed)

| Type | Key | Description |
|------|-----|-------------|
| Board | `boardId_A` | Board selection |
| Item | `itemId` | Item selection |
| Connect Boards Column | `connectBoardsColumnId` | Connect column |
| Connected Board | `connectedBoardId` | Auto-provided |
| Text | `newValue` | Free text |

### Custom Field Setup

1. **Features** > **Create feature** > **Field for automation block**
2. Set **Remote options URL**: `https://<server>/monday/get_columns`
3. Add **Mandatory dependency** on `boardId_A` or `connectedBoardId`

### Action Block Setup

1. **Features** > **Create feature** > **Automation block**
2. **Run URL**: `https://<server>/monday/execute_action/$1`

## Supported Column Types (formatValueForColumnType)

The shared `formatValueForColumnType` function handles all these:

| Type | Input Format | Example |
|------|--------------|---------|
| status | label or index | `"Done"` or `"1"` |
| text | string | `"Hello"` |
| long_text | string | `"Long text"` |
| numbers | string | `"42"` |
| date | date string | `"24 January 2026"` |
| checkbox | boolean string | `"true"` |
| rating | number string | `"5"` |
| dropdown | comma-separated | `"Option1, Option2"` |
| email | email | `"test@example.com"` |
| phone | code:number | `"US:+12025550169"` |
| link | url\|text | `"https://example.com\|Click"` |
| timeline | from,to | `"2026-01-01,2026-01-31"` |
| hour | HH:MM | `"16:42"` |
| week | start,end | `"2026-01-06,2026-01-12"` |
| location | lat,lng,addr | `"29.97,31.13,Cairo"` |
| country | code:name | `"US:United States"` |
| people | user IDs | `"123456,789012"` |
| tags | tag IDs | `"295026,295064"` |

## Environment

`.env` in project root:
```
MONDAY_SIGNING_SECRET=your_secret
PORT=8080
```

## Testing

```bash
pnpm dev          # Start server
ngrok http 8080   # Create tunnel
# Update URLs in Developer Center, test workflow
```

# Update Connected Items Block - Configuration Guide

This guide explains how to configure the **Update Connected Items** block in the Monday.com Developer Center so it can be used in workflows.

## Overview

The Update Connected Items block allows users to update a column value on **ALL items** connected via a Connect Boards column. This solves the Monday.com limitation where native workflows only work with the first connected item.

## Prerequisites

- Access to the [Monday.com Developer Center](https://monday.com/developers/apps)
- Your app's Run URL configured and accessible (e.g., via ngrok for development)
- The Workflow ToolKit server running (`pnpm dev`)

---

## Field Configuration Summary

This block uses Monday.com's **built-in field types** for most fields, which simplifies configuration and provides automatic board/item/column resolution.

| Field Key | Type | Source |
|-----------|------|--------|
| `boardId_A` | Board | Built-in (Monday.com) |
| `itemId` | Item | Built-in (Monday.com) |
| `connectBoardsColumnId` | Connect Boards Column | Built-in (Monday.com) |
| `connectedBoardId` | Connected Board | Built-in (Monday.com) - auto-provided |
| `targetColumnId` | Custom Field | Remote options URL |
| `newValue` | Text | Built-in (Monday.com) |

---

## Step 1: Create Custom Field for Target Column

Only one custom field needs to be created - the Target Column selector.

### 1.1 Create the "Target Column" Field

This field lets users select which column to update on the connected items.

1. Go to **Developer Center** > Your App > **Features** tab
2. Click **Create feature** > **Field for automation block** > **Create**
3. Configure the field:

| Setting | Value |
|---------|-------|
| **Field name** | Target Column |
| **Field description** | Select the column to update on connected items |
| **Default field key** | `targetColumnId` |
| **Schema type** | String |
| **Remote options URL** | `https://your-server.com/monday/get_target_columns` |

4. Add **Mandatory dependency**:
   - **Field type**: Connected Board
   - **Target field key**: `connectedBoardId`

5. Click **Save**

---

## Step 2: Create the Action Block

1. Go to **Developer Center** > Your App > **Features** tab
2. Click **Create feature** > **Automation block** > **Create**
3. Configure the block:

### Basic Details

| Setting | Value |
|---------|-------|
| **Block name** | Update Connected Items |
| **Block description** | Updates a column on all items connected via a Connect Boards column |
| **Block type** | Action |

### Run URL

Set the Run URL to your server's action endpoint:

```
https://your-server.com/monday/execute_action/update-connected-items
```

### Input Fields

Add the following input fields in order:

#### Field 1: Board (Built-in)

| Setting | Value |
|---------|-------|
| **Field type** | Board (predefined) |
| **Field key** | `boardId_A` |
| **Field title** | Board |
| **Is main field?** | Yes |

#### Field 2: Item (Built-in)

| Setting | Value |
|---------|-------|
| **Field type** | Item (predefined) |
| **Field key** | `itemId` |
| **Field title** | Item |

#### Field 3: Connect Boards Column (Built-in)

| Setting | Value |
|---------|-------|
| **Field type** | Connect Boards Column (predefined) |
| **Field key** | `connectBoardsColumnId` |
| **Field title** | Connect Boards Column |
| **Constraints** | Depends on: boardId_A |

#### Field 4: Connected Board (Built-in)

| Setting | Value |
|---------|-------|
| **Field type** | Connected Board (predefined) |
| **Field key** | `connectedBoardId` |
| **Field title** | Connected Board |
| **Constraints** | Depends on: connectBoardsColumnId |

**Note:** This field is automatically populated by Monday.com based on the selected Connect Boards column. It provides the target board ID without needing to query the API.

#### Field 5: Target Column (Custom Field)

| Setting | Value |
|---------|-------|
| **Field type** | Target Column (custom field created in Step 1.1) |
| **Field key** | `targetColumnId` |
| **Field title** | Column to Update |
| **Constraints** | Depends on: connectedBoardId |

#### Field 6: New Value (Built-in)

| Setting | Value |
|---------|-------|
| **Field type** | Text (predefined) |
| **Field key** | `newValue` |
| **Field title** | New Value |
| **Placeholder** | Enter the value to set |

### Output Fields

Add the following output fields:

#### Output 1: Updated Count

| Setting | Value |
|---------|-------|
| **Field type** | Number |
| **Field key** | `updatedCount` |
| **Field title** | Updated Items Count |

#### Output 2: Item IDs

| Setting | Value |
|---------|-------|
| **Field type** | Text |
| **Field key** | `itemIds` |
| **Field title** | Updated Item IDs |

4. Click **Save**

---

## Step 3: Publish and Test

### 3.1 Publish Your App Version

1. Go to **App Versions** in the Developer Center
2. Create a new version or update the existing draft
3. Publish the version to make it available

### 3.2 Install in a Workspace

1. Go to a Monday.com workspace
2. Open the **Apps Marketplace**
3. Find your app and install it

### 3.3 Test in Workflow Builder

1. Open a board with a Connect Boards column
2. Go to **Automate** > **Workflow Builder**
3. Create a new workflow with a trigger (e.g., "When status changes")
4. Add your **Update Connected Items** action block
5. Configure the fields:
   - Select the board
   - Select the triggering item
   - Choose the Connect Boards column
   - Choose which column to update on connected items
   - Enter the new value
6. Save and test the workflow

---

## API Reference

### Remote Options Endpoints

#### GET Connect Columns (Optional - for debugging)

Returns all Connect Boards columns from a board. Note: This is provided for debugging, but the built-in Connect Boards Column field handles this automatically.

**Endpoint:** `POST /monday/get_connect_columns`

**Request Payload:**
```json
{
  "payload": {
    "dependencyData": {
      "boardId_A": {
        "value": 12345678
      }
    }
  }
}
```

**Response:**
```json
[
  { "title": "Linked Projects", "value": "connect_boards_column_id" },
  { "title": "Related Tasks", "value": "connect_boards_column_id_2" }
]
```

#### GET Target Columns

Returns all writable columns from the target board (connected board). Uses `connectedBoardId` which is automatically provided by Monday.com's built-in field.

**Endpoint:** `POST /monday/get_target_columns`

**Request Payload:**
```json
{
  "payload": {
    "dependencyData": {
      "connectedBoardId": {
        "value": 87654321
      }
    }
  }
}
```

**Response:**
```json
[
  { "title": "Status (status)", "value": "status_column_id" },
  { "title": "Priority (status)", "value": "priority_column_id" },
  { "title": "Notes (text)", "value": "text_column_id" }
]
```

### Action Endpoint

**Endpoint:** `POST /monday/execute_action/update-connected-items`

**Request Payload (from Monday.com):**
```json
{
  "payload": {
    "blockKind": "action",
    "inputFields": {
      "boardId_A": 12345678,
      "itemId": 98765432,
      "connectBoardsColumnId": "board_relation_abc123",
      "connectedBoardId": 87654321,
      "targetColumnId": "status_column_id",
      "newValue": "Done"
    },
    "recipeId": 123456,
    "integrationId": 789012
  }
}
```

**Note:** Monday.com's built-in fields provide values directly (not wrapped in `{ "value": ... }` objects).

**Success Response:**
```json
{
  "outputFields": {
    "updatedCount": 5,
    "itemIds": "111,222,333,444,555"
  }
}
```

**Error Response:**
```json
{
  "severityCode": 4000,
  "notificationErrorTitle": "Update Failed",
  "notificationErrorDescription": "Could not update the connected items",
  "runtimeErrorDescription": "Column 'status_xyz' not found on board 12345"
}
```

---

## Supported Column Types

The block automatically formats values based on the target column type:

| Column Type | Value Format | Example |
|-------------|--------------|---------|
| `status` | Label name | `"Done"`, `"Working on it"` |
| `text` | Plain text | `"Hello World"` |
| `numbers` | Numeric string | `"42"`, `"3.14"` |
| `date` | ISO date | `"2024-01-28"` |
| `checkbox` | Boolean string | `"true"`, `"false"`, `"yes"`, `"no"` |
| `rating` | Number 1-5 | `"5"` |
| `dropdown` | Comma-separated labels | `"Option 1, Option 2"` |
| `email` | Email address | `"user@example.com"` |
| `phone` | Phone number | `"+1-555-123-4567"` |
| `link` | URL | `"https://example.com"` |
| `timeline` | Date range | `"2024-01-01,2024-01-31"` |

---

## Error Handling

The block uses Monday.com's standard error handling:

| Severity Code | Meaning | When Used |
|---------------|---------|-----------|
| `4000` | Medium - Retry possible | API errors, invalid values |
| `6000` | High - Disable automation | Resource not found, permanent failures |

Errors are logged in the **Automation Activity Log** for troubleshooting.

---

## Troubleshooting

### "Could not load fields" Error

- Ensure your server is running and accessible
- Verify the Remote Options URL is correct
- Check server logs for authentication errors

### No Target Columns Showing

- Select a Connect Boards column first (connected board is a dependency)
- Ensure the connected board has writable columns
- Verify `connectedBoardId` is correctly configured as a dependency for the Target Column field

### Updates Not Applying

- Check the Activity Log for error details
- Verify the column type matches the value format
- Ensure you have write permissions on the connected board

### Built-in Fields Not Appearing

- Ensure you're using the correct built-in field types from Monday.com
- The Connect Boards Column field type automatically filters to show only connect columns
- The Connected Board field type automatically resolves based on the selected connect column

---

## References

- [Monday.com Workflow Blocks Documentation](https://developer.monday.com/apps/docs/workflow-blocks)
- [Custom Fields Reference](https://developer.monday.com/apps/docs/custom-field-recipes)
- [Actions Reference](https://developer.monday.com/apps/docs/workflows-actions)
- [Error Handling](https://developer.monday.com/apps/docs/error-handling)
- [List Fields](https://developer.monday.com/apps/docs/list)

# Workflow ToolKit

A Monday.com Workflow Toolkit providing automation action blocks. Uses a plugin-based architecture where tools contain related blocks.

## Overview

This is a pnpm workspace monorepo that provides custom Monday.com workflow blocks. The project uses auto-discovery to load tools and blocks at startup - no manual registration required.

**Tech Stack:** Node.js (>=18), Express.js, ES6 Modules, pnpm workspaces

## Architecture

```
Monday.com → Express Server → Auth Middleware → Auto-Loader →
Tool/Block Discovery → Block Handler (Action/Fields) → Monday API → Response
```

## Project Structure

```
workflow-toolkit/
├── package.json                    # Workspace root
├── pnpm-workspace.yaml
├── .env.example
│
├── packages/                       # Shared packages
│   ├── formula-engine/             # @workflow-toolkit/formula-engine
│   │   ├── package.json
│   │   └── src/
│   │       ├── index.js            # Main entry point
│   │       ├── tokenizer.js        # Lexical analysis
│   │       ├── parser.js           # AST generation
│   │       ├── evaluator.js        # AST evaluation
│   │       ├── column-value-extractor.js
│   │       ├── functions/          # Formula functions (text, numeric, logical, date)
│   │       └── resolver/           # Recursive value resolution
│   │
│   └── shared/                     # @workflow-toolkit/shared
│       ├── package.json
│       └── src/
│           ├── index.js            # Main entry point
│           ├── middlewares/        # authentication, request-logger
│           ├── services/           # monday-api, logger
│           └── helpers/            # secret-store, field-extractors
│
├── server/                         # @workflow-toolkit/server
│   ├── package.json
│   └── src/
│       ├── app.js                  # Express entry point
│       ├── routes/
│       │   ├── index.js            # Main router
│       │   ├── auto-loader.js      # Tool/block auto-discovery
│       │   ├── actions.js          # Action endpoint router
│       │   └── fields.js           # Field endpoint router
│       └── constants/
│
├── tools/                          # All tools live here
│   └── formula/                    # Formula Tool
│       ├── package.json            # @workflow-toolkit/formula
│       ├── tool.config.js          # Tool metadata
│       └── blocks/
│           └── formula-to-text/    # Block
│               ├── block.config.js # Block metadata
│               ├── index.js        # Exports
│               ├── action.js       # Action handler
│               └── fields.js       # Field handlers
│
└── docs/                           # Documentation
```

## Key Files

- `server/src/app.js` - Express server entry point (port 8080)
- `server/src/routes/auto-loader.js` - Auto-discovers tools and blocks
- `packages/formula-engine/` - Formula parsing engine
- `packages/shared/` - Shared utilities, middlewares, services
- `tools/formula/blocks/formula-to-text/` - Formula to text conversion block

## Coding Conventions

- **ES6 Modules** - Use `import/export` syntax
- **Async/Await** - For all API calls
- **Naming:** kebab-case for files/blocks, camelCase for functions, UPPER_SNAKE_CASE for constants
- **Logging:** Use tagged logging with `const TAG = 'module_name'`

**Response Format (Monday.com Standard):**
```javascript
// Success
{ outputFields: { fieldName: value } }

// Error
{
  severityCode: 4000,  // 4000=error, 6000=not found
  notificationErrorTitle: "User-friendly title",
  notificationErrorDescription: "User-friendly message",
  runtimeErrorDescription: "Technical details"
}
```

**Input Field Extraction Pattern:**
```javascript
const value = inputFields.fieldName?.value ?? inputFields.fieldName;
```

## API Endpoints

- `POST /monday/execute_action` - Universal action endpoint
- `POST /monday/execute_action/:blockName` - Specific block action
- `POST /monday/:fieldName` - Universal field handler
- `POST /monday/fields/:blockName/:fieldName` - Specific block field
- `GET /health` - Health check

## Common Tasks

**Install Dependencies:**
```bash
pnpm install
```

**Run Development Server:**
```bash
pnpm dev      # Server + tunnel with consistent URL
pnpm server   # Server only (no tunnel)
pnpm tunnel   # Tunnel only
```

**Deploy & Monitor:**
```bash
pnpm deploy      # Push to monday-code
pnpm logs        # Stream console logs
pnpm logs:http   # Stream HTTP logs
```

**Add a New Tool:**
1. Create `tools/my-tool/` directory
2. Add `tool.config.js` with metadata
3. Add `package.json` with dependencies
4. Add `blocks/` subdirectory with blocks
5. Run `pnpm install`
6. Restart server - auto-discovered!

**Add a New Block to Existing Tool:**
1. Create `tools/my-tool/blocks/my-block/` directory
2. Add `block.config.js`, `index.js`, `action.js`, `fields.js`
3. Restart server - auto-discovered!

## Environment Variables

- `MONDAY_SIGNING_SECRET` - JWT signing secret from Monday dev center
- `PORT` - Server port (default: 8080)
- `DEBUG` - Set to 'true' for debug logging

## Formula Engine

The formula-engine package (`@workflow-toolkit/formula-engine`) provides:
- **Tokenizer** - Breaks formulas into tokens
- **Parser** - Builds AST from tokens
- **Evaluator** - Evaluates AST with values
- **Resolver** - Recursively resolves formula/mirror columns

Supported functions:
- **Text:** CONCATENATE, LEFT, RIGHT, LEN, LOWER, UPPER, TRIM, REPLACE, SUBSTITUTE
- **Numeric:** SUM, AVERAGE, MAX, MIN, COUNT, ABS, ROUND, SQRT, POWER
- **Logical:** IF, AND, OR, XOR, SWITCH, EXACT
- **Date:** TODAY, FORMAT_DATE, DAYS, ADD_DAYS, WORKDAYS

Column references use `{columnId}` or `{columnId#field}` syntax.

## Packages

| Package | Description |
|---------|-------------|
| `@workflow-toolkit/formula-engine` | Formula parsing and evaluation |
| `@workflow-toolkit/shared` | Shared utilities, middlewares, services |
| `@workflow-toolkit/server` | Express server |
| `@workflow-toolkit/formula` | Formula tool with blocks |

## Skills (Claude Code)

Available skills in `.claude/skills/`:

| Skill | Command | Description |
|-------|---------|-------------|
| `add-tool` | `/add-tool [tool] [block]` | Create new tool or block |
| `mapps` | `/mapps [command]` | Monday CLI reference & helpers |

## Monday CLI (mapps)

App ID: `10787086` | Tunnel: `https://10787086-*.apps-tunnel.monday.app`

```bash
# Common commands
mapps tunnel:create -p 8080 -a 10787086   # Create tunnel
mapps code:push -a 10787086               # Deploy
mapps code:logs -i 10787086 -s live -t console  # View logs
mapps app:list                            # List apps
```

See `/mapps` skill for complete reference.

## Documentation

- `DOCS/` - Monday.com workflow documentation

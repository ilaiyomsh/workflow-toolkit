---
name: mapps
description: Monday.com CLI (mapps) commands reference and helpers. Use when working with tunnels, deployments, logs, environment variables, or any mapps CLI operations.
argument-hint: [command]
allowed-tools: Bash, Read, Write
---

# Monday.com CLI (mapps) Reference

Quick reference for the `@mondaycom/apps-cli` (mapps) command-line tool.

## Current Project Configuration

- **App ID:** `10787086` (Workflow ToolKit)
- **Port:** `8080`
- **Tunnel URL:** `https://10787086-*.apps-tunnel.monday.app`

## Quick Commands

### Development
```bash
pnpm dev          # Server + tunnel (auto-reload)
pnpm server       # Server only
pnpm tunnel       # Tunnel only
```

### Deployment
```bash
pnpm deploy       # Push to monday-code
pnpm logs         # Stream console logs
pnpm logs:http    # Stream HTTP logs
```

## Command Reference

### Tunnel Management

Create local development tunnel:
```bash
mapps tunnel:create -p 8080 -a 10787086
```

| Flag | Description |
|------|-------------|
| `-p, --port` | Port to forward (default: 8080) |
| `-a, --appId` | App ID for consistent tunnel URL |

### Code Deployment

Push code to monday-code hosting:
```bash
mapps code:push -a 10787086
mapps code:push -a 10787086 -f          # Force to live
mapps code:push -a 10787086 -c          # Client-side (CDN)
mapps code:push -d ./dist -a 10787086   # Specific directory
```

| Flag | Description |
|------|-------------|
| `-a, --appId` | Target app ID |
| `-i, --appVersionId` | Specific version |
| `-d, --directoryPath` | Project directory |
| `-f, --force` | Force push to live |
| `-c, --client-side` | Push to CDN |
| `-z, --region` | Region (us\|eu\|au) |

### Logs

Stream deployment logs:
```bash
mapps code:logs -i 10787086 -s live -t console
mapps code:logs -i 10787086 -s live -t http
mapps code:logs -i 10787086 -s History -f "01/01/2026 00:00" -e "01/31/2026 23:59"
```

| Flag | Description |
|------|-------------|
| `-i, --appVersionId` | App version ID |
| `-s, --eventSource` | `live` or `History` |
| `-t, --logsType` | `console` or `http` |
| `-f, --logsStartDate` | Start date (MM/DD/YYYY HH:mm) |
| `-e, --logsEndDate` | End date (MM/DD/YYYY HH:mm) |
| `-r, --logSearchFromText` | Regex filter |

### Environment Variables

Manage environment variables:
```bash
mapps code:env -i 10787086 -m list-keys
mapps code:env -i 10787086 -m set -k NODE_ENV -v production
mapps code:env -i 10787086 -m delete -k OLD_VAR
```

| Flag | Description |
|------|-------------|
| `-i, --appId` | App ID |
| `-m, --mode` | `list-keys`, `set`, `delete` |
| `-k, --key` | Variable key |
| `-v, --value` | Variable value |

### Secrets

Manage secret variables:
```bash
mapps code:secret -i 10787086 -m list-keys
mapps code:secret -i 10787086 -m set -k API_KEY -v "secret123"
mapps code:secret -i 10787086 -m delete -k OLD_SECRET
```

### App Management

```bash
mapps app:list                           # List all apps
mapps app:create                         # Create new app
mapps app:deploy                         # Deploy via manifest
mapps app:promote -a 10787086            # Promote draft to live
mapps app:scaffold ./ quickstart-react   # Scaffold from template
```

### App Features

```bash
mapps app-features:list -i <versionId>
mapps app-features:create -a 10787086
mapps app-features:build -i <versionId>
```

### App Versions

```bash
mapps app-version:list -a 10787086
mapps app-version:builds -i <versionId>
```

### Scheduler (Cron Jobs)

```bash
mapps scheduler:create -a 10787086
mapps scheduler:list -a 10787086
mapps scheduler:run -a 10787086 -j <jobId>
mapps scheduler:update -a 10787086 -j <jobId>
mapps scheduler:delete -a 10787086 -j <jobId>
```

### Storage

```bash
mapps storage:search -a 10787086 -c <accountId>
mapps storage:export -a 10787086 -c <accountId>
mapps storage:remove-data -a 10787086 -c <accountId>
```

### Manifest

```bash
mapps manifest:export -a 10787086 -v <versionId>
mapps manifest:import -a 10787086 -p ./manifest.json
```

### Database

```bash
mapps database:connection-string -a 10787086
```

### API Generation

```bash
mapps api:generate    # Prepare for custom GraphQL queries
```

## Global Flags

All commands support:
| Flag | Description |
|------|-------------|
| `--verbose` | Advanced logging |
| `--print-command` | Show executed command |
| `-z, --region` | Region (us\|eu\|au) |

## Initial Setup

If mapps is not configured:
```bash
# Install globally
npm install -g @mondaycom/apps-cli

# Verify installation
mapps --version

# Initialize with API token
mapps init -t <YOUR_API_TOKEN>

# Or create local config
mapps init -t <YOUR_API_TOKEN> -l
```

Get API token from: **monday.com** > **Profile** > **Developers** > **My Access Tokens**

## Deployment Workflow

### Standard Deployment
```bash
# 1. Check current status
mapps code:status -i 10787086

# 2. Push code
mapps code:push -a 10787086

# 3. Monitor logs
mapps code:logs -i 10787086 -s live -t console

# 4. Verify deployment
mapps code:status -i 10787086
```

### Promote to Live
```bash
# 1. Test in draft
mapps code:push -a 10787086

# 2. Verify everything works
mapps code:logs -i 10787086 -s live -t console

# 3. Promote to live
mapps app:promote -a 10787086
```

## Troubleshooting

### "command not found: mapps"
```bash
npm install -g @mondaycom/apps-cli
```

### "Access token is missing"
```bash
mapps init -t <YOUR_API_TOKEN>
```

### Tunnel not connecting
```bash
# Kill existing tunnel processes
lsof -ti:8080 | xargs kill -9

# Restart tunnel
mapps tunnel:create -p 8080 -a 10787086
```

### Deployment failing
```bash
# Check logs for errors
mapps code:logs -i 10787086 -s live -t console --verbose

# Verify environment variables
mapps code:env -i 10787086 -m list-keys
```

## Resources

- [CLI Documentation](https://developer.monday.com/apps/docs/command-line-interface-cli)
- [Monday Code Hosting](https://developer.monday.com/apps/docs/get-started)
- [GitHub Repository](https://github.com/mondaycom/monday-apps-cli)
- [npm Package](https://www.npmjs.com/package/@mondaycom/apps-cli)

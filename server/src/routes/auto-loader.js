/**
 * Auto-Loader
 * Automatically discovers and loads tools and blocks from the tools/ directory.
 *
 * Directory Structure Expected:
 * tools/
 *   └── tool-name/
 *       ├── tool.config.js      # Tool metadata
 *       └── blocks/
 *           └── block-name/
 *               ├── block.config.js  # Block metadata
 *               ├── index.js         # Exports (executeAction, fieldHandlers, metadata)
 *               ├── action.js        # Action handler
 *               └── fields.js        # Field handlers
 */

import { readdir, stat } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { logger } from '@workflow-toolkit/shared';

const TAG = 'auto_loader';

// Get the project root (parent of server/)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '../../..');
const TOOLS_DIR = join(PROJECT_ROOT, 'tools');

/**
 * Registry of all loaded tools and blocks
 */
export const registry = {
  tools: new Map(),     // toolName -> { config, blocks }
  blocks: new Map(),    // blockName -> { toolName, module, config }
};

/**
 * Loads all tools and their blocks from the tools/ directory.
 */
export async function loadTools() {
  logger.info('Loading tools from directory', TAG, { toolsDir: TOOLS_DIR });

  try {
    const toolDirs = await readdir(TOOLS_DIR);

    for (const toolDir of toolDirs) {
      const toolPath = join(TOOLS_DIR, toolDir);
      const toolStat = await stat(toolPath);

      if (!toolStat.isDirectory()) continue;

      try {
        await loadTool(toolDir, toolPath);
      } catch (err) {
        logger.error('Failed to load tool', TAG, { tool: toolDir, error: err.message });
      }
    }

    logger.info('Tools loaded successfully', TAG, {
      toolCount: registry.tools.size,
      blockCount: registry.blocks.size,
    });
  } catch (err) {
    if (err.code === 'ENOENT') {
      logger.warn('Tools directory not found', TAG, { toolsDir: TOOLS_DIR });
    } else {
      logger.error('Failed to load tools', TAG, { error: err.message });
    }
  }
}

/**
 * Loads a single tool and its blocks.
 */
async function loadTool(toolName, toolPath) {
  logger.debug('Loading tool', TAG, { tool: toolName });

  // Load tool config (optional)
  let toolConfig = { name: toolName };
  try {
    const configPath = join(toolPath, 'tool.config.js');
    const configModule = await import(configPath);
    toolConfig = configModule.default || configModule;
  } catch (err) {
    logger.debug('No tool.config.js found, using defaults', TAG, { tool: toolName });
  }

  const tool = {
    config: toolConfig,
    blocks: new Map(),
  };

  // Load blocks from blocks/ subdirectory
  const blocksPath = join(toolPath, 'blocks');

  try {
    const blockDirs = await readdir(blocksPath);

    for (const blockDir of blockDirs) {
      const blockPath = join(blocksPath, blockDir);
      const blockStat = await stat(blockPath);

      if (!blockStat.isDirectory()) continue;

      try {
        await loadBlock(toolName, blockDir, blockPath, tool);
      } catch (err) {
        logger.error('Failed to load block', TAG, {
          tool: toolName,
          block: blockDir,
          error: err.message,
          stack: err.stack,
        });
      }
    }
  } catch (err) {
    if (err.code !== 'ENOENT') {
      throw err;
    }
    logger.debug('No blocks directory found', TAG, { tool: toolName });
  }

  registry.tools.set(toolName, tool);
}

/**
 * Loads a single block.
 */
async function loadBlock(toolName, blockName, blockPath, tool) {
  logger.debug('Loading block', TAG, { tool: toolName, block: blockName });

  // Load block config (optional)
  let blockConfig = { name: blockName };
  try {
    const configPath = join(blockPath, 'block.config.js');
    const configModule = await import(configPath);
    blockConfig = configModule.default || configModule;
  } catch (err) {
    logger.debug('No block.config.js found, using defaults', TAG, { block: blockName });
  }

  // Load block module (index.js)
  const indexPath = join(blockPath, 'index.js');
  const blockModule = await import(indexPath);

  const block = {
    toolName,
    config: blockConfig,
    module: blockModule,
    executeAction: blockModule.executeAction,
    fieldHandlers: blockModule.fieldHandlers || {},
    metadata: blockModule.metadata || {},
  };

  tool.blocks.set(blockName, block);
  registry.blocks.set(blockName, block);

  logger.info('Block loaded', TAG, {
    tool: toolName,
    block: blockName,
    hasAction: !!block.executeAction,
    fieldCount: Object.keys(block.fieldHandlers).length,
  });
}

/**
 * Gets a block by its name.
 * @param {string} blockName - The block identifier
 * @returns {object|null} - The block or null if not found
 */
export function getBlock(blockName) {
  const block = registry.blocks.get(blockName);
  if (!block) {
    logger.warn('Block not found', TAG, { blockName });
    return null;
  }
  return block;
}

/**
 * Gets all registered block names.
 * @returns {string[]} - Array of block names
 */
export function getAllBlockNames() {
  return Array.from(registry.blocks.keys());
}

/**
 * Gets a specific field handler.
 * @param {string} blockName - The block identifier
 * @param {string} fieldName - The field handler name
 * @returns {Function|null} - The handler function or null
 */
export function getFieldHandler(blockName, fieldName) {
  const block = registry.blocks.get(blockName);
  if (!block?.fieldHandlers) {
    return null;
  }
  return block.fieldHandlers[fieldName] || null;
}

/**
 * Finds a field handler by name across all blocks.
 * @param {string} fieldName - The field handler name
 * @returns {{blockName: string, handler: Function}|null}
 */
export function findFieldHandler(fieldName) {
  for (const [blockName, block] of registry.blocks) {
    if (block.fieldHandlers?.[fieldName]) {
      return {
        blockName,
        handler: block.fieldHandlers[fieldName],
      };
    }
  }
  return null;
}

/**
 * Gets all field handlers from all blocks.
 * @returns {Array<{blockName: string, fieldName: string, handler: Function}>}
 */
export function getAllFieldHandlers() {
  const handlers = [];

  for (const [blockName, block] of registry.blocks) {
    if (block.fieldHandlers) {
      for (const [fieldName, handler] of Object.entries(block.fieldHandlers)) {
        handlers.push({
          blockName,
          fieldName,
          handler,
        });
      }
    }
  }

  return handlers;
}

/**
 * Logs registry status (useful for debugging)
 */
export function logRegistryStatus() {
  const toolCount = registry.tools.size;
  const blockCount = registry.blocks.size;
  const totalFieldHandlers = getAllFieldHandlers().length;

  logger.info('Registry Status', TAG, {
    toolCount,
    tools: Array.from(registry.tools.keys()),
    blockCount,
    blocks: getAllBlockNames(),
    totalFieldHandlers,
  });
}

export default {
  registry,
  loadTools,
  getBlock,
  getAllBlockNames,
  getFieldHandler,
  findFieldHandler,
  getAllFieldHandlers,
  logRegistryStatus,
};

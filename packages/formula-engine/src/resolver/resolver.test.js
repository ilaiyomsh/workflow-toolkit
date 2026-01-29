/**
 * Tests for the Formula Engine Resolver
 * 
 * Run with: node --experimental-vm-modules src/resolver/resolver.test.js
 * 
 * These tests use mock API clients to verify the resolver logic
 * without making actual API calls.
 */

import { resolveColumnValue, resolveColumnValueBatch, createSimpleCache } from './index.js';

// ============================================================================
// Mock API Client
// ============================================================================

function createMockApiClient(mockData) {
  return {
    async query(query, variables) {
      // Determine query type and return appropriate mock data
      if (query.includes('GetBoardColumns')) {
        const board = (mockData.boards && mockData.boards[variables.boardId]) || 
                      (mockData.boards && mockData.boards.boards && mockData.boards.boards.find(b => b.id === variables.boardId)) ||
                      (mockData.boards && mockData.boards.boards && mockData.boards.boards[0]);
        return { boards: board ? [board] : (mockData.boards?.boards || []) };
      }
      
      if (query.includes('GetDisplayValue') && !query.includes('Batch')) {
        const item = mockData.displayValue?.[variables.itemId] || 
                     (mockData.displayValue?.items && mockData.displayValue.items.find(i => String(i.id) === String(variables.itemId))) ||
                     mockData.displayValue?.items?.[0];
        return { items: item ? [item] : [] };
      }
      
      if (query.includes('GetDisplayValueBatch')) {
        return mockData.displayValueBatch || { boards: [] };
      }
      
      if (query.includes('GetNumericValue')) {
        const item = mockData.numericValue?.[variables.itemId] || 
                     (mockData.numericValue?.items && mockData.numericValue.items.find(i => String(i.id) === String(variables.itemId))) ||
                     mockData.numericValue?.items?.[0];
        return { items: item ? [item] : [] };
      }
      
      if (query.includes('GetMirrorDeep')) {
        const item = mockData.mirrorDeep?.[variables.itemId] || 
                     (mockData.mirrorDeep?.items && mockData.mirrorDeep.items.find(i => String(i.id) === String(variables.itemId))) ||
                     mockData.mirrorDeep?.items?.[0];
        return { items: item ? [item] : [] };
      }
      
      if (query.includes('GetItemsMirrorDeep')) {
        return mockData.itemsMirrorDeep || { items: [] };
      }
      
      if (query.includes('GetMultiColumnsDeep')) {
        const item = mockData.multiColumnsDeep?.[variables.itemId] || 
                     (mockData.multiColumnsDeep?.items && mockData.multiColumnsDeep.items.find(i => String(i.id) === String(variables.itemId))) ||
                     mockData.multiColumnsDeep?.items?.[0];
        return { items: item ? [item] : [] };
      }
      
      return mockData.default || {};
    }
  };
}

// ============================================================================
// Test Cases
// ============================================================================

async function testSimpleNumber() {
  console.log('\n=== Test: Simple Numbers Column ===');
  
  const mockData = {
    boards: {
      boards: [{
        id: '123',
        name: 'Test Board',
        columns: [
          { id: 'numbers1', title: 'Numbers', type: 'numbers', settings: {} }
        ]
      }]
    },
    displayValue: {
      items: [{
        id: '100',
        column_values: [{
          id: 'numbers1',
          type: 'numbers',
          number: 42
        }]
      }]
    }
  };
  
  const apiClient = createMockApiClient(mockData);
  const schemaCache = createSimpleCache(apiClient);
  
  const result = await resolveColumnValue({
    boardId: '123',
    columnId: 'numbers1',
    itemId: 100,
    apiClient,
    schemaCache
  });
  
  console.log('Result:', result);
  console.log('Expected: 42');
  console.log('Pass:', result === 42);
}

async function testSimpleFormula() {
  console.log('\n=== Test: Simple Formula (no dependencies) ===');
  
  const mockData = {
    boards: {
      boards: [{
        id: '123',
        name: 'Test Board',
        columns: [
          { id: 'formula1', title: 'Formula', type: 'formula', settings: { formula: '5 + 3' } }
        ]
      }]
    },
    displayValue: {
      items: [{
        id: '100',
        column_values: [{
          id: 'formula1',
          type: 'formula',
          display_value: '8'
        }]
      }]
    }
  };
  
  const apiClient = createMockApiClient(mockData);
  const schemaCache = createSimpleCache(apiClient);
  
  const result = await resolveColumnValue({
    boardId: '123',
    columnId: 'formula1',
    itemId: 100,
    apiClient,
    schemaCache
  });
  
  console.log('Result:', result);
  console.log('Expected: 8');
  console.log('Pass:', result === 8);
}

async function testFormulaWithDependency() {
  console.log('\n=== Test: Formula with Number Dependency ===');
  
  const mockData = {
    boards: {
      boards: [{
        id: '123',
        name: 'Test Board',
        columns: [
          { id: 'numbers1', title: 'Numbers', type: 'numbers', settings: {} },
          { id: 'formula1', title: 'Formula', type: 'formula', settings: { formula: '{numbers1} * 2' } }
        ]
      }]
    },
    displayValue: {
      '100': {
        id: '100',
        column_values: [{
          id: 'formula1',
          type: 'formula',
          display_value: null // Null - needs recursion
        }]
      }
    },
    numericValue: {
      '100': {
        id: '100',
        column_values: [{
          id: 'numbers1',
          type: 'numbers',
          number: 25
        }]
      }
    }
  };
  
  const apiClient = createMockApiClient(mockData);
  const schemaCache = createSimpleCache(apiClient);
  
  const result = await resolveColumnValue({
    boardId: '123',
    columnId: 'formula1',
    itemId: 100,
    apiClient,
    schemaCache
  });
  
  console.log('Result:', result);
  console.log('Expected: 50');
  console.log('Pass:', result === 50);
}

async function testMirrorWithAggregation() {
  console.log('\n=== Test: Mirror with Comma-Separated Values ===');
  
  const mockData = {
    boards: {
      boards: [{
        id: '123',
        name: 'Test Board',
        columns: [
          { 
            id: 'mirror1', 
            title: 'Mirror', 
            type: 'mirror', 
            settings: {
              function: 'sum',
              displayed_linked_columns: [{ board_id: '456', column_ids: ['numbers1'] }],
              relation_column: { 'connect1': true }
            }
          }
        ]
      }]
    },
    mirrorDeep: {
      items: [{
        id: '100',
        column_values: [{
          id: 'mirror1',
          type: 'mirror',
          display_value: '10, 20, 30'
        }]
      }]
    }
  };
  
  const apiClient = createMockApiClient(mockData);
  const schemaCache = createSimpleCache(apiClient);
  
  const result = await resolveColumnValue({
    boardId: '123',
    columnId: 'mirror1',
    itemId: 100,
    apiClient,
    schemaCache
  });
  
  console.log('Result:', result);
  console.log('Expected: 60 (sum of 10+20+30)');
  console.log('Pass:', result === 60);
}

async function testBatchResolution() {
  console.log('\n=== Test: Batch Resolution ===');
  
  const mockData = {
    boards: {
      boards: [{
        id: '123',
        name: 'Test Board',
        columns: [
          { id: 'numbers1', title: 'Numbers', type: 'numbers', settings: {} }
        ]
      }]
    },
    displayValueBatch: {
      boards: [{
        items_page: {
          items: [
            { id: '100', column_values: [{ id: 'numbers1', number: 10 }] },
            { id: '200', column_values: [{ id: 'numbers1', number: 20 }] },
            { id: '300', column_values: [{ id: 'numbers1', number: 30 }] }
          ]
        }
      }]
    }
  };
  
  const apiClient = createMockApiClient(mockData);
  const schemaCache = createSimpleCache(apiClient);
  
  const result = await resolveColumnValueBatch({
    boardId: '123',
    columnId: 'numbers1',
    itemIds: [100, 200, 300],
    apiClient,
    schemaCache
  });
  
  console.log('Result:', Object.fromEntries(result));
  console.log('Expected: { 100: 10, 200: 20, 300: 30 }');
  console.log('Pass:', result.get(100) === 10 && result.get(200) === 20 && result.get(300) === 30);
}

async function testStrictTyping() {
  console.log('\n=== Test: Strict Typing (10-Team) ===');
  
  const mockData = {
    boards: {
      boards: [{
        id: '123',
        name: 'Test Board',
        columns: [
          { id: 'text1', title: 'Text', type: 'text', settings: {} }
        ]
      }]
    },
    displayValue: {
      items: [{
        id: '100',
        column_values: [{
          id: 'text1',
          type: 'text',
          text: '10-Team'
        }]
      }]
    }
  };
  
  const apiClient = createMockApiClient(mockData);
  const schemaCache = createSimpleCache(apiClient);
  
  const result = await resolveColumnValue({
    boardId: '123',
    columnId: 'text1',
    itemId: 100,
    apiClient,
    schemaCache
  });
  
  console.log('Result:', result, '(type:', typeof result, ')');
  console.log('Expected: 10-Team (string)');
  console.log('Pass:', result === '10-Team' && typeof result === 'string');
}

async function testSmartDefaults() {
  console.log('\n=== Test: Smart Defaults (Missing Values) ===');
  
  const mockData = {
    boards: {
      boards: [{
        id: '123',
        name: 'Test Board',
        columns: [
          { id: 'numbers1', title: 'Numbers', type: 'numbers', settings: {} },
          { id: 'text1', title: 'Text', type: 'text', settings: {} }
        ]
      }]
    },
    displayValue: {
      '100': {
        id: '100',
        column_values: [] // Missing values
      }
    },
    numericValue: {
      '100': {
        id: '100',
        column_values: []
      }
    }
  };
  
  const apiClient = createMockApiClient(mockData);
  const schemaCache = createSimpleCache(apiClient);
  
  const numResult = await resolveColumnValue({
    boardId: '123',
    columnId: 'numbers1',
    itemId: 100,
    apiClient,
    schemaCache
  });
  
  const textResult = await resolveColumnValue({
    boardId: '123',
    columnId: 'text1',
    itemId: 100,
    apiClient,
    schemaCache
  });
  
  console.log('Numbers Result:', numResult, 'Expected: 0');
  console.log('Text Result:', textResult === '' ? '""' : textResult, 'Expected: ""');
  console.log('Pass:', numResult === 0 && textResult === '');
}

async function testMirrorTextAggregation() {
  console.log('\n=== Test: Mirror Text Aggregation (Names) ===');
  
  const mockData = {
    boards: {
      '123': {
        id: '123',
        name: 'Test Board 123',
        columns: [
          { 
            id: 'mirror1', 
            title: 'Mirror', 
            type: 'mirror', 
            settings: {
              displayed_linked_columns: [{ board_id: '456', column_ids: ['text1'] }]
            }
          }
        ]
      },
      '456': {
        id: '456',
        name: 'Test Board 456',
        columns: [
          { id: 'text1', title: 'Text', type: 'text', settings: {} }
        ]
      }
    },
    mirrorDeep: {
      '100': {
        id: '100',
        column_values: [{
          id: 'mirror1',
          type: 'mirror',
          display_value: null,
          mirrored_items: [
            { linked_board_id: '456', linked_item: { id: '201', name: 'Project A' } },
            { linked_board_id: '456', linked_item: { id: '202', name: 'Project B' } }
          ]
        }]
      }
    },
    displayValue: {
      '201': {
        id: '201',
        column_values: [{ id: 'text1', type: 'text', text: 'Project A' }]
      },
      '202': {
        id: '202',
        column_values: [{ id: 'text1', type: 'text', text: 'Project B' }]
      }
    }
  };
  
  const apiClient = createMockApiClient(mockData);
  const schemaCache = createSimpleCache(apiClient);
  
  const result = await resolveColumnValue({
    boardId: '123',
    columnId: 'mirror1',
    itemId: 100,
    apiClient,
    schemaCache
  });
  
  console.log('Result:', result);
  console.log('Expected: Project A, Project B');
  console.log('Pass:', result === 'Project A, Project B');
}

// ============================================================================
// Run Tests
// ============================================================================

async function runTests() {
  console.log('========================================');
  console.log('Formula Engine Resolver Tests');
  console.log('========================================');
  
  try {
    await testSimpleNumber();
    await testSimpleFormula();
    await testFormulaWithDependency();
    await testMirrorWithAggregation();
    await testBatchResolution();
    await testStrictTyping();
    await testSmartDefaults();
    await testMirrorTextAggregation();
    
    console.log('\n========================================');
    console.log('All tests completed!');
    console.log('========================================');
  } catch (error) {
    console.error('\nTest failed with error:', error);
  }
}

// Run if executed directly
runTests();

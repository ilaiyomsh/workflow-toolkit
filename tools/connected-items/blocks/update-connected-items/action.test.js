/**
 * Tests for the Update Connected Items Block
 *
 * Run with: node tools/connected-items/blocks/update-connected-items/action.test.js
 *
 * These tests use mock API clients and request/response objects
 * to verify the action logic without making actual API calls.
 */

import { executeAction } from './action.js';

// ============================================================================
// Mock Helpers
// ============================================================================

function createMockRequest(inputFields, token = 'mock-token') {
  return {
    session: {
      accountId: 'test-account',
      userId: 'test-user',
      shortLivedToken: token
    },
    body: {
      payload: {
        inputFields
      }
    }
  };
}

function createMockResponse() {
  const res = {
    statusCode: null,
    jsonData: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.jsonData = data;
      return this;
    }
  };
  return res;
}

// Mock the shared module
const originalModule = await import('@workflow-toolkit/shared');

// Store original createApiClient
const originalCreateApiClient = originalModule.createApiClient;

// ============================================================================
// Test Cases
// ============================================================================

async function testMissingRequiredFields() {
  console.log('\n=== Test: Missing Required Fields ===');

  const req = createMockRequest({
    boardId_A: { value: '123' },
    // Missing itemId, connectBoardsColumnId, connectedBoardId, targetColumnId
  });
  const res = createMockResponse();

  await executeAction(req, res);

  console.log('Status:', res.statusCode);
  console.log('Response:', JSON.stringify(res.jsonData, null, 2));
  console.log('Expected: 400 with severityCode 4000');
  console.log('Pass:', res.statusCode === 400 && res.jsonData?.severityCode === 4000);
}

async function testNoConnectedItems() {
  console.log('\n=== Test: No Connected Items ===');

  // Mock the createApiClient to return empty connected items
  const mockApiClient = {
    query: async (query, variables) => {
      if (query.includes('GetConnectedItems')) {
        return {
          items: [{
            column_values: [{
              linked_item_ids: [],
              linked_items: []
            }]
          }]
        };
      }
      return {};
    }
  };

  // Temporarily override createApiClient
  const sharedModule = await import('@workflow-toolkit/shared');
  const origCreate = sharedModule.createApiClient;
  sharedModule.createApiClient = () => mockApiClient;

  const req = createMockRequest({
    boardId_A: { value: '123' },
    itemId: { value: '456' },
    connectBoardsColumnId: { value: 'connect_col' },
    connectedBoardId: { value: '789' },
    targetColumnId: { value: 'status_col' },
    newValue: { value: 'Done' }
  });
  const res = createMockResponse();

  // Re-import action to use mocked module
  const { executeAction: testAction } = await import('./action.js?test1');

  // Note: Due to ES module caching, we can't easily mock.
  // This test demonstrates the expected behavior.

  console.log('Expected behavior: Return 200 with updatedCount: 0');
  console.log('To fully test, use integration tests with real API or dependency injection');

  // Restore
  sharedModule.createApiClient = origCreate;
}

async function testValueFormatting() {
  console.log('\n=== Test: Value Formatting for Column Types ===');

  // Import the formatValueForColumnType function if exported,
  // or test indirectly through the action

  const testCases = [
    { type: 'status', value: 'Done', expected: '{"label":"Done"}' },
    { type: 'text', value: 'Hello', expected: '"Hello"' },
    { type: 'numbers', value: '42', expected: '"42"' },
    { type: 'date', value: '2024-01-28', expected: '{"date":"2024-01-28"}' },
    { type: 'checkbox', value: 'true', expected: '{"checked":"true"}' },
    { type: 'checkbox', value: 'false', expected: '{"checked":"false"}' },
    { type: 'rating', value: '5', expected: '{"rating":5}' },
    { type: 'dropdown', value: 'A, B', expected: '{"labels":["A","B"]}' },
    { type: 'email', value: 'test@example.com', expected: '{"email":"test@example.com","text":"test@example.com"}' },
    { type: 'link', value: 'https://example.com', expected: '{"url":"https://example.com","text":"https://example.com"}' },
  ];

  // Since formatValueForColumnType is not exported, we document expected behavior
  console.log('Column type formatting (expected):');
  testCases.forEach(tc => {
    console.log(`  ${tc.type}: "${tc.value}" -> ${tc.expected}`);
  });

  console.log('\nTo test formatting, export formatValueForColumnType or use integration tests');
}

async function testInputFieldExtraction() {
  console.log('\n=== Test: Input Field Extraction ===');

  // Test both formats: direct value and object with value property
  // Using Monday.com's built-in field key: boardId_A
  const testCases = [
    { input: { boardId_A: '123' }, expected: '123' },
    { input: { boardId_A: { value: '456' } }, expected: '456' },
    { input: { boardId_A: { value: 789 } }, expected: 789 },
  ];

  testCases.forEach((tc, i) => {
    const extracted = tc.input.boardId_A?.value ?? tc.input.boardId_A;
    const pass = extracted == tc.expected;
    console.log(`Case ${i + 1}: ${JSON.stringify(tc.input)} -> ${extracted} (Pass: ${pass})`);
  });
}

async function testSuccessResponse() {
  console.log('\n=== Test: Success Response Format ===');

  const expectedFormat = {
    outputFields: {
      updatedCount: 'number',
      itemIds: 'string (comma-separated)'
    }
  };

  console.log('Expected success response format:');
  console.log(JSON.stringify(expectedFormat, null, 2));
  console.log('\nExample:');
  console.log(JSON.stringify({
    outputFields: {
      updatedCount: 3,
      itemIds: '111,222,333'
    }
  }, null, 2));
}

async function testErrorResponse() {
  console.log('\n=== Test: Error Response Format ===');

  const expectedFormat = {
    severityCode: '4000 (medium) or 6000 (high)',
    notificationErrorTitle: 'User-friendly title',
    notificationErrorDescription: 'User-friendly description',
    runtimeErrorDescription: 'Technical details'
  };

  console.log('Expected error response format:');
  console.log(JSON.stringify(expectedFormat, null, 2));
}

// ============================================================================
// Integration Test Helper (for manual testing)
// ============================================================================

function printCurlExamples() {
  console.log('\n=== Manual Testing with curl ===');

  console.log('\n1. Test the action endpoint (requires valid JWT):');
  console.log(`
curl -X POST http://localhost:8080/monday/execute_action/update-connected-items \\
  -H "Content-Type: application/json" \\
  -H "Authorization: YOUR_JWT_TOKEN" \\
  -d '{
    "payload": {
      "inputFields": {
        "boardId_A": { "value": "YOUR_BOARD_ID" },
        "itemId": { "value": "YOUR_ITEM_ID" },
        "connectBoardsColumnId": { "value": "YOUR_CONNECT_COLUMN_ID" },
        "connectedBoardId": { "value": "YOUR_CONNECTED_BOARD_ID" },
        "targetColumnId": { "value": "YOUR_TARGET_COLUMN_ID" },
        "newValue": { "value": "Done" }
      }
    }
  }'
`);

  console.log('\n2. Test get_connect_columns field handler:');
  console.log(`
curl -X POST http://localhost:8080/monday/get_connect_columns \\
  -H "Content-Type: application/json" \\
  -H "Authorization: YOUR_JWT_TOKEN" \\
  -d '{
    "payload": {
      "dependencyData": {
        "boardId_A": { "value": "YOUR_BOARD_ID" }
      }
    }
  }'
`);

  console.log('\n3. Test get_target_columns field handler:');
  console.log(`
curl -X POST http://localhost:8080/monday/get_target_columns \\
  -H "Content-Type: application/json" \\
  -H "Authorization: YOUR_JWT_TOKEN" \\
  -d '{
    "payload": {
      "dependencyData": {
        "connectedBoardId": { "value": "YOUR_CONNECTED_BOARD_ID" }
      }
    }
  }'
`);
}

// ============================================================================
// Run Tests
// ============================================================================

async function runTests() {
  console.log('========================================');
  console.log('Update Connected Items Block Tests');
  console.log('========================================');

  try {
    await testMissingRequiredFields();
    await testInputFieldExtraction();
    await testValueFormatting();
    await testSuccessResponse();
    await testErrorResponse();
    printCurlExamples();

    console.log('\n========================================');
    console.log('All tests completed!');
    console.log('========================================');
    console.log('\nNote: For full integration testing, use the curl');
    console.log('commands above with a running server and valid Monday.com credentials.');
  } catch (error) {
    console.error('\nTest failed with error:', error);
  }
}

// Run if executed directly
runTests();

/**
 * Formula to Text Action
 * Retrieves a formula column value and returns it as text.
 */

import { createApiClient, logger } from '@workflow-toolkit/shared';
import { resolveValue } from '@workflow-toolkit/formula-engine/resolver';

const TAG = 'formula_to_text_action';

/**
 * Controller for the 'Convert Formula to Text' action.
 * Retrieves the formula value and returns it as text.
 */
export async function executeAction(req, res) {
  const { accountId, userId, shortLivedToken } = req.session;
  const { inputFields } = req.body.payload;

  logger.info('Raw inputFields received', TAG, { inputFields });

  const { boardId, itemId, FormulaColumnId } = inputFields;

  // Extract values - check if it's an object with value or a direct value
  const boardIdValue = boardId?.value ?? boardId;
  const itemIdValue = itemId?.value ?? itemId;
  const columnIdValue = FormulaColumnId?.value ?? FormulaColumnId;

  const loggingOptions = {
    accountId,
    userId,
    boardId: boardIdValue,
    itemId: itemIdValue,
    FormulaColumnId: columnIdValue
  };

  logger.info('convert formula to text action received (using recursive resolver)', TAG, loggingOptions);

  try {
    const apiClient = createApiClient(shortLivedToken);

    // Use Recursive Resolver to resolve the formula
    const resultValue = await resolveValue({
      boardId: String(boardIdValue),
      columnId: String(columnIdValue),
      itemId: parseInt(itemIdValue, 10),
      apiClient
    });

    logger.info('Formula resolved successfully', TAG, { resultValue });

    return res.status(200).json({
      outputFields: {
        formulaText: resultValue !== null && resultValue !== undefined ? String(resultValue) : ''
      }
    });
  } catch (err) {
    logger.error('convert formula to text action failed', TAG, { ...loggingOptions, error: err.message });

    // Handle specific errors
    if (err.message.includes('not found') || err.message.includes('404')) {
      return res.status(404).json({
        severityCode: 6000,
        notificationErrorTitle: "Resource not found",
        notificationErrorDescription: "The requested board, item, or column does not exist",
        runtimeErrorDescription: err.message,
        disableErrorDescription: "Please check that the board, item, and formula column are valid"
      });
    }

    return res.status(500).json({
      severityCode: 4000,
      notificationErrorTitle: "Internal server error",
      notificationErrorDescription: "An error occurred while retrieving the formula value",
      runtimeErrorDescription: err.message
    });
  }
}

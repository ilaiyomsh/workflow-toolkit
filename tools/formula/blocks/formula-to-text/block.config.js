/**
 * Formula to Text Block Configuration
 * Metadata for the Formula to Text block.
 */

export default {
  name: 'formula-to-text',
  displayName: 'Convert Formula to Text',
  description: 'Extracts formula column value and returns it as text for use in workflows',
  version: '1.0.0',

  // Input fields configuration
  inputFields: [
    {
      key: 'boardId',
      type: 'board',
      description: 'The board containing the formula column',
    },
    {
      key: 'itemId',
      type: 'item',
      description: 'The item to get the formula value from',
    },
    {
      key: 'FormulaColumnId',
      type: 'custom_field',
      description: 'The formula column to extract the value from',
      remoteOptionsUrl: '/monday/get_formula_columns',
    },
  ],

  // Output fields configuration
  outputFields: [
    {
      key: 'formulaText',
      type: 'text',
      description: 'The formula value as text',
    },
  ],
};

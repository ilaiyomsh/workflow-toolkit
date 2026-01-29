import express from 'express';
import bodyParser from 'body-parser';
import routes from './routes/index.js';
import { getSecret, logger, requestLoggerMiddleware } from '@workflow-toolkit/shared';
import { PORT } from './constants/index.js';

const TAG = 'app';
const port = getSecret(PORT) || 8080;

const app = express();

logger.info('Initializing Workflow ToolKit server...', TAG);

// Middlewares
app.use(bodyParser.json());
app.use(requestLoggerMiddleware);

// Routes
app.use(routes);

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error', TAG, {
    error: err.message,
    stack: err.stack,
    path: req.path
  });
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(port, () => {
  logger.info(`Server is running on port ${port}`, TAG);
  logger.info(`Health check available at http://localhost:${port}/health`, TAG);
});

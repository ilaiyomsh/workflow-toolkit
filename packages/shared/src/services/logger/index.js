const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

const getTimestamp = () => {
  return new Date().toISOString();
};

const formatData = (data) => {
  if (!data) return '';
  return typeof data === 'object' ? JSON.stringify(data, null, 2) : data;
};

const info = (message, tag, data) => {
  console.log(
    `${colors.cyan}[${getTimestamp()}]${colors.reset} ${colors.green}[INFO]${colors.reset} ${colors.bright}[${tag}]${colors.reset} ${message}`,
    data ? `\n${formatData(data)}` : ''
  );
};

const error = (message, tag, data) => {
  console.error(
    `${colors.cyan}[${getTimestamp()}]${colors.reset} ${colors.red}[ERROR]${colors.reset} ${colors.bright}[${tag}]${colors.reset} ${message}`,
    data ? `\n${formatData(data)}` : ''
  );
};

const warn = (message, tag, data) => {
  console.warn(
    `${colors.cyan}[${getTimestamp()}]${colors.reset} ${colors.yellow}[WARN]${colors.reset} ${colors.bright}[${tag}]${colors.reset} ${message}`,
    data ? `\n${formatData(data)}` : ''
  );
};

const debug = (message, tag, data) => {
  if (process.env.DEBUG === 'true') {
    console.log(
      `${colors.cyan}[${getTimestamp()}]${colors.reset} ${colors.magenta}[DEBUG]${colors.reset} ${colors.bright}[${tag}]${colors.reset} ${message}`,
      data ? `\n${formatData(data)}` : ''
    );
  }
};

const request = (req) => {
  console.log(
    `${colors.cyan}[${getTimestamp()}]${colors.reset} ${colors.blue}[REQUEST]${colors.reset} ${colors.bright}${req.method}${colors.reset} ${req.originalUrl}`
  );
};

const response = (req, statusCode, duration) => {
  const color = statusCode >= 400 ? colors.red : colors.green;
  console.log(
    `${colors.cyan}[${getTimestamp()}]${colors.reset} ${colors.blue}[RESPONSE]${colors.reset} ${colors.bright}${req.method}${colors.reset} ${req.originalUrl} ${color}${statusCode}${colors.reset} - ${duration}ms`
  );
};

export default {
  info,
  error,
  warn,
  debug,
  request,
  response
};

import { runMcpServer } from './server.js';

runMcpServer(process.cwd()).catch((err) => {
  console.error('Fatal MCP server error:', err);
  process.exit(1);
});

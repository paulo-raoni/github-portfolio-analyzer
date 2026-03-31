import { buildPortfolio } from '../core/portfolio.js';
import { info, success } from '../utils/output.js';

export async function runBuildPortfolioCommand(options = {}) {
  info('Building portfolio...');
  const result = await buildPortfolio(options);
  success(`✓ Built portfolio — ${result.count} items → ${result.portfolioPath}`);
}

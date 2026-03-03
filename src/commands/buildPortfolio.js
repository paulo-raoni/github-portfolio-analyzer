import { buildPortfolio } from '../core/portfolio.js';

export async function runBuildPortfolioCommand(options = {}) {
  const result = await buildPortfolio(options);
  console.log(`Built portfolio with ${result.count} items.`);
  console.log(`Wrote ${result.portfolioPath}.`);
}

const minePeriod = require('leap-guardian/scripts/minePeriod')

module.exports = async (env) => {
  const { networkConfig, wallet, plasmaWallet } = env;

  await minePeriod({ plasmaWallet, rootWallet: wallet, nodeConfig: networkConfig });
}

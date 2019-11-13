const startOrConnectToNetwork = require('../run');

async function run(name) {
  console.log('Applying recipe: ', name);
  const { contracts, nodes, accounts, wallet, plasmaWallet } = await startOrConnectToNetwork();

  await require(`../../tests/recipies/${name}`)(contracts, nodes, accounts, wallet, plasmaWallet);
  process.exit(0);
}

function onException (e) {
  console.error(e);
  process.exit(1);
}

process.on('uncaughtException', onException);
process.on('unhandledRejection', onException);

run(process.argv.filter(a => a.startsWith('--'))[2]);
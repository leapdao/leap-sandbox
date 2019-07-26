const startNetwork = require('../run');

async function run(name) {
  const { contracts, nodes, accounts, wallet, plasmaWallet } = await startNetwork();
  if (name) {
    await require(`../../tests/recipies/${name}`)(contracts, nodes, accounts, wallet, plasmaWallet);
  }
}

function onException (e) {
  console.error(e);
  process.exit(1);
}

process.on('uncaughtException', onException);
process.on('unhandledRejection', onException);

run(process.argv[2]);
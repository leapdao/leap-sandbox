const getEnv = require('../getEnv');

async function run(name) {
  console.log('Applying recipe: ', name);
  const { contracts, nodes, accounts, wallet, plasmaWallet } = await getEnv();

  await require(`../../tests/recipies/${name}`)(contracts, nodes, accounts, wallet, plasmaWallet);
  process.exit(0);
}

function onException (e) {
  console.error(e);
  process.exit(1);
}

process.on('uncaughtException', onException);
process.on('unhandledRejection', onException);

run(process.argv[2]);
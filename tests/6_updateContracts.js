const ethers = require('ethers');
const debug = require('debug'); 

const minePeriod = require('./actions/minePeriod');
const { mine } = require('../src/helpers');
const PosOperator = require('../build/contracts/build/contracts/PosOperator');

const log = debug('6_updateContracts');

module.exports = async function(env) {
  const { contracts, wallet } = env;

  console.log("╔═════════════════════════════════════╗");
  console.log("║   Test: Upgrade contract            ║");
  console.log("║Steps:                               ║");
  console.log("║1. upgrade Poa to Pos.               ║");
  console.log("║2. submit some periods               ║");
  console.log("╚═════════════════════════════════════╝");

  log("upgrade Poa to Pos");
  let factory = new ethers.ContractFactory(
    PosOperator.abi,
    PosOperator.bytecode,
    wallet
  );
  let posOperator = await factory.deploy(
    {
      gasLimit: 4712388,
      gasPrice: 100000000000,
    }
  );
  await posOperator.deployed();
 
  let data = contracts.proxy.interface.functions.upgradeTo.encode([posOperator.address]);
  await mine(
    contracts.governance.propose(
      contracts.operator.address, data,
      {
        gasLimit: 2000000,
      }
    )
  );
  await mine(contracts.governance.finalize());

  log("have some epochs pass by...");
  await minePeriod(env);

  console.log("╔══════════════════════════════════════╗");
  console.log("║   Test: Upgrade contract             ║");
  console.log("╚══════════════════════════════════════╝");
}

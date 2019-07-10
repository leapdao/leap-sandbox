const ethers = require('ethers');

const minePeriod = require('./actions/minePeriod');
const PosOperator = require('../build/contracts/build/contracts/PosOperator');

module.exports = async function(contracts, [node], accounts, wallet) {
  const alice = accounts[0].addr;

  console.log("╔═════════════════════════════════════╗");
  console.log("║   Test: Upgrade contract            ║");
  console.log("║Steps:                               ║");
  console.log("║1. upgrade Poa to Pos.               ║");
  console.log("║2. submit some periods               ║");
  console.log("╚═════════════════════════════════════╝");

  console.log("upgrade Poa to Pos");
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
  await (await contracts.governance.propose(
    contracts.operator.address, data,
    {
      gasLimit: 2000000,
    }
  )).wait();
  await (await contracts.governance.finalize()).wait();

  console.log("have some epochs pass by...");
  await minePeriod(node, accounts);

  console.log("╔══════════════════════════════════════╗");
  console.log("║   Test: Upgrade contract             ║");
  console.log("╚══════════════════════════════════════╝");
}

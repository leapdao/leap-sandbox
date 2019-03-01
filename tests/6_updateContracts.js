const machineGun = require('./actions/machineGun');
const PosOperator = require('../build/contracts/build/contracts/PosOperator');

module.exports = async function(contracts, nodes, accounts, web3) {
  const alice = accounts[0].addr;

  console.log("╔═════════════════════════════════════╗");
  console.log("║   Test: Upgrade contract            ║");
  console.log("║Steps:                               ║");
  console.log("║1. upgrade Poa to Pos.               ║");
  console.log("║2. submit some periods               ║");
  console.log("╚═════════════════════════════════════╝");

  console.log("upgrade Poa to Pos");
  let posOperator = new web3.eth.Contract(PosOperator.abi);
  posOperator = await posOperator.deploy({ data: PosOperator.bytecode }).send({
    from: accounts[0].addr,
      gas: 4712388,
      gasPrice: 100000000000
  });
  let data = contracts.proxy.methods.upgradeTo(posOperator.options.address).encodeABI();
  await contracts.governance.methods.propose(contracts.operator.options.address, data).send({
    from: alice, gas: 2000000
  });
  await contracts.governance.methods.finalize().send({ from: alice });

  console.log("have some epochs pass by...");
  await machineGun(nodes, accounts, true);

  console.log("╔══════════════════════════════════════╗");
  console.log("║   Test: Upgrade contract             ║");
  console.log("╚══════════════════════════════════════╝");
}
const { sleep } = require('../src/helpers');
const mintAndDeposit = require('./actions/mintAndDeposit');
const machineGun = require('./actions/machineGun');
const consolidate = require('./actions/consolidate');
const exitUnspent = require('./actions/exitUnspent');

module.exports = async function(contracts, nodes, accounts, web3) {
  const minter = accounts[0].addr;
  const alice = accounts[2].addr;
  const zzz = accounts[9].addr;
  const amount = 10000000;

  console.log("╔══════════════════════════════════════════╗");
  console.log("║   Test: Rotate through slots             ║");
  console.log("║Steps:                                    ║");
  console.log("║1. run on slot 0 and 1                    ║");
  console.log("║2. Empty slot 0, run only on slot 1       ║");
  console.log("║3. Empty slot 1, run only on slot 0       ║");
  console.log("║4. Exit Alice                             ║");
  console.log("╚══════════════════════════════════════════╝");

  // TODO: export validators state through api and check here
  // const config0 = await nodes[0].web3.getConfig();
  // console.log(config0);

  console.log("log-out from slot 0");
  const validatorInfo = await nodes[0].web3.getValidatorInfo();
  const overSlot0 = contracts.operator.options.address + '000000000000000000000000';
  await contracts.governance.methods.setSlot(
    overSlot0, 0, '0x00'
  ).send({ from: accounts[0].addr, gas: 2000000 });

  console.log("have some epochs pass by...");
  await machineGun(nodes, accounts, true);

  console.log("clean up slot 0");
  await contracts.operator.methods.activate(0).send({
    from: accounts[0].addr,
    gas: 2000000
  });

  console.log("have some epochs pass by...");
  await machineGun(nodes, accounts, true);

  console.log('log-out from slot 1');
  const overSlot1 = contracts.operator.options.address + '000000000000000000000001';
  await contracts.governance.methods.setSlot(
    overSlot1, 0, '0x00'
  ).send({ from: accounts[0].addr, gas: 2000000 });  

  console.log("set slot 0 again");
  await contracts.governance.methods.setSlot(
    overSlot0, 
    validatorInfo.ethAddress, 
    '0x' + validatorInfo.tendermintAddress
  ).send({
    from: accounts[0].addr,
    gas: 2000000
  });

  console.log("have some epochs pass by...");
  await machineGun(nodes, accounts, true);  
  await machineGun(nodes, accounts, true);  

  console.log("clean up slot 1");
  await contracts.operator.methods.activate(1).send({
    from: accounts[0].addr,
    gas: 2000000
  });

  console.log("have some epochs pass by...");
  await machineGun(nodes, accounts, true);  

  console.log("------Exit Alice------");
  await exitUnspent(contracts, nodes[0], alice);

  console.log("╔══════════════════════════════════════════╗");
  console.log("║   Test: Rotate through slots Completed   ║");
  console.log("╚══════════════════════════════════════════╝");
}
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
  console.log("║1. run on slot 0, set slot 1              ║");
  console.log("║2. logout slot 0, run on both             ║");
  console.log("║3. Empty slot 0, run only on slot 1       ║");
  console.log("║4. Exit Alice                             ║");
  console.log("╚══════════════════════════════════════════╝");

  // TODO: export validators state through api and check here
  // const config0 = await nodes[0].web3.getConfig();
  // console.log(config0);

  console.log("set slot 1");
  const validatorInfo1 = await nodes[1].web3.getValidatorInfo();
  const overSlot1 = contracts.operator.options.address + '000000000000000000000001';
  await contracts.governance.methods.setSlot(
    overSlot1,
    validatorInfo1.ethAddress, 
    '0x' + validatorInfo1.tendermintAddress
  ).send({
    from: accounts[0].addr,
    gas: 2000000
  });

  console.log('log-out from slot 0');
  const overSlot0 = contracts.operator.options.address + '000000000000000000000000';
  await contracts.governance.methods.setSlot(
    overSlot0, 0, '0x00'
  ).send({ from: accounts[0].addr, gas: 2000000 });

  console.log("have some epochs pass by...");
  await machineGun(nodes, accounts, true);
  await machineGun(nodes, accounts, true);

  console.log("clean up slot 0");
  await contracts.operator.methods.activate(0).send({
    from: accounts[0].addr,
    gas: 2000000
  });

  console.log("have some epochs pass by...");
  await machineGun(nodes, accounts, true);
  await machineGun(nodes, accounts, true);

  console.log("------Exit Alice------");
  const validatorInfo = await nodes[1].web3.getValidatorInfo();
  await exitUnspent(contracts, nodes[1], alice, {slotId: 1, addr: validatorInfo.ethAddress});

  console.log("╔══════════════════════════════════════════╗");
  console.log("║   Test: Rotate through slots Completed   ║");
  console.log("╚══════════════════════════════════════════╝");
}
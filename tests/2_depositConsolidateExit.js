const { sleep } = require('../src/helpers');
const mintAndDeposit = require('./actions/mintAndDeposit');
const consolidate = require('./actions/consolidate');
const exitUnspent = require('./actions/exitUnspent');
const { transfer } = require('./actions/transfer');

module.exports = async function(contracts, nodes, accounts, web3) {
    const minter = accounts[0].addr;
    const alice = accounts[2].addr;
    const yyy = accounts[8].addr;
    const yyyPriv = accounts[8].privKey;
    const zzz = accounts[9].addr;
    const amount = 10000000;
    const sleepTime = 6000;

    console.log("╔══════════════════════════════════════════╗");
    console.log("║   Test: Deposit, consolidate, then exit  ║");
    console.log("║Steps:                                    ║");
    console.log("║1. Deposit to Alice 2x                    ║");
    console.log("║2. Consolidate Alice                      ║");
    console.log("║3. Exit Alice                             ║");
    console.log("╚══════════════════════════════════════════╝");
    await mintAndDeposit(alice, amount, minter, contracts.token, contracts.exitHandler);
    await sleep(5000);
    console.log(`${alice} balance after deposit: ${await nodes[0].web3.eth.getBalance(alice)}`);
    await mintAndDeposit(alice, amount, minter, contracts.token, contracts.exitHandler); //second deposit so there will be 2 utxo to consolidate
    await sleep(5000);
    console.log(`${alice} balance after deposit: ${await nodes[0].web3.eth.getBalance(alice)}`);
    await consolidate(nodes[0], alice);
    console.log(`${alice} balance after consolidate: ${await nodes[0].web3.eth.getBalance(alice)}`);
    console.log("Make some more deposits to make sure the block is submitted (with log is off)...");
    await mintAndDeposit(yyy, 1000, minter, contracts.token, contracts.exitHandler, true);
    await sleep(sleepTime);
    for (let i = 0; i < 32; i++) {
        await transfer(
            yyy, 
            yyyPriv, 
            zzz, 
            1, 
            nodes[0]);
    }
    console.log("------Exit Alice------");
    const validatorInfo = await nodes[0].web3.getValidatorInfo();
    await exitUnspent(contracts, nodes[0], alice, {slotId: 0, addr: validatorInfo.ethAddress}, sleepTime);

    console.log("╔══════════════════════════════════════════╗");
    console.log("║   Test: Deposit, consolidate, then exit  ║");
    console.log("║             Completed                    ║");                     
    console.log("╚══════════════════════════════════════════╝");
}
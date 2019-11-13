const debug = require('debug');
const mintAndDeposit = require('./actions/mintAndDeposit');
const { transfer } = require('./actions/transfer');
const exitUnspent = require('./actions/exitUnspent');
const minePeriod = require('./actions/minePeriod');

require('chai').should();

const log = debug('1_depositTransferExit');


module.exports = async function(env) {
    const { contracts, nodes, accounts, wallet, plasmaWallet } = env;
    const node = nodes[0];
    const minter = accounts[0].addr;
    const alice = accounts[2].addr;
    const alicePriv = accounts[2].privKey;
    const bob = accounts[3].addr;
    const amount = 10000000;

    console.log("╔══════════════════════════════════════════╗");
    console.log("║    Test: Deposit, trasfer, then exit     ║");
    console.log("║Steps:                                    ║");
    console.log("║1. Deposit to Alice                       ║");
    console.log("║2. Trasfer from Alice to Bob              ║");
    console.log("║3. Exit Alice and Bob                     ║");
    console.log("╚══════════════════════════════════════════╝");

    await mintAndDeposit(accounts[2], amount, minter, contracts.token, 0, contracts.exitHandler, wallet, plasmaWallet);

    console.log('Making a few transfers..');
    for (let i = 0; i < 2; i++) {
        await transfer(alice, alicePriv, bob, '1000', node);
    }
    await minePeriod(env);
    log("------Exit Alice------");
    await exitUnspent(env, alice);
    log("------Exit Bob------");
    await exitUnspent(env, bob);

    console.log("╔══════════════════════════════════════════╗");
    console.log("║    Test: Deposit, trasfer, then exit     ║");
    console.log("║             Completed                    ║");                     
    console.log("╚══════════════════════════════════════════╝");
}

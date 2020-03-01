const debug = require('debug');
const mintAndDeposit = require('./actions/mintAndDeposit');
const { transfer } = require('./actions/transfer');
const exitUnspent = require('./actions/exitUnspent');
const minePeriod = require('./actions/minePeriod');
const exitHandler = require('../build/contracts/build/contracts/ExitHandler');

require('chai').should();

let challengeExit = exitHandler.challengeExit();

const log = debug('challengeExit');

module.exports = async function(env) {
    const { contracts, nodes, accounts, wallet, plasmaWallet } = env;
    const node = nodes[0];
    const minter = accounts[0].addr;
    const alice = accounts[2].addr;
    const alicePriv = accounts[2].privKey;
    const bob = accounts[6].addr;
    const amount = 10000000;
    
    console.log("╔══════════════════════════════════════════╗");
    console.log("║   Test: Challenge exit after Transfer    ║");
    console.log("║Steps:                                    ║");
    console.log("║1. Deposit to Alice                       ║");
    console.log("║2. Trasfer from Alice to Bob              ║");
    console.log("║3. Exit Alice                    ║");
    console.log("║4. Challenge Alice exit                             ║");
    console.log("╚══════════════════════════════════════════╝");
   
  await mintAndDeposit(accounts[2], amount, contracts.token, 0, contracts.exitHandler, wallet, plasmaWallet);
   
   

console.log('Making a few transfers..');
    for (let i = 0; i < 2; i++) {
        await transfer(alice, alicePriv, bob, '1000', node);
    }
    await minePeriod(env);
    log("------Exit Alice------");
    await exitUnspent(env, alice);
    log("------Exit Bob------");
    await exitUnspent(env, bob);

console.log("Challenging Bob's exit")




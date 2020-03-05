const debug = require('debug');
const mintAndDeposit = require('./actions/mintAndDeposit');
const { transfer } = require('./actions/transfer');
const exitUnspent = require('./actions/exitUnspent');
const minePeriod = require('./actions/minePeriod');
const { helpers, Tx, Util } = require('leap-core');
const { bufferToHex } = require('ethereumjs-util');

require('chai').should();

const log = debug('challengeExit');

module.exports = async function(env, addr, color) {
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
    //console.log(typeof(contracts.exitHandler.challengeExit()));
    console.log("╚══════════════════════════════════════════╝");
   
    await mintAndDeposit(accounts[2], amount, contracts.token, 0, contracts.exitHandler, wallet, plasmaWallet);
   
    console.log('Alice makes a transfer to Bob');
    
    const t1 = await transfer(alice, alicePriv, bob, '1000', node);
   
    await minePeriod(env);
    
    const transfer1 = await node.getTransaction(bufferToHex(t1.hash()));
    const proofOfTransfer1 = await helpers.getProof( 
                            plasmaWallet.provider, 
                            transfer1, 
                            {excludePrevHashFromProof: true } ); 
   console.log(proofOfTransfer1);
   console.log(t1);
    
    
   /* 
    

   //console.log(unspents); 
    log("------Exit Alice------");
    await exitUnspent(env, alice);
     
    let plasmaBalanceFinal = await node.getBalance(alice);
 
    //console.log("plasmaBalanceAfExit", plasmaBalanceFinal)


    log("------Exit Bob------");
    await exitUnspent(env, bob);

   console.log("Challenging Alice's exit");
   contracts.exitHandler.challengeExit([], proof, 0, 0, bob)
    */

}



const debug = require('debug');
const mintAndDeposit = require('./actions/mintAndDeposit');
const { transfer } = require('./actions/transfer');
const exitUnspent = require('./actions/exitUnspent');
const minePeriod = require('./actions/minePeriod');
const { helpers, Tx, Util } = require('leap-core');
const { bufferToHex } = require('ethereumjs-util');
const exitHandler = require('../build/contracts/build/contracts/ExitHandler');

require('chai').should();

//let challengeExit = exitHandler.challengeExit();

const log = debug('challengeExit');

module.exports = async function(env, addr, color) {
    const { contracts, nodes, accounts, wallet, plasmaWallet } = env;
    const node = nodes[0];
    const minter = accounts[0].addr;
    const alice = accounts[2].addr;
    const alicePriv = accounts[2].privKey;
    const bob = accounts[6].addr;
    const amount = 10000000;
    
    let txHash;
    let txData;
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
   
    let plasmaBalanceBefore = await node.getBalance(alice);
     
     //console.log("plasmaBalanceBefore", plasmaBalanceBefore);
   
    console.log('Making a few transfers..');
    for (let i = 0; i < 2; i++) {
       await transfer(alice, alicePriv, bob, '1000', node);
      
       }
   let plasmaBalanceAfTf = await node.getBalance(alice);
   
   
    await minePeriod(env);
    
    
    
    
     const unspents = await node.getUnspent(addr, color);
    
     const latestBlockNumber = (await node.getBlock('latest')).number;
    
     const latestSubmittedBlock = latestBlockNumber - latestBlockNumber % 32;
    
     const getIndex = async (unspents, lastBlock) => { 
         for(let i=0; i<unspents.length; i++) { 
                  txHash = unspents[i].outpoint.hash;
                  txData = await node.getTransaction(bufferToHex(txHash));
                  console.log("Unspent", i, "blocknumber:", txData.blockNumber);
                  console.log("Is submitted?", txData.blockNumber < lastBlock); 
                  if (txData.blockNumber < lastBlock) return i;
          }
          return -1; 
     };
     
    console.log(txData);
    const unspentIndex = await getIndex(unspents, latestSubmittedBlock);
    
    if (unspentIndex === -1) { 
          throw new Error("Can't exit, no unspents are in submitted periods found");
     };
    
    
    const unspent = unspents[unspentIndex]; 
    
    const proof = await helpers.getProof( 
                            plasmaWallet.provider, 
                            txData, 
                            {excludePrevHashFromProof: true } ); 
   // console.log(proof);

    
    log("------Exit Alice------");
    await exitUnspent(env, alice);
     
    let plasmaBalanceFinal = await node.getBalance(alice);
 
    console.log("plasmaBalanceAfExit", plasmaBalanceFinal)


    log("------Exit Bob------");
    await exitUnspent(env, bob);

   console.log("Challenging Alice's exit");
   contracts.exitHandler.challengeExit([], proof, 0, 0, alice)

 let plasmaBalanceChalgd = await node.getBalance(alice);
 
 console.log("plasmaBalanceAfExit", plasmaBalanceChalgd)

}



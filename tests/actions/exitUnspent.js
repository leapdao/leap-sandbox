const debug = require('debug')('exitUnspent');
const { helpers, Tx, Period, Util } = require('leap-core');
const { bufferToHex } = require('ethereumjs-util');
const { bi, equal, add } = require('jsbi-utils');
const { assert } = require('chai');
const { getLog } = require('../../src/helpers');
const waitForBalanceChange = require('./waitForBalanceChange');

module.exports = async function(contracts, node, web3, addr, uIndex) {
    const log = getLog(false);
    const slotId = 0;
    const validatorAddr = (await node.web3.getValidatorInfo()).ethAddress;
    
    let txHash;
    let txData;

    log(`------Unspents of ${addr}------`);
    const unspents = await node.web3.getUnspent(addr);
    log(unspents);
    debug("------Looking for unspent from submitted period------");
    const latestBlockNumber = (await node.web3.eth.getBlock('latest')).number;
    debug("Latest Block number: ", latestBlockNumber);
    const latestSubmittedBlock = latestBlockNumber - latestBlockNumber % 32;
    debug("Latest submitted block number: ", latestSubmittedBlock);
    if (latestSubmittedBlock === 0) {
        throw new Error("Can't exit, no periods were submitted yet");
    };
    
    const getIndex = async (unspents, lastBlock) =>{
        for(let i=0; i<unspents.length; i++) {
            txHash = unspents[i].outpoint.hash;
            txData = await node.web3.eth.getTransaction(bufferToHex(txHash));
            debug("Unspent", i, "blocknumber:", txData.blockNumber);
            debug("Is submitted?", txData.blockNumber < lastBlock);
            if (txData.blockNumber < lastBlock) return i;
        }
    
        return -1;
    };

    const unspentIndex = uIndex === undefined ? await getIndex(unspents, latestSubmittedBlock) : uIndex;
    if (unspentIndex === -1) {
        throw new Error("Can't exit, no unspents are in submitted periods found");
    };
    log(`------Will attept to exit unspent ${unspentIndex} of ${addr}------`);
    const unspent = unspents[unspentIndex];
    txHash = unspent.outpoint.hash;
    txData = await node.web3.eth.getTransaction(bufferToHex(txHash));
    const amount = unspent.output.value;
    log("Unspent amount: ", amount);
    debug(`------Transaction hash for Bob's unspent ${unspentIndex}------`);
    debug(txHash);
    debug("------Transaction data------");
    debug(txData);
    debug("------Period------");
    const period = await Period.periodForTx(node.web3, txData);
    debug(period);
    debug("------Proof------");
    period.setValidatorData(slotId, validatorAddr);
    const proof = period.proof(Tx.fromRaw(txData.raw));
    debug(proof);
    debug("------Youngest Input------");
    const youngestInput = await helpers.getYoungestInputTx(node.web3, Tx.fromRaw(txData.raw));
    debug(youngestInput);
    let youngestInputProof;
    if (youngestInput.tx) {
        debug("------Youngest Input Period------");
        const youngestInputPeriod = await Period.periodForTx(node.web3, youngestInput.tx);
        debug(youngestInputPeriod);
        debug("------Youngest Input Proof------");
        youngestInputPeriod.setValidatorData(slotId, validatorAddr);
        youngestInputProof = youngestInputPeriod.proof(Tx.fromRaw(youngestInput.tx.raw));
        debug(youngestInputProof);
    } else {
        debug("No youngest input found. Will try to exit deposit");
        youngestInputProof = [];
    }
    debug("------Period from the contract by merkle root------");
    debug(await contracts.bridge.methods.periods(proof[0]).call());
    log("------Balance before exit------");
    const balanceBefore = await contracts.token.methods.balanceOf(addr).call();
    const plasmaBalanceBefore = await node.getBalance(addr);
    log("Account mainnet balance: ", balanceBefore);
    log("Account plasma balance: ", plasmaBalanceBefore);
    log("Attempting exit...");
    log({ youngestInputProof, proof, unspentOutpointIndex: unspent.outpoint.index, youngestInputIndex: youngestInput.index });
    const startExitResult = await contracts.exitHandler.methods.startExit(
        youngestInputProof,
        proof,
        unspent.outpoint.index,
        youngestInput.index
    ).send({from: addr, value: 100000000000000000, gas: 2000000});
    console.log(startExitResult.events);

    log("Finalizing exit...");

    const txColor = txData.color;
    const exitResult = await contracts.exitHandler.methods.finalizeExits(txColor).send({from: addr, gas: 2000000});

    console.log(exitResult, unspent, txData);
    if (Util.isNFT(txColor) || Util.isNST(txColor)) {
      let nstUpdated = false;
      let nstTransferred = false;

      console.log(exitResult.events);
      Object.keys(exitResult.events).forEach(
        (i) => {
          const event = exitResult.events[i].raw;
          console.log(event);

          const ERC20_ERC721_TRANSFER_EVENT = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
          const ERC1948_DATA_UPDATED_EVENT = '0x8ec06c2117d45dcb6bcb6ecf8918414a7ff1cb1ed07da8175e2cf638d0f4777f';

          // update data
          if (event.topics[0] === ERC1948_DATA_UPDATED_EVENT) {
            if (equal(bi(event.topics[1]), bi(unspent.output.value))) {
              nstUpdated = true;
            }
            return;
          }

          // nft/nst transfer
          if (event.topics[0] === ERC20_ERC721_TRANSFER_EVENT) {
            console.log(bi(event.topics[3]), bi(unspent.output.value));
            if (equal(bi(event.topics[3]), bi(unspent.output.value))) {
              nstTransferred = true;
            }
            return;
          }
        }
      );
      console.log({nstUpdated, nstTransferred});
      // TODO: nst need a writedata event, or a breed
      if (Util.isNST(txColor)) {
        assert.equal(nstUpdated, true, 'nst should have data updated event');
      }
      assert.equal(nstTransferred, true, 'nst should have been transferred');

      return unspent;
    }

    log("------Balance after exit------");
    const balanceAfter = await contracts.token.methods.balanceOf(addr).call();
    log("Account mainnet balance: ", balanceAfter);
    
    const plasmaBalanceAfter = await waitForBalanceChange(addr, plasmaBalanceBefore, node, web3);
    log("Account plasma balance: ", plasmaBalanceAfter);

    const unspentsAfter = await node.web3.getUnspent(addr);
    // const unspentsValue = unspentsAfter.reduce((sum, unspent) => sum + unspent.output.value, 0);
    const unspentsValue = unspentsAfter.reduce((sum, unspent) => add(bi(sum), bi(unspent.output.value)), 0);
    unspentsAfter.length.should.be.equal(unspents.length - 1);
    // assert(equal(bi(unspentsValue), bi(plasmaBalanceAfter)));
    plasmaBalanceAfter.should.be.equal(plasmaBalanceBefore - amount);
    // assert(equal(bi(balanceAfter), add(bi(balanceBefore), bi(amount))));

    return unspent;
}

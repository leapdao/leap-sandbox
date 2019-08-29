const ethers = require('ethers');
const debug = require('debug')('exitUnspent');
const { helpers, Tx, Period, Util } = require('leap-core');
const { bufferToHex } = require('ethereumjs-util');
const { bi, equal, add } = require('jsbi-utils');
const { assert } = require('chai');
const { getLog } = require('../../src/helpers');
const waitForBalanceChange = require('./waitForBalanceChange');

const ERC20_ERC721_TRANSFER_EVENT = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const ERC1948_DATA_UPDATED_EVENT = '0x8ec06c2117d45dcb6bcb6ecf8918414a7ff1cb1ed07da8175e2cf638d0f4777f';

module.exports = async function(env, addr, uIndex) {
  const { contracts, nodes, wallet, plasmaWallet } = env;
  const node = nodes[0];

  const log = getLog(false);
  
    let txHash;
    let txData;

    log(`------Unspents of ${addr}------`);
    const unspents = await node.getUnspent(addr);
    log(unspents);
    debug("------Looking for unspent from submitted period------");
    const latestBlockNumber = (await node.getBlock('latest')).number;
    debug("Latest Block number: ", latestBlockNumber);
    const latestSubmittedBlock = latestBlockNumber - latestBlockNumber % 32;
    debug("Latest submitted block number: ", latestSubmittedBlock);
    if (latestSubmittedBlock === 0) {
        throw new Error("Can't exit, no periods were submitted yet");
    };
    
    const getIndex = async (unspents, lastBlock) =>{
        for(let i=0; i<unspents.length; i++) {
            txHash = unspents[i].outpoint.hash;
            txData = await node.getTransaction(bufferToHex(txHash));
            debug("Unspent", i, "blocknumber:", txData.blockNumber);
            debug("Is submitted?", txData.blockNumber < lastBlock);
            if (txData.blockNumber < lastBlock) return i;
        }
    
        return -1;
    };

    const unspentIndex = uIndex === undefined || uIndex === null ? await getIndex(unspents, latestSubmittedBlock) : uIndex;

    if (unspentIndex === -1) {
        throw new Error("Can't exit, no unspents are in submitted periods found");
    };
    log(`------Will attept to exit unspent ${unspentIndex} of ${addr}------`);
    const unspent = unspents[unspentIndex];
    txHash = unspent.outpoint.hash;
    txData = await node.getTransaction(bufferToHex(txHash));
    const amount = unspent.output.value;
    const txColor = unspent.output.color;
    log("Unspent amount: ", amount);
    debug(`------Transaction hash for Bob's unspent ${unspentIndex}------`);
    debug(txHash);
    debug("------Transaction data------");
    debug(txData);
    debug("------Period------");
    const period = await Period.periodForTx(node, txData);
    debug(period);
    debug("------Proof------");
    const periodData = await plasmaWallet.provider.send('plasma_getPeriodByBlockHeight', [txData.blockNumber]);
    period.setValidatorData(periodData[0].slotId, periodData[0].validatorAddress, periodData[0].casBitmap);
    const proof = period.proof(Tx.fromRaw(txData.raw));
    debug(proof);
    debug("------Youngest Input------");
    const youngestInput = await helpers.getYoungestInputTx(node, Tx.fromRaw(txData.raw));
    debug(youngestInput);
    let youngestInputProof;
    if (youngestInput.tx) {
        debug("------Youngest Input Period------");
        const youngestInputPeriod = await Period.periodForTx(node, youngestInput.tx);
        debug(youngestInputPeriod);
        debug("------Youngest Input Proof------");
        const periodData = await plasmaWallet.provider.send('plasma_getPeriodByBlockHeight', [youngestInput.tx.blockNumber]);
        youngestInputPeriod.setValidatorData(periodData[0].slotId, periodData[0].validatorAddress, periodData[0].casBitmap);
        youngestInputProof = youngestInputPeriod.proof(Tx.fromRaw(youngestInput.tx.raw));
        debug(youngestInputProof);
    } else {
        debug("No youngest input found. Will try to exit deposit");
        youngestInputProof = [];
    }
    debug("------Period from the contract by merkle root------");
    debug(await contracts.bridge.periods(proof[0]));
    log("------Balance before exit------");
    const balanceBefore = await contracts.token.balanceOf(addr);
    const plasmaBalanceBefore = await node.getBalance(addr);
    log("Account mainnet balance: ", balanceBefore);
    log("Account plasma balance: ", plasmaBalanceBefore);
    log("Attempting exit...");
    let startExitResult =
      await contracts.exitHandler.connect(wallet.provider.getSigner(addr)).startExit(
        youngestInputProof,
        proof,
        unspent.outpoint.index,
        youngestInput.index,
        { value: ethers.utils.parseEther('1'), gasLimit: 2000000 }
    );
    await startExitResult.wait();

    log("Finalizing exit...");

    let exitResult =
      await contracts.exitHandler.connect(wallet.provider.getSigner(addr))
        .finalizeExits(txColor, { gasLimit: 2000000 });
    exitResult = await exitResult.wait();

    if (Util.isNFT(txColor) || Util.isNST(txColor)) {
      let nstUpdated = false;
      let nstTransferred = false;

      exitResult.events.forEach(
        (event) => {
          // update data
          if (event.topics[0] === ERC1948_DATA_UPDATED_EVENT) {
            if (equal(bi(event.topics[1]), bi(unspent.output.value))) {
              nstUpdated = true;
            }
            return;
          }

          // nft/nst transfer
          if (event.topics[0] === ERC20_ERC721_TRANSFER_EVENT) {
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
      assert.equal(nstTransferred, true, 'nft/nst should have been transferred');

      return unspent;
    }

    log("------Balance after exit------");
    const balanceAfter = await contracts.token.balanceOf(addr);
    log("Account mainnet balance: ", balanceAfter);
    
    const plasmaBalanceAfter = await waitForBalanceChange(addr, plasmaBalanceBefore, node, wallet);
    log("Account plasma balance: ", plasmaBalanceAfter);

    const unspentsAfter = await node.getUnspent(addr);
    const unspentsValue = unspentsAfter.reduce((sum, unspent) => add(bi(sum), bi(unspent.output.value)), 0);
    unspentsAfter.length.should.be.equal(unspents.length - 1);
    plasmaBalanceAfter.should.be.equal(plasmaBalanceBefore - amount);

    return unspent;
}

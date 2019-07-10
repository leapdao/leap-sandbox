const ethers = require('ethers');
const { helpers } = require('leap-core');

const { formatHostname, advanceBlocks, sleep } = require('./helpers');

let idCounter = 0;

class Node extends helpers.LeapEthers {
  constructor(hostname, jsonrpcPort) {
    const provider = new ethers.providers.JsonRpcProvider(formatHostname(hostname, jsonrpcPort))
    super(provider);

    this.id = idCounter++;
  }

  async sendTx(tx) {
    // workaround different transaction hashes (leap-core bug)
    let txHash;

    try {
      txHash = await this.provider.send('eth_sendRawTransaction', [tx.hex()]);
    } catch(e) {
      console.log(e);
    }

    if (txHash !== tx.hash()) {
      console.warn(`txHash(${txHash}) from rpc does not match local tx.hash(${tx.hash()})`);
    }

    let rounds = 50;
    while (rounds--) {
      let res = await this.provider.getTransaction(txHash)

      if (res && res.blockHash) {
        return;
      }

      // wait ~100ms
      await new Promise((resolve) => setTimeout(() => resolve(), 100));
    }

    throw new Error('transaction not included in time');
  };

  async getBalance(addr) {
    return this.provider.getBalance(addr).then(res => Number(res));
  }

  async getBlock(val, includeTxs) {
    let method = 'eth_getBlockByNumber';

    if (typeof val === 'string' && val.startsWith('0x')) {
      method = 'eth_getBlockByHash';
    }

    return this.provider.send(method, [val, includeTxs]);
  }

  async getTransaction(...args) {
    // Do it manually here because we sometimes get 'encoding' errors (missing fields returned from rpc?)
    return this.provider.send('eth_getTransactionByHash', args);
  }

  async advanceUntilChange(wallet) {
    const currentBlock = await this.provider.getBlockNumber();

    let colors = (await this.provider.send('plasma_getColors', [true, false]));
    colors = colors.concat((await this.provider.send('plasma_getColors', [false, true])));
    colors = colors.concat((await this.provider.send('plasma_getColors', [false, false])));

    while (true) {
      const blockNumber = await this.provider.getBlockNumber();

      if (blockNumber > currentBlock) {
        break;
      }

      let c = (await this.provider.send('plasma_getColors', [true, false]));
      c = c.concat((await this.provider.send('plasma_getColors', [false, true])));
      c = c.concat((await this.provider.send('plasma_getColors', [false, false])));

      if (c.length !== colors.length) {
        break;
      }

      await advanceBlocks(1, wallet);
      await sleep(100);
    }
  }
}

module.exports = Node;

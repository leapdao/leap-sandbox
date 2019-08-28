const ethers = require('ethers');
const { helpers } = require('leap-core');
const LeapProvider = require('leap-provider');

const erc20abi = require('./erc20abi');
const { formatHostname, advanceBlocks, sleep } = require('./helpers');

let idCounter = 0;

class Node extends helpers.LeapEthers {
  constructor(hostname, jsonrpcPort) {
    const provider = new LeapProvider(formatHostname(hostname, jsonrpcPort))
    super(provider);

    this.id = idCounter++;
    this.hostname = hostname;
    this.port = jsonrpcPort;
  }

  async sendTx(tx) {
    return this.provider.sendTransaction(tx).then(tx => tx.wait());
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

  async advanceUntilTokenBalanceChange(addr, tokenAddr, prevBalance, rootWallet, plasmaWallet) {
    const token = new ethers.Contract(tokenAddr, erc20abi, plasmaWallet);
    const rootToken = new ethers.Contract(tokenAddr, erc20abi, rootWallet);
    const symbol = (await rootToken.symbol()).toUpperCase();
    let currentBalance;
    
    const frames = ['🌕','🌖','🌗','🌘','🌑','🌒','🌓','🌔'];
    let i = 0;
    do {
      i++;
      await advanceBlocks(1, rootWallet);
      await sleep(100);
      currentBalance = await token.balanceOf(addr);
      process.stdout.write(
        `\r${symbol} balance: ${currentBalance.toString()} `+ 
        `${currentBalance.toString() !== String(prevBalance) ? '✅' : frames[i % 8]} `
      );
    } while(currentBalance.toString() === String(prevBalance))
    console.log();
    return currentBalance;
  }

  getRpcUrl() {
    return `http://${this.hostname}:${this.port}`;
  }

  toString() {
    const { hostname, port } = this;
    return { hostname, port };
  }
}

module.exports = Node;

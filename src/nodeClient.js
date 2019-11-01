const ethers = require('ethers');
const LeapProvider = require('leap-provider');

const erc20abi = require('./erc20abi');
const { formatHostname, advanceBlocks, sleep } = require('./helpers');

const flatValues = map => 
  Object.values(map).reduce((s, a) => s.concat(a), []);

let idCounter = 0;

class Node extends LeapProvider {
  constructor(hostname, jsonrpcPort) {
    super(formatHostname(hostname, jsonrpcPort));
    this.id = idCounter++;
    this.hostname = hostname;
    this.port = jsonrpcPort;
  }

  async sendTx(tx) {
    return this.sendTransaction(tx)
      .then(tx => 
        Promise.race([
          tx.wait(), 
          new Promise((_, reject) => setTimeout(
            () => reject('Transaction not included in block after 5 secs.'),
            7000
          ))
        ])
      );
  };

  async getBlock(val, includeTxs) {
    let method = 'eth_getBlockByNumber';

    if (typeof val === 'string' && val.startsWith('0x')) {
      method = 'eth_getBlockByHash';
    }

    return this.send(method, [val, includeTxs]);
  }

  async advanceUntilChange(wallet) {
    const currentBlock = await this.getBlockNumber();

    let colors = flatValues(await this.getColors());

    while (true) {
      const blockNumber = await this.getBlockNumber();

      if (blockNumber > currentBlock) {
        break;
      }

      let c = flatValues(await this.getColors());

      if (c.length !== colors.length) {
        break;
      }

      await advanceBlocks(1, wallet);
      await sleep(100);
    }
  }

  async advanceUntilTokenBalanceChange(addr, tokenAddr, prevBalance, rootWallet, plasmaWallet, msg) {
    const token = new ethers.Contract(tokenAddr, erc20abi, plasmaWallet);
    let currentBalance;
    
    const frames = ['🌕','🌖','🌗','🌘','🌑','🌒','🌓','🌔'];
    let i = 0;
    do {
      i++;
      await advanceBlocks(1, rootWallet);
      await sleep(100);
      currentBalance = await token.balanceOf(addr);
      process.stdout.write(
        `\r${msg} `+ 
        `${currentBalance.toString() !== String(prevBalance) ? '✅' : frames[i % 8]} `
      );
    } while(currentBalance.toString() === String(prevBalance))
    return currentBalance;
  }

  getRpcUrl() {
    return `http://${this.hostname}:${this.port}`;
  }

  getState() {
    return this.send('plasma_getState', []);
  }

  toString() {
    const { hostname, port } = this;
    return { hostname, port };
  }
}

module.exports = Node;

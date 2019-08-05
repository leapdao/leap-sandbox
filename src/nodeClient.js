const fs = require('fs');
const spawn = require('child_process').spawn;
const ethers = require('ethers');
const LeapProvider = require('leap-provider');
const { helpers } = require('leap-core');

const erc20abi = require('./erc20abi');
const { formatHostname, advanceBlocks, sleep } = require('./helpers');

let idCounter = 0;

class Node extends helpers.LeapEthers {

  constructor(hostname, port, configURL, pid) {
    super(new LeapProvider(`http://${hostname}:${port}`));

    this.id = idCounter++;
    this.hostname = hostname;
    this.port = port;
    this.configURL = configURL;
    this.pid = pid;
  }

  static async spawn(id, port, configURL) {
    const nodeIndex = id + 1;
    console.log(`Starting node ${nodeIndex}. Logs: ./out/node-${nodeIndex}.log`);

    let basePort = port;
    const env = { 
      ...process.env,
      DEBUG: 'tendermint,leap-node*'
    };
    const args = [
      'build/node/index.js',
      '--config', configURL,
      '--rpcaddr', '127.0.0.1',
      '--rpcport', (basePort++).toString(),
      '--wsaddr', '127.0.0.1',
      '--wsport', (basePort++).toString(),
      '--abciPort', (basePort++).toString(),
      '--p2pPort', (basePort++).toString(),
      '--tendermintAddr', '127.0.0.1',
      '--tendermintPort', (basePort++).toString(),
      '--dataPath', `./data/node${nodeIndex}`,
    ];
    
    const logOutput = fs.createWriteStream(`./out/node-${nodeIndex}.log`);

    const proc = spawn('node', args, { env });

    proc.stdout.pipe(logOutput);
    proc.stderr.pipe(logOutput);
    proc.on('exit', exitCode => console.log(`leap-node ${nodeIndex} exited`, exitCode));

    return new Promise(
      async (resolve, reject) => {    
        while (true) {
          let res;
          try {
            // if we construct the rpc provider before the node is up,
            // we will get a uncaught promise rejection because ethers.js
            // invokes a request to it we can not catch :/
            res = await ethers.utils.fetchJson(
              formatHostname('localhost', port),
              '{"jsonrpc":"2.0","id":42,"method":"plasma_getConfig","params":[]}'
            );
          } catch (e) {}
          // ready
          if (res) {
            return resolve(new Node('localhost', port, configURL, proc.pid));
          }
  
          await new Promise((resolve) => setTimeout(() => resolve(), 100));
        }
      }
    );
  }

  async start() {
    const node = await Node.spawn(this.id, this.port, this.configURL);
    console.log(node.pid);
    this.pid = node.pid;
  }

  async stop() {
    console.log(`Stopping node ${this.id + 1}`);
    return process.kill(this.pid, 'SIGHUP');
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
    const { hostname, port, configURL, pid } = this;
    return { hostname, port, configURL, pid };
  }
}

module.exports = Node;

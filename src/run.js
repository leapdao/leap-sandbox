const fs = require('fs');
const spawn = require('child_process').spawn;
const ethers = require('ethers');
const ganache = require('ganache-cli');

const getEnv = require('./getEnv');

const mnemonic = require('./mnemonic');

const Node = require('./nodeClient');
const setup = require('./setup');
const { formatHostname } = require('./helpers');

async function setupGanache(port, mnemonic) {
  return new Promise(
    (resolve, reject) => {
      console.log('Starting ganache..');
      const srv = ganache.server({ locked: false, mnemonic });
      srv.listen(port, (err) => {
        if (err) {
          return reject();
        }
        resolve();
      });
    }
  );
}

async function deployContracts(ganachePort) {
  return new Promise(
    (resolve, reject) => {
      console.log('Deploying contracts.. Logs: ./out/contracts.log');
      const env = {
        ...process.env,
        PROPOSAL_TIME: '0',
        PARENT_BLOCK_INTERVAL: '0',
        ADVANCE_BLOCK: '0',
        EVENTS_DELAY: '1'
      };
      const cwd = process.cwd();
      
      process.chdir(`${cwd}/build/contracts`);
      let truffleConfig = fs.readFileSync('./truffle-config.js').toString();
      // replace the rpc port(s)
      while (true) {
        let tmp = truffleConfig.replace(/port: [0-9]+/g, `port: ${ganachePort.toString()}`);

        if (tmp === truffleConfig) {
          break;
        }
        truffleConfig = tmp;
      }
      fs.writeFileSync('./truffle-config.js', truffleConfig);
      
      let proc = spawn('yarn', ['deploy', '--reset'], { env });
      const logOutput = fs.createWriteStream(`${cwd}/out/contracts.log`);
      proc.stdout.pipe(logOutput);
      proc.stderr.pipe(logOutput);
      proc.on('exit', (exitCode) => {
        process.chdir(cwd);
        
        if (exitCode !== 0) {
          return reject();
        }
        
        resolve();
      });
    }
  );
}

async function spawnNode(rpcPort, args, env, logOutput) {
  return new Promise(
    async (resolve, reject) => {
      const proc = spawn('node', args, { env });

      proc.stdout.pipe(logOutput);
      proc.stderr.pipe(logOutput);
      proc.on('exit', (exitCode) => console.log('leap-node exit', exitCode));

      while (true) {
        let res;
        try {
          // if we construct the rpc provider before the node is up,
          // we will get a uncaught promise rejection because ethers.js
          // invokes a request to it we can not catch :/
          res = await ethers.utils.fetchJson(
            formatHostname('localhost', rpcPort),
            '{"jsonrpc":"2.0","id":42,"method":"plasma_status","params":[]}'
          );
        } catch (e) {}
        // ready
        if (res && res.result === 'ok') {
          const node = new Node('localhost', rpcPort);
          return resolve(node);
        }

        await new Promise((resolve) => setTimeout(() => resolve(), 100));
      }
    }
  );
}

module.exports = async () => {
  const ganachePort = parseInt(process.env['ganache_port']) || 8545;
  // seems like only one connection from the same source addr can connect to the same tendermint instance
  const numNodes = parseInt(process.env['num_nodes']) || 2;

  await setupGanache(ganachePort, mnemonic);
  await deployContracts(ganachePort);
  
  const nodes = [];

  const generatedConfigPath = `${process.cwd()}/build/contracts/build/nodeFiles/generatedConfig.json`;

  let basePort = parseInt(process.env['base_port']) || 7000;
  const firstNodeURL = `http://localhost:${basePort}`;

  for (let i = 0; i < numNodes; i++) {
    const rpcPort = basePort;
    const env = { 
      ...process.env,
      DEBUG: 'tendermint,leap-node*'
    };
    const configURL = i === 0 ? generatedConfigPath : firstNodeURL;
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
      '--devMode', 'true',
    ];

    const logOutput = fs.createWriteStream(`./out/node-${i + 1}.log`);

    console.log(`Starting node ${i + 1} of ${numNodes} Logs: ./out/node-${i + 1}.log`);
    nodes.push(await spawnNode(rpcPort, args, env, logOutput));
  }

  const config = {
    nodes: nodes.map(n => n.toString()),
    ganache: `http://localhost:${ganachePort}`
  };

  fs.writeFileSync('./process.json', JSON.stringify(config, null, 2));

  const { contracts, accounts, wallet, plasmaWallet } = await getEnv();

  await setup(contracts, nodes, accounts, wallet, plasmaWallet);

  console.log('Started');

  console.log(`\n Leap JSON RPC: ${nodes[0].getRpcUrl()}`);
  console.log(`Root chain RPC: http://localhost:${ganachePort}\n`);

  return { contracts, nodes, accounts, wallet, plasmaWallet };
};


const fs = require('fs');
const spawn = require('child_process').spawn;
const ganache = require('ganache-cli');
const rimraf = require('rimraf');

const getEnv = require('./getEnv');

const mnemonic = require('./mnemonic');

const Node = require('./nodeClient');
const setup = require('./setup');

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
        EVENTS_DELAY: '2'
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

module.exports = async () => {
  const ganachePort = parseInt(process.env['ganache_port']) || 8545;
  // seems like only one connection from the same source addr can connect to the same tendermint instance
  const numNodes = parseInt(process.env['num_nodes']) || 2;

  rimraf.sync(`./data`);
  rimraf.sync('./out/*');

  await setupGanache(ganachePort, mnemonic);
  await deployContracts(ganachePort);
  
  const nodes = [];

  const generatedConfigPath = `${process.cwd()}/build/contracts/build/nodeFiles/generatedConfig.json`;

  let basePort = parseInt(process.env['base_port']) || 7000;
  const firstNodeURL = `http://localhost:${basePort}`;

  for (let i = 0; i < numNodes; i++) {
    const configURL = i === 0 ? generatedConfigPath : firstNodeURL;
    nodes.push(await Node.spawn(i, basePort + i * 5, configURL));
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
  console.log('Priv key: ', accounts[0].privKey);
  console.log();

  process.on('exit', () => {
    rimraf.sync(`./data`);
  });

  return { contracts, nodes, accounts, wallet, plasmaWallet };
};


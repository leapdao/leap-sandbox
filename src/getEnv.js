const fs = require('fs');
const ethers = require('ethers');
const LeapProvider = require('leap-provider');

const Node = require('./nodeClient');
const erc20abi = require('./erc20abi');
const mnemonic = require('./mnemonic');

const getAccount = (mnemonic, id, provider) => {
  const wallet = ethers.Wallet
    .fromMnemonic(mnemonic, `m/44'/60'/0'/0/${id}`)
    .connect(provider);
  
  return {
    addr: wallet.address,
    privKey: wallet.privateKey,
    wallet
  }
};

const getAccounts = (mnemonic, num, provider) => {
  const accounts = [];
  for (let i = 0; i < num; i++) {
    accounts.push(getAccount(mnemonic, i, provider));
  }
  return accounts;
};

const readAbi = () => {
  const adminableProxyAbi = require('../build/contracts/build/contracts/AdminableProxy').abi;

    // fix for admin()
    adminableProxyAbi.forEach((obj) => {
      if (obj.name === 'admin') {
        obj.constant = true;
        obj.stateMutability = 'view';
      }
    });
  

  const minGovAbi = require('../build/contracts/build/contracts/MinGov').abi;
  const bridgeAbi = require('../build/contracts/build/contracts/Bridge').abi;
  const exitHandlerAbi = require('../build/contracts/build/contracts/ExitHandler').abi;
  const operatorAbi = require('../build/contracts/build/contracts/PoaOperator').abi;
  return { adminableProxyAbi, minGovAbi, exitHandlerAbi, bridgeAbi, operatorAbi };
};

module.exports.getContracts = async (nodeConfig, wallet) => {
  const abi = readAbi();

  const exitHandler = new ethers.Contract(nodeConfig.exitHandlerAddr, abi.exitHandlerAbi, wallet);
  const operator = new ethers.Contract(nodeConfig.operatorAddr, abi.operatorAbi, wallet);
  const bridge = new ethers.Contract(nodeConfig.bridgeAddr, abi.bridgeAbi, wallet);
  const proxy = new ethers.Contract(nodeConfig.operatorAddr, abi.adminableProxyAbi, wallet);
  
  const governanceAddr = await proxy.admin();
  const governance = new ethers.Contract(governanceAddr, abi.minGovAbi, wallet);

  const tokenAddress = await exitHandler.getTokenAddr(0);
  const token = new ethers.Contract(tokenAddress, erc20abi, wallet);

  return {
    exitHandler,
    operator,
    bridge,
    token,
    governance,
    proxy,
  };
};

const readJSON = (filename) => 
  JSON.parse(fs.readFileSync(filename, { flag: 'a+' }).toString() || '{}');

module.exports.getRootEnv = async () => {
  const { ganache } = readJSON('./process.json');
  const rootProvider = new ethers.providers.JsonRpcProvider(ganache);
  await rootProvider.ready;
  const wallet = ethers.Wallet.fromMnemonic(mnemonic).connect(rootProvider);
  const accounts = getAccounts(mnemonic, 10, rootProvider);

  return { wallet, accounts, ganache };
};

module.exports.getPlasmaEnv = async () => {
  const config = readJSON('./process.json');
  const nodes = config.nodes.map(n => new Node(n.hostname, n.port));
  const networkConfig = await nodes[0].getConfig();
  const plasmaProvider = new LeapProvider(nodes[0].getRpcUrl());
  const plasmaWallet = ethers.Wallet.fromMnemonic(mnemonic).connect(plasmaProvider);

  return { nodes, plasmaWallet, networkConfig };
};

module.exports.getEnv = async () => {
  const { accounts, wallet } = await getRootEnv();
  const { networkConfig, plasmaWallet, nodes } = await getPlasmaEnv();
  const contracts = await getContracts(networkConfig, wallet);

  return {
    contracts,
    accounts,
    nodes,
    wallet,
    plasmaWallet
  };
};
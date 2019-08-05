const ethers = require('ethers');

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

const getContracts = async (nodeConfig, wallet) => {
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

module.exports = async () => {
  
  const networkProcess = require('../process.json');
  const nodes = networkProcess.nodes.map(n => new Node(n.hostname, n.port, n.configURL, n.pid))

  const nodeConfig = await nodes[0].getConfig();

  const rootProvider = new ethers.providers.JsonRpcProvider(networkProcess.ganache);
  const wallet = ethers.Wallet.fromMnemonic(mnemonic).connect(rootProvider);

  const plasmaProvider = new ethers.providers.JsonRpcProvider(nodes[0].getRpcUrl());
  const plasmaWallet = ethers.Wallet.fromMnemonic(mnemonic).connect(plasmaProvider);

  const accounts = getAccounts(mnemonic, 10, rootProvider);

  return {
    contracts: await getContracts(nodeConfig, wallet),
    accounts,
    nodes,
    wallet,
    plasmaWallet
  };
};
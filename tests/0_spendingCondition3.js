const { sleep, sendRawTx } = require('../src/helpers');
const mintAndDeposit = require('./actions/mintAndDeposit');
const { transfer } = require('./actions/transfer');
const exitUnspent = require('./actions/exitUnspent');
const should = require('chai').should();
const ethUtil = require('ethereumjs-util');
const simpleMultiSigConditionABI = require('../src/simpleMultiSigConditionABI');
const { helpers, Tx, Outpoint, Input, Output } = require('leap-core');

module.exports = async function(contracts, nodes, accounts, web3) {
    const minter = accounts[0].addr;
    const alice = accounts[1].addr;
    const alicePriv = accounts[1].privKey;
    const bob = accounts[2].addr;
    const bobPriv = accounts[2].privKey;
    const charlie = accounts[3].addr;
    const charliePriv = accounts[3].privKey;
    const zzz = accounts[9].addr;
    const amount = 10000000;
    const spCode = '0x608060405234801561001057600080fd5b50600436106100395760e060020a60003504631625e5b6811461003e5780634f75c4641461009a575b600080fd5b610098600480360361010081101561005557600080fd5b50600160a060020a03813581169160208101359160408201359160ff606082013581169260808301359260a08101359260c0820135169160e0909101351661013d565b005b610098600480360360408110156100b057600080fd5b810190602081018135602060020a8111156100ca57600080fd5b8201836020820111156100dc57600080fd5b803590602001918460208302840111602060020a831117156100fd57600080fd5b919080806020026020016040519081016040528093929190818152602001838360200280828437600092019190915250929550509135925061045f915050565b6040805160008082526020808301808552606060020a6001606060020a03193082021604905260ff891683850152606083018b9052608083018a90529251909260019260a080820193601f1981019281900390910190855afa1580156101a7573d6000803e3d6000fd5b505060408051601f198082015160008084526020848101808752606060020a6001606060020a03193082021604905260ff8a1685870152606085018c9052608085018b90529451919650945060019360a0808501949193830192918290030190855afa15801561021b573d6000803e3d6000fd5b5050604051601f190151915050600160a060020a03828116908216141561024157600080fd5b600160a060020a03821673ced6cec7891276e58d9434426831709fcbdd0c4914806102885750600160a060020a0382167389c368c9bff1cb5e374e76de3c5b744dbc1d23fc145b806102af5750600160a060020a038216732b2b598faba3661c2e4eaa75f9e6a111d860a86d145b15156102ba57600080fd5b600160a060020a03811673ced6cec7891276e58d9434426831709fcbdd0c4914806103015750600160a060020a0381167389c368c9bff1cb5e374e76de3c5b744dbc1d23fc145b806103285750600160a060020a038116732b2b598faba3661c2e4eaa75f9e6a111d860a86d145b151561033357600080fd5b6040805160e060020a6370a0823102815230600482018190529151859291600091600160a060020a038516916370a08231916024808301926020929190829003018186803b15801561038457600080fd5b505afa158015610398573d6000803e3d6000fd5b505050506040513d60208110156103ae57600080fd5b8101908080519060200190929190505050905082600160a060020a031663a9059cbb8e836040518363ffffffff1660e060020a0281526004018083600160a060020a0316600160a060020a0316815260200182815260200192505050602060405180830381600087803b15801561042457600080fd5b505af1158015610438573d6000803e3d6000fd5b505050506040513d602081101561044e57600080fd5b505050505050505050505050505050565b3373ced6cec7891276e58d9434426831709fcbdd0c4914806104945750337389c368c9bff1cb5e374e76de3c5b744dbc1d23fc145b806104b2575033732b2b598faba3661c2e4eaa75f9e6a111d860a86d145b1561056e576040805160e260020a6313dd7119028152602481018390526004810191825283516044820152835173bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb928392634f75c464928792879290918291606401906020808701910280838360005b8381101561052e578181015183820152602001610516565b505050509050019350505050600060405180830381600087803b15801561055457600080fd5b505af1158015610568573d6000803e3d6000fd5b50505050505b505056fea165627a7a72305820b192fea5e9a910438c8bea69002799a5438934963359561709b9fb7bf2d64c510029';
    const codeBuf = Buffer.from(spCode.replace('0x', ''), 'hex');
    const spAddrBuf = ethUtil.ripemd160(codeBuf);
    const spAddr = `0x${spAddrBuf.toString('hex')}`;

    console.log("╔══════════════════════════════════════════╗");
    console.log("║    Test: Fund SP and claim from it       ║");
    console.log("║Steps:                                    ║");
    console.log("║1. Fund SP by Alice                       ║");
    console.log("║2. Claim from SP by Bob                   ║");
    console.log("╚══════════════════════════════════════════╝");
    let plasmaBalanceBefore = (await nodes[0].web3.eth.getBalance(alice)) * 1;
    await mintAndDeposit(alice, amount, minter, contracts.token, contracts.exitHandler, true);
    await sleep(8000);
    let plasmaBalanceAfter = (await nodes[0].web3.eth.getBalance(alice)) * 1;
    plasmaBalanceAfter.should.be.equal(plasmaBalanceBefore + amount);
    let txAmount = amount;
    let balanceAlice = (await nodes[0].web3.eth.getBalance(alice)) * 1;
    let balanceSp = (await nodes[0].web3.eth.getBalance(spAddr)) * 1;

    const transferTx = await transfer(
        alice, 
        alicePriv, 
        spAddr, 
        txAmount, 
        nodes[0]);
        
    ((await nodes[0].web3.eth.getBalance(alice)) * 1).should.be.equal(balanceAlice - txAmount);
    ((await nodes[0].web3.eth.getBalance(spAddr)) * 1).should.be.equal(balanceSp + txAmount);
    console.log("Balances before SP TX:");
    balanceBob = (await nodes[0].web3.eth.getBalance(bob)) * 1;
    console.log('bob: ', balanceBob);
    let balanceZzz = (await nodes[0].web3.eth.getBalance(zzz)) * 1;
    console.log('receiver: ', balanceZzz);
    balanceSp = (await nodes[0].web3.eth.getBalance(spAddr)) * 1;
    console.log('sp: ', balanceSp);


    const condTx = Tx.spendCond(
        [
          new Input({
            prevout: new Outpoint(transferTx.hash(), 0),
            gasPrice: 0,
            script: spCode,
          }),
        ],
        [new Output(amount, zzz, 0)]
    );

    
    const sigAlice = condTx.getConditionSig(alicePriv);
    const sigBob = condTx.getConditionSig(bobPriv);
    const condition = new web3.eth.Contract(simpleMultiSigConditionABI, spAddr);
    const msgData = (await condition.methods.fulfil(
        zzz,
        `0x${sigAlice.r.toString('hex')}`, 
        `0x${sigAlice.s.toString('hex')}`, 
        sigAlice.v,
        `0x${sigAlice.r.toString('hex')}`, 
        `0x${sigAlice.s.toString('hex')}`, 
        sigBob.v, 
        contracts.token.options.address))
        .encodeABI();  
    condTx.inputs[0].setMsgData(msgData);
  
    resp = await sendRawTx(nodes[0].web3, condTx.hex());
    console.log(resp);
    await sleep(3000);  

    console.log("Balances after SP TX:");
    balanceBob = (await nodes[0].web3.eth.getBalance(bob)) * 1;
    console.log('bob: ', balanceBob);
    const balanceZzzNew = (await nodes[0].web3.eth.getBalance(zzz)) * 1;
    console.log('receiver: ', balanceZzzNew);
    balanceSp = (await nodes[0].web3.eth.getBalance(spAddr)) * 1;
    console.log('sp: ', balanceSp);

    if (balanceZzz == balanceZzzNew) {
        throw Error('transfer failed');
    }

    console.log("╔══════════════════════════════════════════╗");
    console.log("║    Test: Fund SP and claim from it       ║");
    console.log("║             Completed                    ║");                     
    console.log("╚══════════════════════════════════════════╝");
}
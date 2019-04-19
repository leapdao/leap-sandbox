const { advanceBlocks } = require('../src/helpers');
const erc20abi = require('../src/erc20abi');
const SimpleToken = require('../build/contracts/build/contracts/SimpleToken');
const chai = require("chai");
const { assert } = chai;
const chaiAsPromised = require("chai-as-promised");
chai.use(chaiAsPromised);

module.exports = async function(contracts, [node], accounts, web3) {
    const minter = accounts[0].addr;

    console.log("Registering another token...");

    const beforeColors = await node.web3.getColors();
    console.log('Initial state');
    console.log('   Token count:', beforeColors.length);
    console.log('   Tokens:', beforeColors);

    console.log('Deploying new ERC20 token..');
    const erc20Contract = new web3.eth.Contract(erc20abi);
    simpleToken = await erc20Contract.deploy({ data: SimpleToken.bytecode }).send({
        from: accounts[0].addr,
        gas: 1712388,
        gasPrice: 100000000000
    });
    console.log('   Address:', simpleToken.options.address);

    console.log('Submitting registerToken proposal..');
    const data = contracts.exitHandler.methods.registerToken(simpleToken.options.address, false).encodeABI();
    console.log('   Subject:', contracts.exitHandler.options.address)
    console.log('   Data:', data)
    await contracts.governance.methods.propose(contracts.exitHandler.options.address, data).send({
      from: minter, gas: 2000000, gasPrice: 100000000000
    });
    
    console.log('Finalizing proposal..');
    await contracts.governance.methods.finalize().send({
        from: minter, gas: 1000000, gasPrice: 100000000000 
    });

    // wait for event buffer
    await advanceBlocks(128, web3);

    const afterColors = await node.web3.getColors();
    console.log('Checking..');

    assert.equal(afterColors.length, 2, 'Token count');
    console.log('   ✅ Token count:', afterColors.length);

    assert.deepEqual(
        beforeColors.concat([simpleToken.options.address]),
        afterColors,
        "getColors()"
    );
    console.log('   ✅ getColors(): ' + afterColors);

    assert.equal(
        await node.web3.getColor(simpleToken.options.address),
        1,
        "getColor()"
    );
    console.log(`   ✅ getColor(${simpleToken.options.address}): 1`);
}

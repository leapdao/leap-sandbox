module.exports = async function(contracts, nodes, accounts, web3) {
    let unspents = await nodes[0].web3.getUnspent(accounts[0].addr);
    console.log(unspents);
    unspents = await nodes[0].web3.getUnspent(accounts[1].addr);
    console.log(unspents);
}
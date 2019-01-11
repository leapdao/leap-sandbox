module.exports = async function(alice, amount, minter, token, exitHandler, noLog = false) {
  let log;
  if (noLog) {
    log = function(){};
  } else {
    log = console.log;    
  }
  
  log(`------Will mint and deposit ${amount} tokens for ${alice}------`);
  log(`Minting token to account ${alice}...`);
  //await token.methods.mint(alice, amount).send({from: minter});
  await token.methods.transfer(alice, amount).send({from: minter});
  log(`Aprroving ${amount} tokens for deposit...`);
  await token.methods.approve(exitHandler.options.address, amount).send({from: alice});
  log(`Depositing ${amount} tokens...`);
  await exitHandler.methods.deposit(alice, amount, 0).send({
    from: alice,
    gas: 2000000
  });
}
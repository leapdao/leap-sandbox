const path = require('path');
const fs = require('fs');
const startNetwork = require('../run');
const nyan = require('nyan-js');

require('chai').should();

const getTests = async () => {
  const testPath = path.join(__dirname, '../../tests');
  const tests = fs
    .readdirSync(testPath)
    .filter(fileName =>
        fileName.endsWith('.js') && fs.lstatSync('./tests/' + fileName).isFile()
    );
  return tests;
};

async function run() {
  const env = await startNetwork();

  const tests = await getTests();
  for (const test of tests) {
    console.log('Running: ', test);
    await require('../../tests/' + test)(env);
  }
  if (process.env.CI || process.env.TRAVIS) {
    process.exit(0);
  }
  var opts = {
    colors: true, // use colors instead of just raw ascii
    pure: true, // use solid colors only
    stream: { write: data => console.log(data) } // an object with a write function to do something with the frames.
  };
  nyan(opts);
  setTimeout(function(){
    process.exit(0);
  }, 10000);
}

function onException(e) {
  console.error(e);
  process.exit(1);
}

process.on('uncaughtException', onException);
process.on('unhandledRejection', onException);

run();

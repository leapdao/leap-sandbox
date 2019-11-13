const path = require('path');
const fs = require('fs');
const startNetwork = require('../run');

require('chai').should();

const getTests = async () => {
  const testPath = path.join(__dirname, '../../tests');
  if (process.argv[2]) {
    return [process.argv[2]];
  };
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

  process.exit(0);
}

function onException(e) {
  console.error(e);
  process.exit(1);
}

process.on('uncaughtException', onException);
process.on('unhandledRejection', onException);

run();

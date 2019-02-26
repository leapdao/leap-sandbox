const challenge = require('./challenge');

const { FIRST_HASH, SECOND_HASH, NODE_URL, PROVIDER_URL, PRIV_KEY, VALIDATOR_ADDR } = process.env;

challenge(FIRST_HASH, SECOND_HASH, NODE_URL, PROVIDER_URL, PRIV_KEY, VALIDATOR_ADDR);
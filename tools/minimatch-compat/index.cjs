// Preserve the legacy callable CommonJS API using the patched v11 matcher.
const engine = require('@sacramentum/minimatch-engine');
module.exports = Object.assign((...args) => engine.minimatch(...args), engine);

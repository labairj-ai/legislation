module.exports = {
  apps: [{
    name: 'legislation',
    script: 'index.js',
    cwd: '/home/optiplex/legislation/server',
    env: {
      NODE_ENV: 'production',
      PORT: 5200,
      DB_PATH: '/home/optiplex/legislation/legislation.db',
    },
  }],
};

module.exports = {
  apps: [
    {
      name: 'tabflow-api',
      script: './node_modules/.bin/tsx',
      args: 'src/index.ts',
      cwd: './apps/api',
      watch: false,
      autorestart: true,
      env: {
        NODE_ENV: 'development',
      },
    },
  ],
};

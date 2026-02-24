module.exports = {
  apps: [
    {
      name: 'tabflow-api',
      script: 'node_modules/tsx/dist/cli.mjs',
      args: 'src/index.ts',
      interpreter: 'node',
      cwd: './apps/api',
      watch: false,
      autorestart: true,
      env: {
        NODE_ENV: 'development',
      },
    },
  ],
};

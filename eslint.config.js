import config from '@bifravst/eslint-config-typescript'
export default [
	...config,
	{
		ignores: [
			'cli/index.js',
			'scripts/pack-app.js',
			'scripts/pack-mock-http-api-app.js',
			'**/handler.mjs',
			'dist/**'
		],
	},
]

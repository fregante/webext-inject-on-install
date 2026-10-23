import globals from 'globals';

/**
@type {import('xo').FlatXoConfig}
*/
const xoConfig = [
	{
		ignores: ['demo/package.json'],
	},
	{
		languageOptions: {
			globals: {
				...globals.browser,
				chrome: 'readonly',
			},
		},
		rules: {
			'unicorn/prefer-top-level-await': 'off',
		},
	},
];

export default xoConfig;

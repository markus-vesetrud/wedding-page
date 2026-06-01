import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		alias: {
			$shared: '../shared'
		},
		adapter: adapter({
			fallback: 'index.html'
		})
	}
};

export default config;

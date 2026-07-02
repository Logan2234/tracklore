import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			// adapter-node: the web app ships as a plain Node server, self-hostable in Docker.
			adapter: adapter()
		}),
		SvelteKitPWA({
			registerType: 'autoUpdate',
			manifest: {
				name: 'Tracklore',
				short_name: 'Tracklore',
				description: 'Self-hosted tracker for series, movies and anime',
				theme_color: '#0e0f13',
				background_color: '#0e0f13',
				display: 'standalone',
				start_url: '/',
				// TODO: add 192/512 PNG (+ maskable) icons for a fully installable PWA.
				icons: [
					{
						src: '/favicon.svg',
						sizes: 'any',
						type: 'image/svg+xml',
						purpose: 'any'
					}
				]
			}
		})
	]
});

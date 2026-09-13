// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// Canonical docs site: https://docs.devhub.nrawangbatin.my.id
// Contract with app/src/lib/docs-urls.ts — do NOT rename these slugs:
//   / -> home, /mcp, /privacy, /terms, /roadmap, /status, /billing
// i18n: defaultLocale 'en' lives at root (/privacy), Indonesian at /id/*.
export default defineConfig({
	site: 'https://docs.devhub.nrawangbatin.my.id',
	integrations: [
		starlight({
			title: 'DevHub Docs',
			description: 'Technical memory workspace docs — MCP, billing, roadmap, status, legal.',
// i18n: defaultLocale 'root' (English, prefix-less: /privacy) + 'id' at /id/*.
// The 'root' pattern is required — with a named default locale (e.g. 'en'),
// Starlight builds the 404 sidebar with locale 'en' and explicit sidebar
// slugs miss their routes. See Starlight multilingual docs.
			defaultLocale: 'root',
			locales: {
				root: { label: 'English', lang: 'en' },
				id: { label: 'Indonesia', lang: 'id' },
			},
			social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com' }],
			sidebar: [
				{
					label: 'Guides',
					translations: { id: 'Panduan' },
					items: [
						{ label: 'MCP Integration', translations: { id: 'Integrasi MCP' }, slug: 'mcp' },
						{ label: 'Billing & Pricing', translations: { id: 'Billing & Harga' }, slug: 'billing' },
						{ label: 'Roadmap', translations: { id: 'Peta jalan' }, slug: 'roadmap' },
						{ label: 'Status', translations: { id: 'Status' }, slug: 'status' },
					],
				},
				{
					label: 'Legal',
					translations: { id: 'Legal' },
					items: [
						{ label: 'Privacy Policy', translations: { id: 'Kebijakan Privasi' }, slug: 'privacy' },
						{ label: 'Terms of Service', translations: { id: 'Syarat Layanan' }, slug: 'terms' },
					],
				},
			],
			head: [
				{ tag: 'meta', attrs: { name: 'robots', content: 'index,follow' } },
				{ tag: 'meta', attrs: { property: 'og:site_name', content: 'DevHub Docs' } },
			],
		}),
	],
});

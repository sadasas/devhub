// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// Canonical docs site: https://docs.devhub.nrawangbatin.my.id
// Contract with app/src/lib/docs-urls.ts — do NOT rename these slugs:
//   / -> home, /mcp, /privacy, /terms, /roadmap, /status, /billing,
//   /features, /features/{issues,schema,decisions,milestones,tasks,api-docs,whiteboard,testing}
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
					label: 'Features',
					translations: { id: 'Fitur' },
					items: [
						{ label: 'Features', translations: { id: 'Fitur' }, slug: 'features' },
						{ label: 'Issues', translations: { id: 'Isu' }, slug: 'features/issues' },
						{ label: 'Database schema', translations: { id: 'Skema database' }, slug: 'features/schema' },
						{ label: 'Decisions (ADRs)', translations: { id: 'Keputusan (ADR)' }, slug: 'features/decisions' },
						{ label: 'Milestones & releases', translations: { id: 'Milestone & rilis' }, slug: 'features/milestones' },
						{ label: 'Tasks & board', translations: { id: 'Tugas & papan' }, slug: 'features/tasks' },
						{ label: 'API docs', translations: { id: 'Dokumentasi API' }, slug: 'features/api-docs' },
						{ label: 'Whiteboards', translations: { id: 'Whiteboard' }, slug: 'features/whiteboard' },
						{ label: 'Test cases', translations: { id: 'Test case' }, slug: 'features/testing' },
					],
				},
				{
					label: 'Guides',
					translations: { id: 'Panduan' },
					items: [
						{ label: 'MCP Integration', translations: { id: 'Integrasi MCP' }, slug: 'mcp' },
						{ label: 'AI Agent Skill', translations: { id: 'Skill Agen AI' }, slug: 'agent-skill' },
						{ label: 'Project Integrations', translations: { id: 'Integrasi Proyek' }, slug: 'integrations' },
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

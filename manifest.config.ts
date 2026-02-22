import { defineManifest } from '@crxjs/vite-plugin'
import pkg from './package.json'

export default defineManifest({
  manifest_version: 3,
  name: pkg.name,
  version: pkg.version,
  icons: {
    48: 'public/logo.png',
  },
  action: {
    default_icon: {
      48: 'public/logo.png',
    },
    default_popup: 'src/popup/index.html',
  },
  content_scripts: [{
    js: ['src/content/main.ts'],
    // restrict to YouTube only
    matches: ['https://www.youtube.com/*'],
  }],
    oauth2: {
    client_id: '316008795201-gkc93bslujdvfndr8urqhnf2n7m0nnsp.apps.googleusercontent.com',
    scopes: [
      'https://www.googleapis.com/auth/youtube.readonly'
    ]
    },
  permissions: ['identity', 'storage', 'tabs', 'sidePanel'],
  host_permissions: [
    'https://www.googleapis.com/*',
    'https://www.youtube.com/*',
    'https://accounts.google.com/*',
    'https://oauth2.googleapis.com/*'
  ],
  side_panel: {
    default_path: 'src/sidepanel/index.html',
  },
})

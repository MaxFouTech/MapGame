// Colour themes for the map: country palette, water, non-playable land, the
// globe backdrop and the border stroke. The map/globe read the active theme
// at build time, so switching theme simply rebuilds the map.
//
// Each palette has 10 mutually-distinct colours — the greedy graph colouring
// picks from them so neighbours never share a colour.

export const THEMES = {
  atlas: {
    name: { en: 'Atlas', fr: 'Atlas' },
    palette: ['#eac86e', '#f0a35e', '#df6e56', '#3aa189', '#94b877',
              '#b46684', '#8d90c9', '#a97bc0', '#c2a25b', '#7fb3ab'],
    ocean: '#cfe0ea', land: '#d9d5cc', background: '#e9eef2', stroke: '#ffffff',
  },
  ocean: {
    name: { en: 'Ocean', fr: 'Océan' },
    palette: ['#3d8b9e', '#57a6a0', '#6fb59a', '#4f96b8', '#7fb0c4',
              '#5aa1a8', '#68b3ab', '#8cc0b0', '#48889b', '#79bcae'],
    ocean: '#d3e8ee', land: '#c8d4d4', background: '#e2f0f2', stroke: '#ffffff',
  },
  terracotta: {
    name: { en: 'Terracotta', fr: 'Terracotta' },
    palette: ['#c9724a', '#d98e5a', '#e0a86b', '#b5834e', '#a9633f',
              '#caa15e', '#9a8248', '#bd8b62', '#d5a15c', '#8f6b45'],
    ocean: '#d7c8b0', land: '#ddceb4', background: '#e7dcc7', stroke: '#fbf6ec',
  },
  forest: {
    name: { en: 'Forest', fr: 'Forêt' },
    palette: ['#3f8d5f', '#5ba36b', '#7cb87a', '#98c98a', '#4f9e77',
              '#6fb58f', '#88c39a', '#a7d0a0', '#5a9d6a', '#7ec48c'],
    ocean: '#cfe4e0', land: '#d5dcc9', background: '#e4efe8', stroke: '#ffffff',
  },
  sepia: {
    name: { en: 'Vintage', fr: 'Sépia' },
    palette: ['#b99a6b', '#caa878', '#a98a5c', '#d8bd8f', '#8f7550',
              '#c4a06f', '#b08a5a', '#dcc79a', '#9c8258', '#c9b184'],
    ocean: '#e7d9be', land: '#ddccac', background: '#efe4cd', stroke: '#8a744f',
  },
  night: {
    name: { en: 'Night', fr: 'Nuit' },
    palette: ['#5c8fd6', '#5ab0a0', '#c98fd0', '#e0a15c', '#d97b8f',
              '#7d9bd6', '#6fc0a8', '#c9a15c', '#a97bc0', '#7fb3ab'],
    ocean: '#0e1a2b', land: '#26313f', background: '#0b1521', stroke: '#1a2735',
  },
  pastel: {
    name: { en: 'Pastel', fr: 'Pastel' },
    palette: ['#f0aeb9', '#f6cfa2', '#f3e3a0', '#bfe3b0', '#a9dcd0',
              '#b8cdef', '#d3bce8', '#f2c0d4', '#c9e2a8', '#a6d4e0'],
    ocean: '#eaf3fb', land: '#ececec', background: '#f2f7fc', stroke: '#ffffff',
  },
  vivid: {
    name: { en: 'Vivid', fr: 'Vif' },
    palette: ['#e8453c', '#f5952a', '#f7d030', '#3fb84f', '#1fb6b0',
              '#2f7de1', '#7b52d0', '#e0479e', '#8fce2b', '#00a3a3'],
    ocean: '#bfe0f0', land: '#d5d5d5', background: '#dff0f8', stroke: '#ffffff',
  },
  slate: {
    name: { en: 'Slate', fr: 'Ardoise' },
    palette: ['#8a97a3', '#a7b2bc', '#c2cad2', '#6f7d8a', '#9aa6b0',
              '#b4bec6', '#7e8b97', '#aeb8c0', '#8f9ba6', '#c9d0d6'],
    ocean: '#e4e9ee', land: '#d5dadf', background: '#eef1f4', stroke: '#ffffff',
  },
  contrast: {
    name: { en: 'High contrast', fr: 'Contraste élevé' },
    palette: ['#e69f00', '#56b4e9', '#009e73', '#f0e442', '#0072b2',
              '#d55e00', '#cc79a7', '#999999', '#8c6d31', '#44aa99'],
    ocean: '#d6e6f2', land: '#cccccc', background: '#e6eff7', stroke: '#333333',
  },
};

export const DEFAULT_THEME = 'atlas';
export const THEME_ORDER = ['atlas', 'ocean', 'terracotta', 'forest', 'sepia',
  'night', 'pastel', 'vivid', 'slate', 'contrast'];

let activeKey = DEFAULT_THEME;

export function setActiveTheme(key) {
  if (THEMES[key]) activeKey = key;
}
export function activeThemeKey() { return activeKey; }
export function theme() { return THEMES[activeKey]; }

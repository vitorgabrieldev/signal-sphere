import { WORLD_HEIGHT, WORLD_WIDTH } from './gameConfig.js';

export const CITY_CENTER_X = WORLD_WIDTH / 2;
export const CITY_CENTER_Z = WORLD_HEIGHT / 2;

export const CITY_ROADS = [
  {
    x: CITY_CENTER_X,
    z: CITY_CENTER_Z,
    width: WORLD_WIDTH - 220,
    depth: 180,
    lane: 'horizontal'
  },
  {
    x: CITY_CENTER_X,
    z: CITY_CENTER_Z,
    width: 200,
    depth: WORLD_HEIGHT - 220,
    lane: 'vertical'
  },
  {
    x: CITY_CENTER_X - 760,
    z: CITY_CENTER_Z,
    width: 160,
    depth: 860,
    lane: 'vertical'
  },
  {
    x: CITY_CENTER_X + 760,
    z: CITY_CENTER_Z,
    width: 160,
    depth: 860,
    lane: 'vertical'
  },
  {
    x: CITY_CENTER_X,
    z: CITY_CENTER_Z - 560,
    width: 1360,
    depth: 150,
    lane: 'horizontal'
  },
  {
    x: CITY_CENTER_X,
    z: CITY_CENTER_Z + 560,
    width: 1360,
    depth: 150,
    lane: 'horizontal'
  }
];

export const CITY_PLAZAS = [
  {
    x: CITY_CENTER_X,
    z: CITY_CENTER_Z,
    width: 440,
    depth: 440,
    color: '#2d4650'
  },
  {
    x: CITY_CENTER_X + 350,
    z: CITY_CENTER_Z,
    width: 180,
    depth: 150,
    color: '#2f4147'
  }
];

export const CITY_SIDEWALKS = [
  {
    x: CITY_CENTER_X,
    z: CITY_CENTER_Z - 132,
    width: WORLD_WIDTH - 240,
    depth: 54
  },
  {
    x: CITY_CENTER_X,
    z: CITY_CENTER_Z + 132,
    width: WORLD_WIDTH - 240,
    depth: 54
  },
  {
    x: CITY_CENTER_X - 132,
    z: CITY_CENTER_Z,
    width: 54,
    depth: WORLD_HEIGHT - 240
  },
  {
    x: CITY_CENTER_X + 132,
    z: CITY_CENTER_Z,
    width: 54,
    depth: WORLD_HEIGHT - 240
  },
  {
    x: CITY_CENTER_X - 866,
    z: CITY_CENTER_Z,
    width: 48,
    depth: 860
  },
  {
    x: CITY_CENTER_X - 654,
    z: CITY_CENTER_Z,
    width: 48,
    depth: 860
  },
  {
    x: CITY_CENTER_X + 654,
    z: CITY_CENTER_Z,
    width: 48,
    depth: 860
  },
  {
    x: CITY_CENTER_X + 866,
    z: CITY_CENTER_Z,
    width: 48,
    depth: 860
  },
  {
    x: CITY_CENTER_X,
    z: CITY_CENTER_Z - 658,
    width: 1360,
    depth: 42
  },
  {
    x: CITY_CENTER_X,
    z: CITY_CENTER_Z - 462,
    width: 1360,
    depth: 42
  },
  {
    x: CITY_CENTER_X,
    z: CITY_CENTER_Z + 462,
    width: 1360,
    depth: 42
  },
  {
    x: CITY_CENTER_X,
    z: CITY_CENTER_Z + 658,
    width: 1360,
    depth: 42
  }
];

export const CITY_BUILDINGS = [
  {
    type: 'tower',
    x: CITY_CENTER_X - 500,
    z: CITY_CENTER_Z - 340,
    width: 170,
    depth: 150,
    height: 230,
    body: '#315a71',
    accent: '#8de8ff'
  },
  {
    type: 'tower',
    x: CITY_CENTER_X - 260,
    z: CITY_CENTER_Z - 340,
    width: 140,
    depth: 140,
    height: 180,
    body: '#27465d',
    accent: '#79ffc4'
  },
  {
    type: 'tower',
    x: CITY_CENTER_X + 500,
    z: CITY_CENTER_Z - 335,
    width: 170,
    depth: 150,
    height: 240,
    body: '#344d74',
    accent: '#ffe383'
  },
  {
    type: 'tower',
    x: CITY_CENTER_X + 260,
    z: CITY_CENTER_Z - 340,
    width: 150,
    depth: 130,
    height: 170,
    body: '#405364',
    accent: '#ffd36e'
  },
  {
    type: 'tower',
    x: CITY_CENTER_X - 500,
    z: CITY_CENTER_Z + 350,
    width: 170,
    depth: 150,
    height: 220,
    body: '#29556a',
    accent: '#7ee6ff'
  },
  {
    type: 'tower',
    x: CITY_CENTER_X - 260,
    z: CITY_CENTER_Z + 350,
    width: 145,
    depth: 135,
    height: 165,
    body: '#44596c',
    accent: '#ffae72'
  },
  {
    type: 'tower',
    x: CITY_CENTER_X + 500,
    z: CITY_CENTER_Z + 340,
    width: 170,
    depth: 150,
    height: 235,
    body: '#304a64',
    accent: '#7fffb4'
  },
  {
    type: 'tower',
    x: CITY_CENTER_X + 260,
    z: CITY_CENTER_Z + 340,
    width: 140,
    depth: 135,
    height: 175,
    body: '#46566c',
    accent: '#b3f07b'
  },
  {
    type: 'house',
    x: CITY_CENTER_X - 1110,
    z: CITY_CENTER_Z - 470,
    width: 86,
    depth: 98,
    height: 58,
    body: '#ef8d6e',
    roof: '#5c2e34'
  },
  {
    type: 'house',
    x: CITY_CENTER_X - 965,
    z: CITY_CENTER_Z - 470,
    width: 92,
    depth: 94,
    height: 62,
    body: '#f1c36c',
    roof: '#734125'
  },
  {
    type: 'house',
    x: CITY_CENTER_X - 1100,
    z: CITY_CENTER_Z + 470,
    width: 84,
    depth: 96,
    height: 58,
    body: '#7bd2a7',
    roof: '#264a3e'
  },
  {
    type: 'house',
    x: CITY_CENTER_X - 955,
    z: CITY_CENTER_Z + 470,
    width: 90,
    depth: 92,
    height: 60,
    body: '#86b8ff',
    roof: '#2a3958'
  },
  {
    type: 'house',
    x: CITY_CENTER_X + 1100,
    z: CITY_CENTER_Z - 470,
    width: 84,
    depth: 96,
    height: 58,
    body: '#ffb27a',
    roof: '#6a3030'
  },
  {
    type: 'house',
    x: CITY_CENTER_X + 955,
    z: CITY_CENTER_Z - 470,
    width: 90,
    depth: 92,
    height: 60,
    body: '#79d8d2',
    roof: '#2c5159'
  },
  {
    type: 'house',
    x: CITY_CENTER_X + 1100,
    z: CITY_CENTER_Z + 470,
    width: 86,
    depth: 98,
    height: 58,
    body: '#f3d16f',
    roof: '#6f4732'
  },
  {
    type: 'house',
    x: CITY_CENTER_X + 955,
    z: CITY_CENTER_Z + 470,
    width: 90,
    depth: 92,
    height: 60,
    body: '#fb9393',
    roof: '#61353b'
  },
  {
    type: 'hub',
    x: CITY_CENTER_X + 350,
    z: CITY_CENTER_Z,
    width: 132,
    depth: 98,
    height: 70,
    body: '#a76f5d',
    accent: '#f3c676'
  }
];

export const CITY_TREES = [
  { x: CITY_CENTER_X - 120, z: CITY_CENTER_Z - 110, scale: 1.1 },
  { x: CITY_CENTER_X + 120, z: CITY_CENTER_Z - 110, scale: 1.15 },
  { x: CITY_CENTER_X - 120, z: CITY_CENTER_Z + 110, scale: 1.05 },
  { x: CITY_CENTER_X + 120, z: CITY_CENTER_Z + 110, scale: 1.1 },
  { x: CITY_CENTER_X - 860, z: CITY_CENTER_Z - 140, scale: 1 },
  { x: CITY_CENTER_X - 860, z: CITY_CENTER_Z + 150, scale: 1.05 },
  { x: CITY_CENTER_X + 860, z: CITY_CENTER_Z - 150, scale: 1.05 },
  { x: CITY_CENTER_X + 860, z: CITY_CENTER_Z + 140, scale: 1 }
];

export const CITY_BENCHES = [
  { x: CITY_CENTER_X - 60, z: CITY_CENTER_Z - 175, rotation: 0 },
  { x: CITY_CENTER_X + 60, z: CITY_CENTER_Z + 175, rotation: Math.PI },
  { x: CITY_CENTER_X - 175, z: CITY_CENTER_Z + 55, rotation: Math.PI / 2 },
  { x: CITY_CENTER_X + 175, z: CITY_CENTER_Z - 55, rotation: -Math.PI / 2 }
];

export const CITY_OBSTACLES = CITY_BUILDINGS.map((building) => ({
  x: building.x,
  z: building.z,
  width: building.width + 14,
  depth: building.depth + 14
}));

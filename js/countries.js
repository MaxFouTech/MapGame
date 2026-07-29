// Curated playable countries. Two independent progressions ("modes") over
// the SAME 197 countries:
//   - difficulty: 8 levels ordered by notoriety (most-known first);
//   - zone:       5 levels, one per continent.
// Country keys are the exact `properties.name` values from world-atlas
// countries-50m.json. Anything not listed renders as a non-playable
// territory (muted color, never asked).

import { getLang } from './i18n.js';

// ----- Difficulty mode: ordered by how well-known each country is. -----
const DIFFICULTY = [
  { n: 1, en: 'Must-know', fr: 'Incontournables', world: true, countries: [
    'France', 'Germany', 'United Kingdom', 'Italy', 'Spain', 'Portugal',
    'Netherlands', 'Belgium', 'Switzerland', 'Greece', 'Russia',
    'United States of America', 'Canada', 'Mexico', 'Brazil', 'Argentina',
    'China', 'Japan', 'India', 'South Korea', 'Turkey', 'Egypt', 'Morocco',
    'South Africa', 'Australia',
  ] },
  { n: 2, en: 'Well-known', fr: 'Très connus', world: true, countries: [
    'Austria', 'Ireland', 'Luxembourg', 'Sweden', 'Norway', 'Denmark',
    'Finland', 'Iceland', 'Poland', 'Ukraine', 'Chile', 'Colombia', 'Peru',
    'Venezuela', 'Cuba', 'North Korea', 'Indonesia', 'Thailand', 'Vietnam',
    'Philippines', 'Pakistan', 'Iran', 'Iraq', 'Israel', 'Saudi Arabia',
    'Algeria', 'Nigeria', 'New Zealand',
  ] },
  { n: 3, en: 'Familiar', fr: 'Connus', world: true, countries: [
    'Czechia', 'Hungary', 'Romania', 'Bulgaria', 'Croatia', 'Serbia',
    'Belarus', 'Monaco', 'Vatican', 'Kazakhstan', 'Mongolia', 'Malaysia',
    'Singapore', 'Taiwan', 'Nepal', 'Sri Lanka', 'Bangladesh', 'Afghanistan',
    'United Arab Emirates', 'Lebanon', 'Syria', 'Tunisia', 'Kenya', 'Ethiopia',
  ] },
  { n: 4, en: 'Moderate', fr: 'Moyennement connus', world: true, countries: [
    'Slovakia', 'Slovenia', 'Bosnia and Herz.', 'Albania', 'Lithuania',
    'Latvia', 'Estonia', 'Cyprus', 'Malta', 'Uruguay', 'Paraguay', 'Bolivia',
    'Ecuador', 'Costa Rica', 'Panama', 'Jamaica', 'Haiti', 'Dominican Rep.',
    'Cambodia', 'Myanmar', 'Jordan', 'Kuwait', 'Qatar', 'Libya', 'Sudan',
    'Somalia', 'Dem. Rep. Congo', 'Madagascar',
  ] },
  { n: 5, en: 'Less common', fr: 'Moins courants', world: true, countries: [
    'Montenegro', 'Macedonia', 'Moldova', 'Andorra', 'Liechtenstein',
    'San Marino', 'Uzbekistan', 'Azerbaijan', 'Armenia', 'Georgia', 'Laos',
    'Oman', 'Bahrain', 'Yemen', 'Senegal', "Côte d'Ivoire", 'Ghana',
    'Cameroon', 'Tanzania', 'Mali', 'Niger', 'Chad',
  ] },
  { n: 6, en: 'Uncommon', fr: 'Peu courants', world: true, countries: [
    'Guatemala', 'Honduras', 'Nicaragua', 'El Salvador', 'Belize',
    'Trinidad and Tobago', 'Guyana', 'Suriname', 'Rwanda', 'Zimbabwe',
    'Uganda', 'Angola', 'Mozambique', 'Burkina Faso', 'Mauritania', 'Namibia',
    'Botswana', 'Zambia', 'Papua New Guinea', 'Fiji', 'Kosovo', 'Palestine',
  ] },
  { n: 7, en: 'Rare', fr: 'Rares', world: true, countries: [
    'Turkmenistan', 'Kyrgyzstan', 'Tajikistan', 'Bhutan', 'Brunei', 'Maldives',
    'Timor-Leste', 'Benin', 'Togo', 'Guinea', 'Sierra Leone', 'Liberia',
    'Gambia', 'Guinea-Bissau', 'Cabo Verde', 'Gabon', 'Congo',
    'Central African Rep.', 'Eq. Guinea', 'Djibouti', 'Eritrea', 'S. Sudan',
    'Burundi', 'Malawi', 'Lesotho', 'Bahamas',
  ] },
  { n: 8, en: 'Obscure', fr: 'Confidentiels', world: true, countries: [
    'eSwatini', 'Mauritius', 'Seychelles', 'Comoros', 'São Tomé and Principe',
    'Solomon Is.', 'Vanuatu', 'Samoa', 'Tonga', 'Kiribati', 'Micronesia',
    'Marshall Is.', 'Palau', 'Nauru', 'Tuvalu', 'Antigua and Barb.',
    'Barbados', 'Dominica', 'Grenada', 'St. Kitts and Nevis', 'Saint Lucia',
    'St. Vin. and Gren.',
  ] },
];

// ----- Zone mode: the same countries grouped by continent. -----
const ZONES = [
  { n: 1, en: 'Europe', fr: 'Europe', world: false, countries: [
    'France', 'Germany', 'United Kingdom', 'Italy', 'Spain', 'Portugal',
    'Netherlands', 'Belgium', 'Switzerland', 'Greece', 'Russia', 'Austria',
    'Ireland', 'Luxembourg', 'Sweden', 'Norway', 'Denmark', 'Finland',
    'Iceland', 'Poland', 'Ukraine', 'Czechia', 'Hungary', 'Romania',
    'Bulgaria', 'Croatia', 'Serbia', 'Belarus', 'Monaco', 'Vatican',
    'Slovakia', 'Slovenia', 'Bosnia and Herz.', 'Albania', 'Lithuania',
    'Latvia', 'Estonia', 'Cyprus', 'Malta', 'Montenegro', 'Macedonia',
    'Moldova', 'Andorra', 'Liechtenstein', 'San Marino', 'Kosovo',
  ] },
  { n: 2, en: 'Americas', fr: 'Amériques', world: false, countries: [
    'United States of America', 'Canada', 'Mexico', 'Brazil', 'Argentina',
    'Chile', 'Colombia', 'Peru', 'Cuba', 'Venezuela', 'Uruguay', 'Paraguay',
    'Bolivia', 'Ecuador', 'Costa Rica', 'Panama', 'Jamaica', 'Haiti',
    'Dominican Rep.', 'Guatemala', 'Honduras', 'Nicaragua', 'El Salvador',
    'Belize', 'Trinidad and Tobago', 'Guyana', 'Suriname', 'Bahamas',
    'Antigua and Barb.', 'Barbados', 'Dominica', 'Grenada',
    'St. Kitts and Nevis', 'Saint Lucia', 'St. Vin. and Gren.',
  ] },
  { n: 3, en: 'Asia & Middle East', fr: 'Asie & Moyen-Orient', world: false, countries: [
    'China', 'Japan', 'India', 'South Korea', 'North Korea', 'Indonesia',
    'Thailand', 'Vietnam', 'Philippines', 'Pakistan', 'Turkey', 'Saudi Arabia',
    'Iran', 'Iraq', 'Israel', 'United Arab Emirates', 'Singapore', 'Kazakhstan',
    'Mongolia', 'Malaysia', 'Taiwan', 'Nepal', 'Sri Lanka', 'Bangladesh',
    'Afghanistan', 'Lebanon', 'Syria', 'Cambodia', 'Myanmar', 'Jordan',
    'Kuwait', 'Qatar', 'Uzbekistan', 'Azerbaijan', 'Armenia', 'Georgia',
    'Laos', 'Oman', 'Bahrain', 'Yemen', 'Turkmenistan', 'Kyrgyzstan',
    'Tajikistan', 'Bhutan', 'Brunei', 'Maldives', 'Timor-Leste', 'Palestine',
  ] },
  { n: 4, en: 'Africa', fr: 'Afrique', world: false, countries: [
    'Egypt', 'Morocco', 'South Africa', 'Nigeria', 'Kenya', 'Algeria',
    'Tunisia', 'Ethiopia', 'Libya', 'Sudan', 'Somalia', 'Dem. Rep. Congo',
    'Madagascar', 'Senegal', "Côte d'Ivoire", 'Ghana', 'Cameroon', 'Tanzania',
    'Mali', 'Niger', 'Chad', 'Rwanda', 'Zimbabwe', 'Uganda', 'Angola',
    'Mozambique', 'Burkina Faso', 'Mauritania', 'Namibia', 'Botswana',
    'Zambia', 'Benin', 'Togo', 'Guinea', 'Sierra Leone', 'Liberia', 'Gambia',
    'Guinea-Bissau', 'Cabo Verde', 'Gabon', 'Congo', 'Central African Rep.',
    'Eq. Guinea', 'Djibouti', 'Eritrea', 'S. Sudan', 'Burundi', 'Malawi',
    'Lesotho', 'eSwatini', 'Mauritius', 'Seychelles', 'Comoros',
    'São Tomé and Principe',
  ] },
  { n: 5, en: 'Oceania', fr: 'Océanie', world: true, countries: [
    'Australia', 'New Zealand', 'Papua New Guinea', 'Fiji', 'Solomon Is.',
    'Vanuatu', 'Samoa', 'Tonga', 'Kiribati', 'Micronesia', 'Marshall Is.',
    'Palau', 'Nauru', 'Tuvalu',
  ] },
];

// The two selectable progressions. `levelOf()` (the difficulty badge) and the
// playable universe are anchored on the difficulty mode.
export const MODES = {
  difficulty: {
    en: 'Difficulty', fr: 'Difficulté',
    groups: [
      { key: 'group_easy', levels: [1, 2] },
      { key: 'group_medium', levels: [3, 4] },
      { key: 'group_hard', levels: [5, 6] },
      { key: 'group_ultimate', levels: [7, 8] },
    ],
    levels: DIFFICULTY,
  },
  zone: {
    en: 'Regions', fr: 'Zones',
    groups: [{ key: 'group_zone', levels: [1, 2, 3, 4, 5] }],
    levels: ZONES,
  },
};
export const DEFAULT_MODE = 'difficulty';
export function levelsOf(mode) { return (MODES[mode] || MODES.difficulty).levels; }
export function findLevel(mode, n) { return levelsOf(mode).find(l => l.n === n); }

const LEVELS = DIFFICULTY;

// The difficulty levels partition every playable country exactly once, so
// levelOf() (the badge/stats) is anchored on them.
const NAME_TO_LEVEL = new Map();
for (const lvl of DIFFICULTY) for (const c of lvl.countries) NAME_TO_LEVEL.set(c, lvl.n);

export function levelOf(name) {
  return NAME_TO_LEVEL.get(name) || 0;
}

export function levelTitle(lvl) {
  return getLang() === 'fr' ? lvl.fr : lvl.en;
}

// Friendlier display names for abbreviated dataset names.
const DISPLAY = {
  'United States of America': 'United States',
  'Dominican Rep.': 'Dominican Republic',
  'Dem. Rep. Congo': 'DR Congo (Kinshasa)',
  'Congo': 'Republic of the Congo (Brazzaville)',
  'Central African Rep.': 'Central African Republic',
  'Eq. Guinea': 'Equatorial Guinea',
  'S. Sudan': 'South Sudan',
  'W. Sahara': 'Western Sahara',
  'Bosnia and Herz.': 'Bosnia and Herzegovina',
  'Macedonia': 'North Macedonia',
  'eSwatini': 'Eswatini',
  'Solomon Is.': 'Solomon Islands',
  'Marshall Is.': 'Marshall Islands',
  'St. Vin. and Gren.': 'St. Vincent and the Grenadines',
  'Antigua and Barb.': 'Antigua and Barbuda',
  'São Tomé and Principe': 'São Tomé and Príncipe',
};

// French names, keyed by dataset name. Includes the playable countries and
// the most commonly clicked territories; anything missing falls back to the
// English display name.
const FR_NAMES = {
  'United States of America': 'États-Unis', 'Canada': 'Canada', 'Mexico': 'Mexique',
  'Brazil': 'Brésil', 'Argentina': 'Argentine', 'Russia': 'Russie', 'China': 'Chine',
  'India': 'Inde', 'Australia': 'Australie', 'Egypt': 'Égypte',
  'South Africa': 'Afrique du Sud', 'France': 'France', 'Germany': 'Allemagne',
  'Spain': 'Espagne', 'Italy': 'Italie', 'United Kingdom': 'Royaume-Uni',
  'Japan': 'Japon', 'Turkey': 'Turquie', 'Saudi Arabia': 'Arabie saoudite',
  'Indonesia': 'Indonésie',
  'Portugal': 'Portugal', 'Ireland': 'Irlande', 'Iceland': 'Islande',
  'Norway': 'Norvège', 'Sweden': 'Suède', 'Finland': 'Finlande',
  'Denmark': 'Danemark', 'Netherlands': 'Pays-Bas', 'Belgium': 'Belgique',
  'Switzerland': 'Suisse', 'Austria': 'Autriche', 'Poland': 'Pologne',
  'Greece': 'Grèce', 'Ukraine': 'Ukraine', 'Morocco': 'Maroc',
  'Algeria': 'Algérie', 'Libya': 'Libye', 'Nigeria': 'Nigéria',
  'Ethiopia': 'Éthiopie', 'Kenya': 'Kenya', 'Madagascar': 'Madagascar',
  'Colombia': 'Colombie', 'Venezuela': 'Venezuela', 'Peru': 'Pérou',
  'Chile': 'Chili', 'Cuba': 'Cuba', 'New Zealand': 'Nouvelle-Zélande',
  'South Korea': 'Corée du Sud', 'North Korea': 'Corée du Nord',
  'Vietnam': 'Viêt Nam', 'Thailand': 'Thaïlande', 'Philippines': 'Philippines',
  'Pakistan': 'Pakistan', 'Iran': 'Iran', 'Iraq': 'Irak', 'Israel': 'Israël',
  'Mongolia': 'Mongolie', 'Kazakhstan': 'Kazakhstan', 'Afghanistan': 'Afghanistan',
  'Czechia': 'République tchèque', 'Slovakia': 'Slovaquie', 'Hungary': 'Hongrie',
  'Romania': 'Roumanie', 'Bulgaria': 'Bulgarie', 'Croatia': 'Croatie',
  'Serbia': 'Serbie', 'Belarus': 'Biélorussie', 'Lithuania': 'Lituanie',
  'Latvia': 'Lettonie', 'Estonia': 'Estonie', 'Tunisia': 'Tunisie',
  'Mali': 'Mali', 'Niger': 'Niger', 'Chad': 'Tchad', 'Sudan': 'Soudan',
  'Somalia': 'Somalie', 'Tanzania': 'Tanzanie', 'Mozambique': 'Mozambique',
  'Angola': 'Angola', 'Namibia': 'Namibie', 'Botswana': 'Botswana',
  'Zimbabwe': 'Zimbabwe', 'Zambia': 'Zambie', 'Ghana': 'Ghana',
  'Senegal': 'Sénégal', 'Cameroon': 'Cameroun',
  'Dem. Rep. Congo': 'RD Congo (Kinshasa)', 'Bolivia': 'Bolivie',
  'Ecuador': 'Équateur', 'Paraguay': 'Paraguay', 'Uruguay': 'Uruguay',
  'Panama': 'Panama', 'Costa Rica': 'Costa Rica', 'Guatemala': 'Guatemala',
  'Honduras': 'Honduras', 'Nicaragua': 'Nicaragua',
  'Dominican Rep.': 'République dominicaine', 'Haiti': 'Haïti',
  'Jamaica': 'Jamaïque', 'Malaysia': 'Malaisie', 'Myanmar': 'Birmanie (Myanmar)',
  'Bangladesh': 'Bangladesh', 'Sri Lanka': 'Sri Lanka', 'Nepal': 'Népal',
  'Cambodia': 'Cambodge', 'Laos': 'Laos', 'Syria': 'Syrie',
  'Jordan': 'Jordanie', 'Yemen': 'Yémen', 'Oman': 'Oman',
  'United Arab Emirates': 'Émirats arabes unis', 'Qatar': 'Qatar',
  'Kuwait': 'Koweït', 'Uzbekistan': 'Ouzbékistan', 'Azerbaijan': 'Azerbaïdjan',
  'Georgia': 'Géorgie', 'Armenia': 'Arménie',
  'Benin': 'Bénin', 'Togo': 'Togo', 'Burkina Faso': 'Burkina Faso',
  "Côte d'Ivoire": "Côte d'Ivoire", 'Guinea': 'Guinée',
  'Sierra Leone': 'Sierra Leone', 'Liberia': 'Libéria',
  'Mauritania': 'Mauritanie', 'Gabon': 'Gabon',
  'Congo': 'République du Congo (Brazzaville)',
  'Central African Rep.': 'République centrafricaine',
  'S. Sudan': 'Soudan du Sud', 'Eritrea': 'Érythrée', 'Djibouti': 'Djibouti',
  'Uganda': 'Ouganda', 'Rwanda': 'Rwanda', 'Burundi': 'Burundi',
  'Malawi': 'Malawi', 'Lesotho': 'Lesotho', 'eSwatini': 'Eswatini',
  'Eq. Guinea': 'Guinée équatoriale', 'Guinea-Bissau': 'Guinée-Bissau',
  'Gambia': 'Gambie', 'Albania': 'Albanie',
  'Bosnia and Herz.': 'Bosnie-Herzégovine', 'Macedonia': 'Macédoine du Nord',
  'Montenegro': 'Monténégro', 'Slovenia': 'Slovénie', 'Moldova': 'Moldavie',
  'Kosovo': 'Kosovo', 'Cyprus': 'Chypre', 'Malta': 'Malte',
  'Luxembourg': 'Luxembourg', 'Kyrgyzstan': 'Kirghizistan',
  'Tajikistan': 'Tadjikistan', 'Turkmenistan': 'Turkménistan',
  'Bhutan': 'Bhoutan', 'Taiwan': 'Taïwan', 'Brunei': 'Brunei',
  'Timor-Leste': 'Timor oriental',
  'Papua New Guinea': 'Papouasie-Nouvelle-Guinée', 'Singapore': 'Singapour',
  'Lebanon': 'Liban', 'Bahrain': 'Bahreïn', 'Belize': 'Belize',
  'El Salvador': 'Salvador', 'Guyana': 'Guyana', 'Suriname': 'Suriname',
  'Trinidad and Tobago': 'Trinité-et-Tobago', 'Bahamas': 'Bahamas',
  'Fiji': 'Fidji',
  'Andorra': 'Andorre', 'Liechtenstein': 'Liechtenstein', 'Monaco': 'Monaco',
  'San Marino': 'Saint-Marin', 'Vatican': 'Vatican', 'Comoros': 'Comores',
  'Cabo Verde': 'Cap-Vert', 'São Tomé and Principe': 'Sao Tomé-et-Principe',
  'Seychelles': 'Seychelles', 'Mauritius': 'Maurice', 'Maldives': 'Maldives',
  'Solomon Is.': 'Îles Salomon', 'Vanuatu': 'Vanuatu', 'Samoa': 'Samoa',
  'Tonga': 'Tonga', 'Kiribati': 'Kiribati', 'Micronesia': 'Micronésie',
  'Marshall Is.': 'Îles Marshall', 'Palau': 'Palaos', 'Nauru': 'Nauru',
  'St. Kitts and Nevis': 'Saint-Christophe-et-Niévès',
  'Antigua and Barb.': 'Antigua-et-Barbuda', 'Dominica': 'Dominique',
  'Saint Lucia': 'Sainte-Lucie',
  'St. Vin. and Gren.': 'Saint-Vincent-et-les-Grenadines',
  'Grenada': 'Grenade', 'Barbados': 'Barbade',
  'W. Sahara': 'Sahara occidental', 'Palestine': 'Palestine',
  'Tuvalu': 'Tuvalu',
  // Common non-playable territories (can be clicked as wrong guesses):
  'Greenland': 'Groenland', 'Puerto Rico': 'Porto Rico',
  'New Caledonia': 'Nouvelle-Calédonie', 'Fr. Polynesia': 'Polynésie française',
  'Falkland Is.': 'Îles Malouines', 'Faeroe Is.': 'Îles Féroé',
  'N. Cyprus': 'Chypre du Nord', 'Somaliland': 'Somaliland',
  'Hong Kong': 'Hong Kong', 'Macao': 'Macao',
};

export function displayName(name) {
  if (getLang() === 'fr') return FR_NAMES[name] || DISPLAY[name] || name;
  return DISPLAY[name] || name;
}

export const PLAYABLE = [...NAME_TO_LEVEL.keys()];

// Curated playable countries, organized as ordered LEVELS (easiest first).
// Country keys are the exact `properties.name` values from world-atlas
// countries-50m.json. Anything not listed renders as a non-playable
// territory (muted color, never asked).
// Each level holds 20-30 countries grouped by difficulty and theme, so a
// "series" (one full pass over a level) stays a satisfying session length.

import { getLang } from './i18n.js';

// Levels are geographic clusters ordered by difficulty: confusions come
// from neighbours (Niger/Nigeria, Slovakia/Slovenia…), so a cluster learned
// as one block sticks better than the same countries spread across levels.
// `diff` is the 1-5 difficulty shown on the level card.
export const LEVELS = [
  {
    n: 1, en: 'World Giants', fr: 'Les géants du monde', diff: 1,
    countries: [
      'United States of America', 'Canada', 'Mexico', 'Brazil', 'Argentina',
      'Russia', 'China', 'India', 'Australia', 'New Zealand', 'Egypt',
      'South Africa', 'France', 'Germany', 'Spain', 'Italy',
      'United Kingdom', 'Japan', 'Turkey', 'Saudi Arabia', 'Indonesia',
    ],
  },
  {
    n: 2, en: 'Western & Northern Europe', fr: "L'Europe de l'Ouest et du Nord", diff: 1,
    countries: [
      'Portugal', 'Ireland', 'Iceland', 'Norway', 'Sweden', 'Finland',
      'Denmark', 'Netherlands', 'Belgium', 'Luxembourg', 'Switzerland',
      'Austria', 'Malta',
    ],
  },
  {
    n: 3, en: 'Central Europe, Baltics & Balkans', fr: 'Europe centrale, Baltes et Balkans', diff: 3,
    countries: [
      'Poland', 'Czechia', 'Slovakia', 'Hungary', 'Slovenia', 'Croatia',
      'Bosnia and Herz.', 'Serbia', 'Montenegro', 'Macedonia', 'Albania',
      'Kosovo', 'Greece', 'Bulgaria', 'Romania', 'Moldova', 'Ukraine',
      'Belarus', 'Lithuania', 'Latvia', 'Estonia', 'Cyprus',
    ],
  },
  {
    n: 4, en: 'Latin America & Caribbean', fr: 'Amérique latine et Caraïbes', diff: 2,
    countries: [
      'Colombia', 'Venezuela', 'Guyana', 'Suriname', 'Ecuador', 'Peru',
      'Bolivia', 'Chile', 'Paraguay', 'Uruguay', 'Cuba', 'Haiti',
      'Dominican Rep.', 'Jamaica', 'Bahamas', 'Trinidad and Tobago',
      'Belize', 'Guatemala', 'Honduras', 'El Salvador', 'Nicaragua',
      'Costa Rica', 'Panama',
    ],
  },
  {
    n: 5, en: 'South & East Asia', fr: "L'Asie du Sud et de l'Est", diff: 3,
    countries: [
      'Mongolia', 'North Korea', 'South Korea', 'Taiwan', 'Philippines',
      'Vietnam', 'Laos', 'Cambodia', 'Thailand', 'Myanmar', 'Malaysia',
      'Singapore', 'Brunei', 'Timor-Leste', 'Papua New Guinea',
      'Bangladesh', 'Sri Lanka', 'Nepal', 'Bhutan', 'Pakistan',
    ],
  },
  {
    n: 6, en: 'Middle East, Caucasus & Central Asia', fr: 'Moyen-Orient, Caucase et Asie centrale', diff: 4,
    countries: [
      'Iran', 'Iraq', 'Syria', 'Lebanon', 'Israel', 'Palestine', 'Jordan',
      'Yemen', 'Oman', 'United Arab Emirates', 'Qatar', 'Bahrain',
      'Kuwait', 'Georgia', 'Armenia', 'Azerbaijan', 'Kazakhstan',
      'Uzbekistan', 'Turkmenistan', 'Kyrgyzstan', 'Tajikistan',
      'Afghanistan',
    ],
  },
  {
    n: 7, en: 'Africa: The Landmarks', fr: "L'Afrique des repères", diff: 3,
    countries: [
      'Morocco', 'Algeria', 'Tunisia', 'Libya', 'W. Sahara', 'Ethiopia',
      'Kenya', 'Nigeria', 'Madagascar', 'Mali', 'Niger', 'Chad', 'Sudan',
      'Somalia', 'Tanzania', 'Mozambique', 'Angola', 'Namibia', 'Botswana',
      'Zimbabwe', 'Zambia', 'Ghana', 'Senegal', 'Cameroon',
      'Dem. Rep. Congo',
    ],
  },
  {
    n: 8, en: 'Africa in Detail', fr: "L'Afrique en détail", diff: 4,
    countries: [
      'Benin', 'Togo', 'Burkina Faso', "Côte d'Ivoire", 'Guinea',
      'Sierra Leone', 'Liberia', 'Mauritania', 'Gabon', 'Congo',
      'Central African Rep.', 'S. Sudan', 'Eritrea', 'Djibouti', 'Uganda',
      'Rwanda', 'Burundi', 'Malawi', 'Lesotho', 'eSwatini', 'Eq. Guinea',
      'Guinea-Bissau', 'Gambia',
    ],
  },
  {
    n: 9, en: 'Microstates & Islands of the World', fr: 'Micro-États et îles du monde', diff: 5,
    countries: [
      'Andorra', 'Liechtenstein', 'Monaco', 'San Marino', 'Vatican',
      'Comoros', 'Cabo Verde', 'São Tomé and Principe', 'Seychelles',
      'Mauritius', 'Maldives', 'Solomon Is.', 'Vanuatu', 'Fiji', 'Samoa',
      'Tonga', 'Kiribati', 'Micronesia', 'Marshall Is.', 'Palau', 'Nauru',
      'Tuvalu', 'St. Kitts and Nevis', 'Antigua and Barb.', 'Dominica',
      'Saint Lucia', 'St. Vin. and Gren.', 'Grenada', 'Barbados',
    ],
  },
];

const NAME_TO_LEVEL = new Map();
for (const lvl of LEVELS) for (const c of lvl.countries) NAME_TO_LEVEL.set(c, lvl.n);

// Grand Slam: a bonus series over every playable country. It is a playable
// level but does not own any country — levelOf() keeps returning the
// thematic level 1-9.
LEVELS.push({
  n: 10, slam: true, en: 'Grand Slam', fr: 'Grand Chelem', diff: 5,
  countries: [...NAME_TO_LEVEL.keys()],
});

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

// Curated playable countries and difficulty tiers.
// Keys are the exact `properties.name` values from world-atlas countries-50m.json.
// Tier 1 = very easy … 5 = expert. Anything not listed renders as a
// non-playable territory (muted color, never asked).
// Tiering rule of thumb: fame of the NAME is not enough — the tier reflects
// how hard the LOCATION is to pin down (e.g. Kazakhstan or Nigeria are
// household names but sit in confusable clusters, so they are Medium).

import { getLang } from './i18n.js';

export const TIER_ICONS = ['🟢', '🔵', '🟡', '🟠', '🔴'];

export const TIERS = {
  // ---- Tier 1: very easy — huge and/or iconic ----
  'United States of America': 1, 'Canada': 1, 'Mexico': 1, 'Brazil': 1,
  'Argentina': 1, 'Russia': 1, 'China': 1, 'India': 1, 'Australia': 1,
  'Egypt': 1, 'South Africa': 1, 'France': 1, 'Germany': 1, 'Spain': 1,
  'Italy': 1, 'United Kingdom': 1, 'Japan': 1, 'Turkey': 1,
  'Saudi Arabia': 1, 'Indonesia': 1,

  // ---- Tier 2: easy — well-known, distinctive shape or location ----
  'Portugal': 2, 'Ireland': 2, 'Iceland': 2, 'Norway': 2, 'Sweden': 2,
  'Finland': 2, 'Denmark': 2, 'Netherlands': 2, 'Belgium': 2,
  'Switzerland': 2, 'Austria': 2, 'Poland': 2, 'Greece': 2, 'Ukraine': 2,
  'Morocco': 2, 'Algeria': 2, 'Libya': 2,
  'Madagascar': 2, 'Colombia': 2, 'Venezuela': 2, 'Peru': 2,
  'Chile': 2, 'Cuba': 2, 'New Zealand': 2, 'South Korea': 2,
  'North Korea': 2, 'Vietnam': 2, 'Thailand': 2, 'Philippines': 2,
  'Pakistan': 2, 'Iran': 2, 'Israel': 2, 'Mongolia': 2,

  // ---- Tier 3: medium ----
  // Big names in confusable clusters, demoted from Easy:
  'Kazakhstan': 3, 'Afghanistan': 3, 'Iraq': 3, 'Ethiopia': 3, 'Kenya': 3,
  'Nigeria': 3,
  'Czechia': 3, 'Slovakia': 3, 'Hungary': 3, 'Romania': 3, 'Bulgaria': 3,
  'Croatia': 3, 'Serbia': 3, 'Belarus': 3, 'Lithuania': 3, 'Latvia': 3,
  'Estonia': 3, 'Tunisia': 3, 'Mali': 3, 'Niger': 3, 'Chad': 3,
  'Sudan': 3, 'Somalia': 3, 'Tanzania': 3, 'Mozambique': 3, 'Angola': 3,
  'Namibia': 3, 'Botswana': 3, 'Zimbabwe': 3, 'Zambia': 3, 'Ghana': 3,
  'Senegal': 3, 'Cameroon': 3, 'Dem. Rep. Congo': 3, 'Bolivia': 3,
  'Ecuador': 3, 'Paraguay': 3, 'Uruguay': 3, 'Panama': 3,
  'Costa Rica': 3, 'Guatemala': 3, 'Honduras': 3, 'Nicaragua': 3,
  'Dominican Rep.': 3, 'Haiti': 3, 'Jamaica': 3, 'Malaysia': 3,
  'Myanmar': 3, 'Bangladesh': 3, 'Sri Lanka': 3, 'Nepal': 3,
  'Cambodia': 3, 'Laos': 3, 'Syria': 3, 'Jordan': 3, 'Yemen': 3,
  'Oman': 3, 'United Arab Emirates': 3, 'Qatar': 3, 'Kuwait': 3,
  'Uzbekistan': 3, 'Azerbaijan': 3, 'Georgia': 3, 'Armenia': 3,

  // ---- Tier 4: hard ----
  'Benin': 4, 'Togo': 4, 'Burkina Faso': 4, "Côte d'Ivoire": 4,
  'Guinea': 4, 'Sierra Leone': 4, 'Liberia': 4, 'Mauritania': 4,
  'Gabon': 4, 'Congo': 4, 'Central African Rep.': 4, 'S. Sudan': 4,
  'Eritrea': 4, 'Djibouti': 4, 'Uganda': 4, 'Rwanda': 4, 'Burundi': 4,
  'Malawi': 4, 'Lesotho': 4, 'eSwatini': 4, 'Eq. Guinea': 4,
  'Guinea-Bissau': 4, 'Gambia': 4, 'Albania': 4, 'Bosnia and Herz.': 4,
  'Macedonia': 4, 'Montenegro': 4, 'Slovenia': 4, 'Moldova': 4,
  'Kosovo': 4, 'Cyprus': 4, 'Malta': 4, 'Luxembourg': 4,
  'Kyrgyzstan': 4, 'Tajikistan': 4, 'Turkmenistan': 4, 'Bhutan': 4,
  'Taiwan': 4, 'Brunei': 4, 'Timor-Leste': 4, 'Papua New Guinea': 4,
  'Singapore': 4, 'Lebanon': 4, 'Bahrain': 4, 'Belize': 4,
  'El Salvador': 4, 'Guyana': 4, 'Suriname': 4,
  'Trinidad and Tobago': 4, 'Bahamas': 4, 'Fiji': 4,

  // ---- Tier 5: expert — microstates and remote islands ----
  'Andorra': 5, 'Liechtenstein': 5, 'Monaco': 5, 'San Marino': 5,
  'Vatican': 5, 'Comoros': 5, 'Cabo Verde': 5,
  'São Tomé and Principe': 5, 'Seychelles': 5, 'Mauritius': 5,
  'Maldives': 5, 'Solomon Is.': 5, 'Vanuatu': 5, 'Samoa': 5,
  'Tonga': 5, 'Kiribati': 5, 'Micronesia': 5, 'Marshall Is.': 5,
  'Palau': 5, 'Nauru': 5, 'St. Kitts and Nevis': 5,
  'Antigua and Barb.': 5, 'Dominica': 5, 'Saint Lucia': 5,
  'St. Vin. and Gren.': 5, 'Grenada': 5, 'Barbados': 5,
  'W. Sahara': 5, 'Palestine': 5,
};

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
  'Czechia': 'Tchéquie', 'Slovakia': 'Slovaquie', 'Hungary': 'Hongrie',
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

export const PLAYABLE = Object.keys(TIERS);

export function tierOf(name) {
  return TIERS[name] || 0;
}

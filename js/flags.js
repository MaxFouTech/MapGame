// Country flags. Dataset name -> ISO 3166-1 alpha-2, used to build a flagcdn
// image URL. Rendered as a background-image on a span so it works inside
// innerHTML strings; a grey base shows through when the image is missing or
// the app is offline (see .flag in the CSS).

export const NAME_TO_ISO2 = {
  'United States of America': 'us', 'Canada': 'ca', 'Mexico': 'mx', 'Brazil': 'br',
  'Argentina': 'ar', 'Russia': 'ru', 'China': 'cn', 'India': 'in', 'Australia': 'au',
  'New Zealand': 'nz', 'Egypt': 'eg', 'South Africa': 'za', 'France': 'fr',
  'Germany': 'de', 'Spain': 'es', 'Italy': 'it', 'United Kingdom': 'gb', 'Japan': 'jp',
  'Turkey': 'tr', 'Saudi Arabia': 'sa', 'Indonesia': 'id', 'Portugal': 'pt',
  'Ireland': 'ie', 'Iceland': 'is', 'Norway': 'no', 'Sweden': 'se', 'Finland': 'fi',
  'Denmark': 'dk', 'Netherlands': 'nl', 'Belgium': 'be', 'Luxembourg': 'lu',
  'Switzerland': 'ch', 'Austria': 'at', 'Malta': 'mt', 'Poland': 'pl', 'Czechia': 'cz',
  'Slovakia': 'sk', 'Hungary': 'hu', 'Slovenia': 'si', 'Croatia': 'hr',
  'Bosnia and Herz.': 'ba', 'Serbia': 'rs', 'Montenegro': 'me', 'Macedonia': 'mk',
  'Albania': 'al', 'Kosovo': 'xk', 'Greece': 'gr', 'Bulgaria': 'bg', 'Romania': 'ro',
  'Moldova': 'md', 'Ukraine': 'ua', 'Belarus': 'by', 'Lithuania': 'lt', 'Latvia': 'lv',
  'Estonia': 'ee', 'Cyprus': 'cy', 'Colombia': 'co', 'Venezuela': 've', 'Guyana': 'gy',
  'Suriname': 'sr', 'Ecuador': 'ec', 'Peru': 'pe', 'Bolivia': 'bo', 'Chile': 'cl',
  'Paraguay': 'py', 'Uruguay': 'uy', 'Cuba': 'cu', 'Haiti': 'ht', 'Dominican Rep.': 'do',
  'Jamaica': 'jm', 'Bahamas': 'bs', 'Trinidad and Tobago': 'tt', 'Belize': 'bz',
  'Guatemala': 'gt', 'Honduras': 'hn', 'El Salvador': 'sv', 'Nicaragua': 'ni',
  'Costa Rica': 'cr', 'Panama': 'pa', 'Mongolia': 'mn', 'North Korea': 'kp',
  'South Korea': 'kr', 'Taiwan': 'tw', 'Philippines': 'ph', 'Vietnam': 'vn', 'Laos': 'la',
  'Cambodia': 'kh', 'Thailand': 'th', 'Myanmar': 'mm', 'Malaysia': 'my', 'Singapore': 'sg',
  'Brunei': 'bn', 'Timor-Leste': 'tl', 'Papua New Guinea': 'pg', 'Bangladesh': 'bd',
  'Sri Lanka': 'lk', 'Nepal': 'np', 'Bhutan': 'bt', 'Pakistan': 'pk', 'Iran': 'ir',
  'Iraq': 'iq', 'Syria': 'sy', 'Lebanon': 'lb', 'Israel': 'il', 'Palestine': 'ps',
  'Jordan': 'jo', 'Yemen': 'ye', 'Oman': 'om', 'United Arab Emirates': 'ae', 'Qatar': 'qa',
  'Bahrain': 'bh', 'Kuwait': 'kw', 'Georgia': 'ge', 'Armenia': 'am', 'Azerbaijan': 'az',
  'Kazakhstan': 'kz', 'Uzbekistan': 'uz', 'Turkmenistan': 'tm', 'Kyrgyzstan': 'kg',
  'Tajikistan': 'tj', 'Afghanistan': 'af', 'Morocco': 'ma', 'Algeria': 'dz', 'Tunisia': 'tn',
  'Libya': 'ly', 'W. Sahara': 'eh', 'Ethiopia': 'et', 'Kenya': 'ke', 'Nigeria': 'ng',
  'Madagascar': 'mg', 'Mali': 'ml', 'Niger': 'ne', 'Chad': 'td', 'Sudan': 'sd',
  'Somalia': 'so', 'Tanzania': 'tz', 'Mozambique': 'mz', 'Angola': 'ao', 'Namibia': 'na',
  'Botswana': 'bw', 'Zimbabwe': 'zw', 'Zambia': 'zm', 'Ghana': 'gh', 'Senegal': 'sn',
  'Cameroon': 'cm', 'Dem. Rep. Congo': 'cd', 'Benin': 'bj', 'Togo': 'tg',
  'Burkina Faso': 'bf', "Côte d'Ivoire": 'ci', 'Guinea': 'gn', 'Sierra Leone': 'sl',
  'Liberia': 'lr', 'Mauritania': 'mr', 'Gabon': 'ga', 'Congo': 'cg',
  'Central African Rep.': 'cf', 'S. Sudan': 'ss', 'Eritrea': 'er', 'Djibouti': 'dj',
  'Uganda': 'ug', 'Rwanda': 'rw', 'Burundi': 'bi', 'Malawi': 'mw', 'Lesotho': 'ls',
  'eSwatini': 'sz', 'Eq. Guinea': 'gq', 'Guinea-Bissau': 'gw', 'Gambia': 'gm',
  'Andorra': 'ad', 'Liechtenstein': 'li', 'Monaco': 'mc', 'San Marino': 'sm',
  'Vatican': 'va', 'Comoros': 'km', 'Cabo Verde': 'cv', 'São Tomé and Principe': 'st',
  'Seychelles': 'sc', 'Mauritius': 'mu', 'Maldives': 'mv', 'Solomon Is.': 'sb',
  'Vanuatu': 'vu', 'Fiji': 'fj', 'Samoa': 'ws', 'Tonga': 'to', 'Kiribati': 'ki',
  'Micronesia': 'fm', 'Marshall Is.': 'mh', 'Palau': 'pw', 'Nauru': 'nr', 'Tuvalu': 'tv',
  'St. Kitts and Nevis': 'kn', 'Antigua and Barb.': 'ag', 'Dominica': 'dm',
  'Saint Lucia': 'lc', 'St. Vin. and Gren.': 'vc', 'Grenada': 'gd', 'Barbados': 'bb',
};

// A flag chip for use inside innerHTML. `cls` adds modifiers (e.g. 'flag-lg').
export function flagHtml(name, cls = '') {
  const iso = NAME_TO_ISO2[name];
  if (!iso) return `<span class="flag flag-none ${cls}"></span>`;
  return `<span class="flag ${cls}" style="background-image:url(https://flagcdn.com/w80/${iso}.png)"></span>`;
}

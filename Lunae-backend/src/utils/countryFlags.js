/**
 * Mapeo de nombres de países a sus banderas emoji
 */
export const countryFlags = {
  // América
  'United States': '🇺🇸',
  'USA': '🇺🇸',
  'Canada': '🇨🇦',
  'Mexico': '🇲🇽',
  'Brazil': '🇧🇷',
  'Argentina': '🇦🇷',
  'Chile': '🇨🇱',
  'Colombia': '🇨🇴',
  'Peru': '🇵🇪',
  'Ecuador': '🇪🇨',
  'Venezuela': '🇻🇪',
  'Uruguay': '🇺🇾',
  'Paraguay': '🇵🇾',
  'Bolivia': '🇧🇴',
  'Costa Rica': '🇨🇷',
  'Panama': '🇵🇦',
  'Guatemala': '🇬🇹',
  'Honduras': '🇭🇳',
  'El Salvador': '🇸🇻',
  'Nicaragua': '🇳🇮',
  'Cuba': '🇨🇺',
  'Dominican Republic': '🇩🇴',
  'Jamaica': '🇯🇲',
  'Haiti': '🇭🇹',
  'Trinidad and Tobago': '🇹🇹',
  
  // Europa
  'Spain': '🇪🇸',
  'France': '🇫🇷',
  'Germany': '🇩🇪',
  'Italy': '🇮🇹',
  'United Kingdom': '🇬🇧',
  'UK': '🇬🇧',
  'Netherlands': '🇳🇱',
  'Belgium': '🇧🇪',
  'Switzerland': '🇨🇭',
  'Austria': '🇦🇹',
  'Portugal': '🇵🇹',
  'Poland': '🇵🇱',
  'Russia': '🇷🇺',
  'Ukraine': '🇺🇦',
  'Sweden': '🇸🇪',
  'Norway': '🇳🇴',
  'Denmark': '🇩🇰',
  'Finland': '🇫🇮',
  'Ireland': '🇮🇪',
  'Czech Republic': '🇨🇿',
  'Hungary': '🇭🇺',
  'Romania': '🇷🇴',
  'Bulgaria': '🇧🇬',
  'Croatia': '🇭🇷',
  'Serbia': '🇷🇸',
  'Greece': '🇬🇷',
  'Turkey': '🇹🇷',
  
  // Asia
  'China': '🇨🇳',
  'Japan': '🇯🇵',
  'South Korea': '🇰🇷',
  'India': '🇮🇳',
  'Thailand': '🇹🇭',
  'Vietnam': '🇻🇳',
  'Philippines': '🇵🇭',
  'Indonesia': '🇮🇩',
  'Malaysia': '🇲🇾',
  'Singapore': '🇸🇬',
  'Taiwan': '🇹🇼',
  'Hong Kong': '🇭🇰',
  'Pakistan': '🇵🇰',
  'Bangladesh': '🇧🇩',
  'Sri Lanka': '🇱🇰',
  'Nepal': '🇳🇵',
  'Myanmar': '🇲🇲',
  'Cambodia': '🇰🇭',
  'Laos': '🇱🇦',
  'Mongolia': '🇲🇳',
  'Kazakhstan': '🇰🇿',
  'Uzbekistan': '🇺🇿',
  'Iran': '🇮🇷',
  'Iraq': '🇮🇶',
  'Saudi Arabia': '🇸🇦',
  'United Arab Emirates': '🇦🇪',
  'UAE': '🇦🇪',
  'Israel': '🇮🇱',
  'Jordan': '🇯🇴',
  'Lebanon': '🇱🇧',
  'Syria': '🇸🇾',
  
  // África
  'South Africa': '🇿🇦',
  'Nigeria': '🇳🇬',
  'Kenya': '🇰🇪',
  'Egypt': '🇪🇬',
  'Morocco': '🇲🇦',
  'Algeria': '🇩🇿',
  'Tunisia': '🇹🇳',
  'Libya': '🇱🇾',
  'Ethiopia': '🇪🇹',
  'Ghana': '🇬🇭',
  'Senegal': '🇸🇳',
  'Ivory Coast': '🇨🇮',
  'Cameroon': '🇨🇲',
  'Tanzania': '🇹🇿',
  'Uganda': '🇺🇬',
  'Zimbabwe': '🇿🇼',
  'Botswana': '🇧🇼',
  'Namibia': '🇳🇦',
  'Zambia': '🇿🇲',
  'Mozambique': '🇲🇿',
  
  // Oceanía
  'Australia': '🇦🇺',
  'New Zealand': '🇳🇿',
  'Fiji': '🇫🇯',
  'Papua New Guinea': '🇵🇬',
  'Samoa': '🇼🇸',
  'Tonga': '🇹🇴',
  'Vanuatu': '🇻🇺',
  
  // Países adicionales y variaciones
  'Russian Federation': '🇷🇺',
  'Republic of Korea': '🇰🇷',
  'Korea': '🇰🇷',
  'Democratic People\'s Republic of Korea': '🇰🇵',
  'North Korea': '🇰🇵',
  'People\'s Republic of China': '🇨🇳',
  'Republic of China': '🇹🇼',
  'Islamic Republic of Iran': '🇮🇷',
  'Kingdom of Saudi Arabia': '🇸🇦',
  'State of Israel': '🇮🇱',
  'Arab Republic of Egypt': '🇪🇬',
  'Republic of South Africa': '🇿🇦',
  'Federative Republic of Brazil': '🇧🇷',
  'United Mexican States': '🇲🇽',
  'Republic of India': '🇮🇳',
  'Commonwealth of Australia': '🇦🇺',
  'Federal Republic of Germany': '🇩🇪',
  'French Republic': '🇫🇷',
  'Italian Republic': '🇮🇹',
  'Kingdom of Spain': '🇪🇸',
  'Portuguese Republic': '🇵🇹',
  'Kingdom of Sweden': '🇸🇪',
  'Kingdom of Norway': '🇳🇴',
  'Kingdom of Denmark': '🇩🇰',
  'Republic of Finland': '🇫🇮',
  'Republic of Ireland': '🇮🇪',
  'Swiss Confederation': '🇨🇭',
  'Republic of Austria': '🇦🇹',
  'Kingdom of Belgium': '🇧🇪',
  'Kingdom of the Netherlands': '🇳🇱',
};

/**
 * Obtiene la bandera emoji de un país basado en su nombre
 * @param {string} countryName Nombre del país
 * @returns {string} Emoji de la bandera o emoji por defecto
 */
export function getCountryFlag(countryName) {
  if (!countryName) {
    return '🌍'; // Emoji de mundo por defecto
  }
  
  // Normalizar el nombre del país (quitar espacios extra, capitalizar)
  const normalizedName = countryName.trim();
  
  // Buscar coincidencia exacta
  if (countryFlags[normalizedName]) {
    return countryFlags[normalizedName];
  }
  
  // Buscar coincidencia parcial (case insensitive)
  const lowerCountryName = normalizedName.toLowerCase();
  for (const [country, flag] of Object.entries(countryFlags)) {
    if (country.toLowerCase().includes(lowerCountryName) || 
        lowerCountryName.includes(country.toLowerCase())) {
      return flag;
    }
  }
  
  // Si no se encuentra, devolver emoji por defecto
  return '🌍';
}

/**
 * Extrae el nombre del país de una dirección completa
 * @param {string} address Dirección en formato "City, Country" o similar
 * @returns {string|undefined} Nombre del país
 */
export function extractCountryFromAddress(address) {
  if (!address) return undefined;
  
  // Buscar patrones comunes: "City, Country" o "State, Country"
  const parts = address.split(',').map(part => part.trim());
  
  if (parts.length >= 2) {
    // El último elemento suele ser el país
    return parts[parts.length - 1];
  }
  
  // Si no hay comas, asumir que toda la dirección es el país
  return address.trim();
}

/**
 * Obtiene la bandera de un país desde una dirección completa
 * @param {string} address Dirección completa del usuario
 * @returns {string} Emoji de la bandera del país
 */
export function getFlagFromAddress(address) {
  const country = extractCountryFromAddress(address);
  return getCountryFlag(country);
}

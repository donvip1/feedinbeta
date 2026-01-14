// Comprehensive country data with dial codes and cities

export interface Country {
  code: string;
  name: string;
  dialCode: string;
  cities: string[];
}

export const COUNTRIES: Country[] = [
  { code: 'AF', name: 'Afghanistan', dialCode: '+93', cities: ['Kabul', 'Kandahar', 'Herat', 'Mazar-i-Sharif', 'Jalalabad'] },
  { code: 'AR', name: 'Argentina', dialCode: '+54', cities: ['Buenos Aires', 'Córdoba', 'Rosario', 'Mendoza', 'La Plata', 'Mar del Plata', 'Tucumán', 'Salta'] },
  { code: 'AU', name: 'Australia', dialCode: '+61', cities: ['Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Adelaide', 'Gold Coast', 'Canberra', 'Newcastle', 'Hobart'] },
  { code: 'BD', name: 'Bangladesh', dialCode: '+880', cities: ['Dhaka', 'Chittagong', 'Khulna', 'Rajshahi', 'Sylhet', 'Rangpur', 'Comilla'] },
  { code: 'BE', name: 'Belgium', dialCode: '+32', cities: ['Brussels', 'Antwerp', 'Ghent', 'Bruges', 'Liège', 'Namur', 'Leuven'] },
  { code: 'BR', name: 'Brazil', dialCode: '+55', cities: ['São Paulo', 'Rio de Janeiro', 'Brasília', 'Salvador', 'Fortaleza', 'Belo Horizonte', 'Curitiba', 'Recife', 'Porto Alegre'] },
  { code: 'CA', name: 'Canada', dialCode: '+1', cities: ['Toronto', 'Montreal', 'Vancouver', 'Calgary', 'Ottawa', 'Edmonton', 'Winnipeg', 'Quebec City', 'Hamilton'] },
  { code: 'CH', name: 'Switzerland', dialCode: '+41', cities: ['Zurich', 'Geneva', 'Basel', 'Lausanne', 'Bern', 'Lucerne', 'St. Gallen'] },
  { code: 'CL', name: 'Chile', dialCode: '+56', cities: ['Santiago', 'Valparaíso', 'Concepción', 'La Serena', 'Antofagasta', 'Temuco', 'Viña del Mar'] },
  { code: 'CM', name: 'Cameroon', dialCode: '+237', cities: ['Yaoundé', 'Douala', 'Bafoussam', 'Bamenda', 'Garoua', 'Maroua', 'Ngaoundéré'] },
  { code: 'CN', name: 'China', dialCode: '+86', cities: ['Beijing', 'Shanghai', 'Guangzhou', 'Shenzhen', 'Chengdu', 'Hangzhou', 'Wuhan', 'Xi\'an', 'Nanjing', 'Tianjin'] },
  { code: 'CI', name: 'Ivory Coast', dialCode: '+225', cities: ['Abidjan', 'Bouaké', 'Yamoussoukro', 'Korhogo', 'Daloa', 'San-Pédro'] },
  { code: 'CO', name: 'Colombia', dialCode: '+57', cities: ['Bogotá', 'Medellín', 'Cali', 'Barranquilla', 'Cartagena', 'Bucaramanga', 'Santa Marta'] },
  { code: 'DE', name: 'Germany', dialCode: '+49', cities: ['Berlin', 'Munich', 'Frankfurt', 'Hamburg', 'Cologne', 'Stuttgart', 'Düsseldorf', 'Leipzig', 'Dresden'] },
  { code: 'DK', name: 'Denmark', dialCode: '+45', cities: ['Copenhagen', 'Aarhus', 'Odense', 'Aalborg', 'Esbjerg', 'Randers'] },
  { code: 'EG', name: 'Egypt', dialCode: '+20', cities: ['Cairo', 'Alexandria', 'Giza', 'Shubra El-Kheima', 'Port Said', 'Suez', 'Luxor', 'Aswan'] },
  { code: 'ES', name: 'Spain', dialCode: '+34', cities: ['Madrid', 'Barcelona', 'Valencia', 'Seville', 'Zaragoza', 'Málaga', 'Murcia', 'Palma', 'Bilbao'] },
  { code: 'ET', name: 'Ethiopia', dialCode: '+251', cities: ['Addis Ababa', 'Gondar', 'Mekelle', 'Dire Dawa', 'Bahir Dar', 'Adama', 'Hawassa'] },
  { code: 'FR', name: 'France', dialCode: '+33', cities: ['Paris', 'Lyon', 'Marseille', 'Toulouse', 'Nice', 'Nantes', 'Strasbourg', 'Bordeaux', 'Lille'] },
  { code: 'GB', name: 'United Kingdom', dialCode: '+44', cities: ['London', 'Manchester', 'Birmingham', 'Liverpool', 'Leeds', 'Glasgow', 'Edinburgh', 'Bristol', 'Sheffield', 'Newcastle'] },
  { code: 'GH', name: 'Ghana', dialCode: '+233', cities: ['Accra', 'Kumasi', 'Tamale', 'Takoradi', 'Tema', 'Cape Coast', 'Ho', 'Sunyani'] },
  { code: 'ID', name: 'Indonesia', dialCode: '+62', cities: ['Jakarta', 'Surabaya', 'Bandung', 'Medan', 'Semarang', 'Makassar', 'Palembang', 'Bali', 'Yogyakarta'] },
  { code: 'IN', name: 'India', dialCode: '+91', cities: ['Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Kolkata', 'Hyderabad', 'Pune', 'Ahmedabad', 'Jaipur', 'Lucknow'] },
  { code: 'IT', name: 'Italy', dialCode: '+39', cities: ['Rome', 'Milan', 'Naples', 'Turin', 'Florence', 'Venice', 'Bologna', 'Genoa', 'Palermo'] },
  { code: 'JP', name: 'Japan', dialCode: '+81', cities: ['Tokyo', 'Osaka', 'Yokohama', 'Nagoya', 'Sapporo', 'Fukuoka', 'Kobe', 'Kyoto', 'Kawasaki'] },
  { code: 'KE', name: 'Kenya', dialCode: '+254', cities: ['Nairobi', 'Mombasa', 'Kisumu', 'Nakuru', 'Eldoret', 'Thika', 'Malindi', 'Nyeri'] },
  { code: 'KR', name: 'South Korea', dialCode: '+82', cities: ['Seoul', 'Busan', 'Incheon', 'Daegu', 'Daejeon', 'Gwangju', 'Ulsan', 'Suwon'] },
  { code: 'MX', name: 'Mexico', dialCode: '+52', cities: ['Mexico City', 'Guadalajara', 'Monterrey', 'Puebla', 'Tijuana', 'León', 'Juárez', 'Cancún'] },
  { code: 'MY', name: 'Malaysia', dialCode: '+60', cities: ['Kuala Lumpur', 'George Town', 'Johor Bahru', 'Ipoh', 'Shah Alam', 'Petaling Jaya', 'Melaka', 'Kota Kinabalu'] },
  { code: 'NG', name: 'Nigeria', dialCode: '+234', cities: ['Lagos', 'Kano', 'Ibadan', 'Abuja', 'Port Harcourt', 'Benin City', 'Kaduna', 'Enugu', 'Onitsha', 'Calabar'] },
  { code: 'NL', name: 'Netherlands', dialCode: '+31', cities: ['Amsterdam', 'Rotterdam', 'The Hague', 'Utrecht', 'Eindhoven', 'Groningen', 'Tilburg', 'Almere'] },
  { code: 'NO', name: 'Norway', dialCode: '+47', cities: ['Oslo', 'Bergen', 'Trondheim', 'Stavanger', 'Drammen', 'Fredrikstad', 'Tromsø'] },
  { code: 'NZ', name: 'New Zealand', dialCode: '+64', cities: ['Auckland', 'Wellington', 'Christchurch', 'Hamilton', 'Tauranga', 'Dunedin', 'Palmerston North'] },
  { code: 'PE', name: 'Peru', dialCode: '+51', cities: ['Lima', 'Arequipa', 'Trujillo', 'Chiclayo', 'Piura', 'Cusco', 'Iquitos'] },
  { code: 'PH', name: 'Philippines', dialCode: '+63', cities: ['Manila', 'Quezon City', 'Davao City', 'Caloocan', 'Cebu City', 'Zamboanga', 'Antipolo'] },
  { code: 'PK', name: 'Pakistan', dialCode: '+92', cities: ['Karachi', 'Lahore', 'Faisalabad', 'Rawalpindi', 'Multan', 'Islamabad', 'Peshawar', 'Quetta'] },
  { code: 'PL', name: 'Poland', dialCode: '+48', cities: ['Warsaw', 'Kraków', 'Łódź', 'Wrocław', 'Poznań', 'Gdańsk', 'Szczecin', 'Lublin'] },
  { code: 'RU', name: 'Russia', dialCode: '+7', cities: ['Moscow', 'Saint Petersburg', 'Novosibirsk', 'Yekaterinburg', 'Kazan', 'Nizhny Novgorod', 'Samara', 'Chelyabinsk'] },
  { code: 'RW', name: 'Rwanda', dialCode: '+250', cities: ['Kigali', 'Butare', 'Gitarama', 'Ruhengeri', 'Gisenyi', 'Byumba'] },
  { code: 'SA', name: 'Saudi Arabia', dialCode: '+966', cities: ['Riyadh', 'Jeddah', 'Mecca', 'Medina', 'Dammam', 'Khobar', 'Tabuk', 'Abha'] },
  { code: 'SE', name: 'Sweden', dialCode: '+46', cities: ['Stockholm', 'Gothenburg', 'Malmö', 'Uppsala', 'Västerås', 'Örebro', 'Linköping'] },
  { code: 'SG', name: 'Singapore', dialCode: '+65', cities: ['Singapore'] },
  { code: 'SN', name: 'Senegal', dialCode: '+221', cities: ['Dakar', 'Pikine', 'Touba', 'Thiès', 'Kaolack', 'Saint-Louis', 'Ziguinchor'] },
  { code: 'TH', name: 'Thailand', dialCode: '+66', cities: ['Bangkok', 'Chiang Mai', 'Pattaya', 'Phuket', 'Hat Yai', 'Nakhon Ratchasima', 'Udon Thani'] },
  { code: 'TR', name: 'Turkey', dialCode: '+90', cities: ['Istanbul', 'Ankara', 'Izmir', 'Bursa', 'Antalya', 'Adana', 'Konya', 'Gaziantep'] },
  { code: 'TZ', name: 'Tanzania', dialCode: '+255', cities: ['Dar es Salaam', 'Mwanza', 'Arusha', 'Dodoma', 'Zanzibar City', 'Mbeya', 'Tanga'] },
  { code: 'UA', name: 'Ukraine', dialCode: '+380', cities: ['Kyiv', 'Kharkiv', 'Odessa', 'Dnipro', 'Lviv', 'Zaporizhzhia', 'Vinnytsia'] },
  { code: 'AE', name: 'United Arab Emirates', dialCode: '+971', cities: ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Ras Al Khaimah', 'Fujairah', 'Al Ain'] },
  { code: 'UG', name: 'Uganda', dialCode: '+256', cities: ['Kampala', 'Gulu', 'Lira', 'Mbarara', 'Jinja', 'Mbale', 'Entebbe'] },
  { code: 'US', name: 'United States', dialCode: '+1', cities: ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'San Antonio', 'San Diego', 'Dallas', 'San Jose', 'Austin', 'Jacksonville', 'San Francisco', 'Seattle', 'Denver', 'Boston', 'Miami', 'Atlanta', 'Detroit', 'Las Vegas'] },
  { code: 'VN', name: 'Vietnam', dialCode: '+84', cities: ['Ho Chi Minh City', 'Hanoi', 'Da Nang', 'Hai Phong', 'Can Tho', 'Bien Hoa', 'Nha Trang'] },
  { code: 'ZA', name: 'South Africa', dialCode: '+27', cities: ['Johannesburg', 'Cape Town', 'Durban', 'Pretoria', 'Port Elizabeth', 'Bloemfontein', 'East London', 'Soweto'] },
].sort((a, b) => a.name.localeCompare(b.name));

// Top 8 occupation options
export const OCCUPATION_OPTIONS = [
  { value: 'tech', label: 'Software / IT Professional' },
  { value: 'business', label: 'Business / Entrepreneur' },
  { value: 'student', label: 'Student' },
  { value: 'healthcare', label: 'Healthcare Professional' },
  { value: 'education', label: 'Teacher / Educator' },
  { value: 'creative', label: 'Creative / Designer' },
  { value: 'finance', label: 'Finance / Accounting' },
  { value: 'sales', label: 'Sales / Marketing' },
  { value: 'other', label: 'Other' },
];

// Helper functions
export const getCountryByCode = (code: string): Country | undefined => {
  return COUNTRIES.find(c => c.code === code);
};

export const getCountryByDialCode = (dialCode: string): Country | undefined => {
  return COUNTRIES.find(c => c.dialCode === dialCode);
};

export const getCitiesForCountry = (countryCode: string): string[] => {
  const country = getCountryByCode(countryCode);
  return country?.cities || [];
};

export const getDialCodeForCountry = (countryCode: string): string => {
  const country = getCountryByCode(countryCode);
  return country?.dialCode || '';
};

export const searchCountries = (query: string): Country[] => {
  const lowerQuery = query.toLowerCase();
  return COUNTRIES.filter(
    c => c.name.toLowerCase().includes(lowerQuery) || c.code.toLowerCase().includes(lowerQuery)
  );
};

export const searchCities = (countryCode: string, query: string): string[] => {
  const cities = getCitiesForCountry(countryCode);
  const lowerQuery = query.toLowerCase();
  return cities.filter(city => city.toLowerCase().includes(lowerQuery));
};

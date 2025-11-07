// Global trending music service
// Fetches trending songs worldwide by continent

export interface TrendingSong {
  id: string;
  name: string;
  artist: string;
  genre: string;
  continent: string;
  country: string;
  duration: number;
  url: string;
  coverArt?: string;
  trending_rank?: number;
}

// Mock data representing trending songs by continent
// In production, this would connect to music APIs like Spotify, Apple Music, etc.
const CONTINENT_SONGS: Record<string, TrendingSong[]> = {
  africa: [
    { id: 'af1', name: 'Last Last', artist: 'Burna Boy', genre: 'Afrobeats', continent: 'Africa', country: 'Nigeria', duration: 45, url: 'https://example.com/lastlast.mp3', trending_rank: 1 },
    { id: 'af2', name: 'Calm Down', artist: 'Rema & Selena Gomez', genre: 'Afrobeats', continent: 'Africa', country: 'Nigeria', duration: 50, url: 'https://example.com/calmdown.mp3', trending_rank: 2 },
    { id: 'af3', name: 'Peru', artist: 'Fireboy DML & Ed Sheeran', genre: 'Afropop', continent: 'Africa', country: 'Nigeria', duration: 48, url: 'https://example.com/peru.mp3', trending_rank: 3 },
    { id: 'af4', name: 'Essence', artist: 'Wizkid ft Tems', genre: 'Afrobeats', continent: 'Africa', country: 'Nigeria', duration: 44, url: 'https://example.com/essence.mp3', trending_rank: 4 },
    { id: 'af5', name: 'Love Nwantiti', artist: 'CKay', genre: 'Afrobeats', continent: 'Africa', country: 'Nigeria', duration: 50, url: 'https://example.com/love.mp3', trending_rank: 5 },
    { id: 'af6', name: 'Jerusalema', artist: 'Master KG ft Nomcebo', genre: 'House', continent: 'Africa', country: 'South Africa', duration: 55, url: 'https://example.com/jerusalema.mp3', trending_rank: 6 },
    { id: 'af7', name: 'Buga', artist: 'Kizz Daniel & Tekno', genre: 'Afropop', continent: 'Africa', country: 'Nigeria', duration: 46, url: 'https://example.com/buga.mp3', trending_rank: 7 },
    { id: 'af8', name: 'Joanna', artist: 'Kizz Daniel', genre: 'Afrobeats', continent: 'Africa', country: 'Nigeria', duration: 52, url: 'https://example.com/joanna.mp3', trending_rank: 8 },
    { id: 'af9', name: 'Sungba', artist: 'Asake & Burna Boy', genre: 'Afrobeats', continent: 'Africa', country: 'Nigeria', duration: 49, url: 'https://example.com/sungba.mp3', trending_rank: 9 },
    { id: 'af10', name: 'Ye', artist: 'Burna Boy', genre: 'Afrobeats', continent: 'Africa', country: 'Nigeria', duration: 52, url: 'https://example.com/ye.mp3', trending_rank: 10 },
    { id: 'af11', name: 'Duduke', artist: 'Simi', genre: 'Afropop', continent: 'Africa', country: 'Nigeria', duration: 48, url: 'https://example.com/duduke.mp3', trending_rank: 11 },
    { id: 'af12', name: 'Soweto', artist: 'Victony & Tempoe', genre: 'Amapiano', continent: 'Africa', country: 'Nigeria', duration: 47, url: 'https://example.com/soweto.mp3', trending_rank: 12 },
    { id: 'af13', name: 'Km Remix', artist: 'Omah Lay & Tems', genre: 'Afropop', continent: 'Africa', country: 'Nigeria', duration: 51, url: 'https://example.com/kmremix.mp3', trending_rank: 13 },
    { id: 'af14', name: 'Water', artist: 'Tyla', genre: 'Amapiano', continent: 'Africa', country: 'South Africa', duration: 45, url: 'https://example.com/water.mp3', trending_rank: 14 },
    { id: 'af15', name: 'Jealous', artist: 'Fireboy DML', genre: 'Afropop', continent: 'Africa', country: 'Nigeria', duration: 50, url: 'https://example.com/jealous.mp3', trending_rank: 15 },
  ],
  europe: [
    { id: 'eu1', name: 'As It Was', artist: 'Harry Styles', genre: 'Pop', continent: 'Europe', country: 'UK', duration: 47, url: 'https://example.com/asitwas.mp3', trending_rank: 1 },
    { id: 'eu2', name: 'Flowers', artist: 'Miley Cyrus', genre: 'Pop', continent: 'Europe', country: 'UK', duration: 50, url: 'https://example.com/flowers.mp3', trending_rank: 2 },
    { id: 'eu3', name: 'Anti-Hero', artist: 'Taylor Swift', genre: 'Pop', continent: 'Europe', country: 'UK', duration: 48, url: 'https://example.com/antihero.mp3', trending_rank: 3 },
    { id: 'eu4', name: 'Unholy', artist: 'Sam Smith & Kim Petras', genre: 'Pop', continent: 'Europe', country: 'UK', duration: 45, url: 'https://example.com/unholy.mp3', trending_rank: 4 },
    { id: 'eu5', name: 'Dance The Night', artist: 'Dua Lipa', genre: 'Pop', continent: 'Europe', country: 'UK', duration: 46, url: 'https://example.com/dancenight.mp3', trending_rank: 5 },
    { id: 'eu6', name: 'Blinding Lights', artist: 'The Weeknd', genre: 'Pop', continent: 'Europe', country: 'Sweden', duration: 48, url: 'https://example.com/blinding.mp3', trending_rank: 6 },
    { id: 'eu7', name: 'Heat Waves', artist: 'Glass Animals', genre: 'Indie', continent: 'Europe', country: 'UK', duration: 58, url: 'https://example.com/heat.mp3', trending_rank: 7 },
    { id: 'eu8', name: 'Starboy', artist: 'The Weeknd & Daft Punk', genre: 'Electronic', continent: 'Europe', country: 'France', duration: 50, url: 'https://example.com/starboy.mp3', trending_rank: 8 },
    { id: 'eu9', name: 'Levitating', artist: 'Dua Lipa', genre: 'Pop', continent: 'Europe', country: 'UK', duration: 45, url: 'https://example.com/levitating.mp3', trending_rank: 9 },
    { id: 'eu10', name: 'Shivers', artist: 'Ed Sheeran', genre: 'Pop', continent: 'Europe', country: 'UK', duration: 47, url: 'https://example.com/shivers.mp3', trending_rank: 10 },
    { id: 'eu11', name: 'Somebody', artist: 'Gotye ft Kimbra', genre: 'Indie Pop', continent: 'Europe', country: 'Belgium', duration: 52, url: 'https://example.com/somebody.mp3', trending_rank: 11 },
    { id: 'eu12', name: 'Symphony', artist: 'Clean Bandit ft Zara', genre: 'Electronic', continent: 'Europe', country: 'UK', duration: 49, url: 'https://example.com/symphony.mp3', trending_rank: 12 },
    { id: 'eu13', name: 'Stereo Love', artist: 'Edward Maya', genre: 'Dance', continent: 'Europe', country: 'Romania', duration: 48, url: 'https://example.com/stereolove.mp3', trending_rank: 13 },
    { id: 'eu14', name: 'Bailando', artist: 'Enrique Iglesias', genre: 'Latin Pop', continent: 'Europe', country: 'Spain', duration: 51, url: 'https://example.com/bailando.mp3', trending_rank: 14 },
    { id: 'eu15', name: 'Stromae Papaoutai', artist: 'Stromae', genre: 'Electronic', continent: 'Europe', country: 'Belgium', duration: 46, url: 'https://example.com/papaoutai.mp3', trending_rank: 15 },
  ],
  americas: [
    { id: 'am1', name: 'Peaches', artist: 'Justin Bieber', genre: 'Pop', continent: 'Americas', country: 'USA', duration: 48, url: 'https://example.com/peaches.mp3', trending_rank: 1 },
    { id: 'am2', name: 'Good 4 U', artist: 'Olivia Rodrigo', genre: 'Pop Rock', continent: 'Americas', country: 'USA', duration: 52, url: 'https://example.com/good4u.mp3', trending_rank: 2 },
    { id: 'am3', name: 'Montero', artist: 'Lil Nas X', genre: 'Hip Hop', continent: 'Americas', country: 'USA', duration: 50, url: 'https://example.com/montero.mp3', trending_rank: 3 },
    { id: 'am4', name: 'Levitating', artist: 'Dua Lipa', genre: 'Pop', continent: 'Americas', country: 'USA', duration: 45, url: 'https://example.com/levitating2.mp3', trending_rank: 4 },
    { id: 'am5', name: 'Dákiti', artist: 'Bad Bunny', genre: 'Reggaeton', continent: 'Americas', country: 'Puerto Rico', duration: 55, url: 'https://example.com/dakiti.mp3', trending_rank: 5 },
  ],
  asia: [
    { id: 'as1', name: 'Dynamite', artist: 'BTS', genre: 'K-Pop', continent: 'Asia', country: 'South Korea', duration: 50, url: 'https://example.com/dynamite.mp3', trending_rank: 1 },
    { id: 'as2', name: 'Permission to Dance', artist: 'BTS', genre: 'K-Pop', continent: 'Asia', country: 'South Korea', duration: 48, url: 'https://example.com/permission.mp3', trending_rank: 2 },
    { id: 'as3', name: 'Butter', artist: 'BTS', genre: 'K-Pop', continent: 'Asia', country: 'South Korea', duration: 52, url: 'https://example.com/butter.mp3', trending_rank: 3 },
    { id: 'as4', name: 'Life Goes On', artist: 'BTS', genre: 'K-Pop', continent: 'Asia', country: 'South Korea', duration: 55, url: 'https://example.com/lifegoes.mp3', trending_rank: 4 },
    { id: 'as5', name: 'How You Like That', artist: 'BLACKPINK', genre: 'K-Pop', continent: 'Asia', country: 'South Korea', duration: 50, url: 'https://example.com/howyou.mp3', trending_rank: 5 },
  ],
  worldwide: [
    { id: 'ww1', name: 'Calm Down', artist: 'Rema & Selena Gomez', genre: 'Afrobeats', continent: 'Worldwide', country: 'Global', duration: 50, url: 'https://example.com/calmdown.mp3', trending_rank: 1 },
    { id: 'ww2', name: 'Flowers', artist: 'Miley Cyrus', genre: 'Pop', continent: 'Worldwide', country: 'Global', duration: 50, url: 'https://example.com/flowers.mp3', trending_rank: 2 },
    { id: 'ww3', name: 'As It Was', artist: 'Harry Styles', genre: 'Pop', continent: 'Worldwide', country: 'Global', duration: 47, url: 'https://example.com/asitwas.mp3', trending_rank: 3 },
    { id: 'ww4', name: 'Last Last', artist: 'Burna Boy', genre: 'Afrobeats', continent: 'Worldwide', country: 'Global', duration: 45, url: 'https://example.com/lastlast.mp3', trending_rank: 4 },
    { id: 'ww5', name: 'Anti-Hero', artist: 'Taylor Swift', genre: 'Pop', continent: 'Worldwide', country: 'Global', duration: 48, url: 'https://example.com/antihero.mp3', trending_rank: 5 },
    { id: 'ww6', name: 'Essence', artist: 'Wizkid ft Tems', genre: 'Afrobeats', continent: 'Worldwide', country: 'Global', duration: 44, url: 'https://example.com/essence.mp3', trending_rank: 6 },
    { id: 'ww7', name: 'Blinding Lights', artist: 'The Weeknd', genre: 'Pop', continent: 'Worldwide', country: 'Global', duration: 48, url: 'https://example.com/blinding.mp3', trending_rank: 7 },
    { id: 'ww8', name: 'Water', artist: 'Tyla', genre: 'Amapiano', continent: 'Worldwide', country: 'Global', duration: 45, url: 'https://example.com/water.mp3', trending_rank: 8 },
    { id: 'ww9', name: 'Unholy', artist: 'Sam Smith & Kim Petras', genre: 'Pop', continent: 'Worldwide', country: 'Global', duration: 45, url: 'https://example.com/unholy.mp3', trending_rank: 9 },
    { id: 'ww10', name: 'Peru', artist: 'Fireboy DML & Ed Sheeran', genre: 'Afropop', continent: 'Worldwide', country: 'Global', duration: 48, url: 'https://example.com/peru.mp3', trending_rank: 10 },
  ],
};

/**
 * Fetch trending songs by continent
 * @param continent - 'africa' | 'europe' | 'americas' | 'asia' | 'worldwide'
 * @returns Promise<TrendingSong[]>
 */
export async function fetchTrendingSongs(continent: string = 'worldwide'): Promise<TrendingSong[]> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  const continentKey = continent.toLowerCase();
  return CONTINENT_SONGS[continentKey] || CONTINENT_SONGS.worldwide;
}

/**
 * Get all continents available
 */
export function getAvailableContinents(): string[] {
  return ['Worldwide', 'Africa', 'Europe', 'Americas', 'Asia'];
}

/**
 * Check if music file is copyright-free (mock implementation)
 * In production, this would check against a copyright database
 * @param audioFile - File to check
 * @returns Promise<{ isSafe: boolean; reason?: string }>
 */
export async function checkCopyrightStatus(audioFile: File): Promise<{ isSafe: boolean; reason?: string }> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 300));
  
  // Mock implementation - in production, this would use audio fingerprinting
  // and check against copyright databases
  
  // For demo purposes, accept all user-uploaded files
  // In production, you'd integrate with services like:
  // - ACRCloud
  // - Audible Magic
  // - Content ID systems
  
  return {
    isSafe: true,
    reason: 'Audio cleared for use'
  };
}

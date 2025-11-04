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
    { id: 'af1', name: 'Essence', artist: 'Wizkid ft Tems', genre: 'Afrobeats', continent: 'Africa', country: 'Nigeria', duration: 45, url: 'https://example.com/essence.mp3', trending_rank: 1 },
    { id: 'af2', name: 'Love Nwantiti', artist: 'CKay', genre: 'Afrobeats', continent: 'Africa', country: 'Nigeria', duration: 50, url: 'https://example.com/love.mp3', trending_rank: 2 },
    { id: 'af3', name: 'Jerusalema', artist: 'Master KG', genre: 'House', continent: 'Africa', country: 'South Africa', duration: 55, url: 'https://example.com/jerusalema.mp3', trending_rank: 3 },
    { id: 'af4', name: 'Duduke', artist: 'Simi', genre: 'Afropop', continent: 'Africa', country: 'Nigeria', duration: 48, url: 'https://example.com/duduke.mp3', trending_rank: 4 },
    { id: 'af5', name: 'Ye', artist: 'Burna Boy', genre: 'Afrobeats', continent: 'Africa', country: 'Nigeria', duration: 52, url: 'https://example.com/ye.mp3', trending_rank: 5 },
  ],
  europe: [
    { id: 'eu1', name: 'Blinding Lights', artist: 'The Weeknd', genre: 'Pop', continent: 'Europe', country: 'UK', duration: 48, url: 'https://example.com/blinding.mp3', trending_rank: 1 },
    { id: 'eu2', name: 'Dance Monkey', artist: 'Tones and I', genre: 'Pop', continent: 'Europe', country: 'UK', duration: 50, url: 'https://example.com/dance.mp3', trending_rank: 2 },
    { id: 'eu3', name: 'Levitating', artist: 'Dua Lipa', genre: 'Pop', continent: 'Europe', country: 'UK', duration: 45, url: 'https://example.com/levitating.mp3', trending_rank: 3 },
    { id: 'eu4', name: 'Roses', artist: 'SAINt JHN', genre: 'Electronic', continent: 'Europe', country: 'France', duration: 55, url: 'https://example.com/roses.mp3', trending_rank: 4 },
    { id: 'eu5', name: 'Heat Waves', artist: 'Glass Animals', genre: 'Indie', continent: 'Europe', country: 'UK', duration: 58, url: 'https://example.com/heat.mp3', trending_rank: 5 },
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
    { id: 'ww1', name: 'Essence', artist: 'Wizkid ft Tems', genre: 'Afrobeats', continent: 'Worldwide', country: 'Global', duration: 45, url: 'https://example.com/essence.mp3', trending_rank: 1 },
    { id: 'ww2', name: 'Blinding Lights', artist: 'The Weeknd', genre: 'Pop', continent: 'Worldwide', country: 'Global', duration: 48, url: 'https://example.com/blinding.mp3', trending_rank: 2 },
    { id: 'ww3', name: 'Dynamite', artist: 'BTS', genre: 'K-Pop', continent: 'Worldwide', country: 'Global', duration: 50, url: 'https://example.com/dynamite.mp3', trending_rank: 3 },
    { id: 'ww4', name: 'Peaches', artist: 'Justin Bieber', genre: 'Pop', continent: 'Worldwide', country: 'Global', duration: 48, url: 'https://example.com/peaches.mp3', trending_rank: 4 },
    { id: 'ww5', name: 'Levitating', artist: 'Dua Lipa', genre: 'Pop', continent: 'Worldwide', country: 'Global', duration: 45, url: 'https://example.com/levitating.mp3', trending_rank: 5 },
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

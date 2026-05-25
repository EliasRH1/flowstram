const TMDB_API = 'https://api.themoviedb.org/3';
const IMG_BASE = 'https://image.tmdb.org/t/p/w500';

export default {
  name: 'CineLatino',
  sites: ['CineLatino'],
  async search(query) {
    const url = `${TMDB_API}/search/multi?api_key=8211af3153e6e27b1eaa63a89f7cd8c1&query=${encodeURIComponent(query)}&language=es&page=1&include_adult=false`;
    const res = await fetch(url);
    const json = await res.json();
    return (json.results || [])
      .filter(r => r.media_type === 'movie' && r.poster_path)
      .slice(0, 10)
      .map(r => ({
        id: `tmdb:${r.id}`,
        title: r.title || r.name || '',
        year: (r.release_date || '').split('-')[0] || '',
        type: 'movie',
        poster: r.poster_path ? `${IMG_BASE}${r.poster_path}` : '',
        description: r.overview || '',
      }));
  },
  async getStreams(id) {
    const tmdbId = id.replace('tmdb:', '');
    const url = `${TMDB_API}/movie/${tmdbId}?api_key=8211af3153e6e27b1eaa63a89f7cd8c1&language=es&append_to_response=credits`;
    const res = await fetch(url);
    const json = await res.json();
    const genres = (json.genres || []).map(g => g.name).join(', ');
    const cast = (json.credits?.cast || []).slice(0, 5).map(c => c.name).join(', ');
    return [{
      url: '',
      quality: 'Metadata',
      server: `Géneros: ${genres || 'N/A'} | Elenco: ${cast || 'N/A'}`,
    }];
  },
};

// Ejemplo de extensión para FlowStream
// Las extensiones se cargan desde URLs raw de GitHub
(function() {
  return {
    name: "CineEjemplo",
    sites: ["cineejejemplo.com"],
    search: async function(query) {
      // Simula búsqueda de contenido
      await new Promise(r => setTimeout(r, 500));
      return [
        {
          id: "tt0111161",
          title: "The Shawshank Redemption",
          year: "1994",
          type: "movie",
          poster: "https://image.tmdb.org/t/p/w185/9cjIGRQL1m4E87FkTJjfBOh6sJp.jpg"
        },
        {
          id: "tt0068646",
          title: "The Godfather",
          year: "1972",
          type: "movie",
          poster: "https://image.tmdb.org/t/p/w185/3bhkrj58Vtu7enYsRolD1fZdja1.jpg"
        },
        {
          id: "tt0468569",
          title: "The Dark Knight",
          year: "2008",
          type: "movie",
          poster: "https://image.tmdb.org/t/p/w185/qJ2tW6WMUDux911BytUrS4hZmR5.jpg"
        }
      ];
    },
    getStreams: async function(id) {
      await new Promise(r => setTimeout(r, 300));
      return [
        { url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8", quality: "1080p", server: "Server 1" },
        { url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8", quality: "720p", server: "Server 2" }
      ];
    }
  };
})();

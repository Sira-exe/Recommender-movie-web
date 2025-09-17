const API_BASE = "http://98.84.132.89:3222/api"; 

/* ===== State ===== */
let currentMovie = null;
const movieList = [];
let suggestions = [];
let activeIndex = -1;

/* ===== Utils ===== */
const $ = id => document.getElementById(id);
const normalize = s => (s||'').toString().trim().toLowerCase();
function toggleTheme(){ document.body.classList.toggle('light-theme'); }

/* ===== Form submit ===== */
$('movieForm').addEventListener('submit', handleSubmit);
function handleSubmit(e){
  e.preventDefault();
  if(!currentMovie){
    const q = normalize($('title').value);
    const exact = suggestions.find(s => normalize(s.title) === q);
    if(exact){ selectSuggestion(exact).then(()=> addMovie()); return; }
  }
  addMovie();
}

/* ===== Search movies via backend ===== */
const searchMovies = async (query)=>{
  $('suggList').style.display = 'none';
  suggestions = []; activeIndex = -1;
  currentMovie = null;

  if(!query.trim()) return;

  const r = await fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}`);
  const j = await r.json();
  suggestions = (j.results || []).slice(0, 8);
  renderSuggestions();
};

$('title').addEventListener('input', e => searchMovies(e.target.value));

function renderSuggestions(){
  const list = $('suggList');
  list.innerHTML = '';
  if(!suggestions.length){
    list.innerHTML = `<div class="sugg-nores">No results found</div>`;
    list.style.display = 'block';
    return;
  }
  suggestions.forEach((m, idx) => {
    const year = (m.release_date||'').slice(0,4) || '—';
    const li = document.createElement('div');
    li.className = 'sugg-item'; li.dataset.index = idx;
    li.innerHTML = `
      <img class="sugg-thumb" src="${m.poster_path?`https://image.tmdb.org/t/p/w92${m.poster_path}`:''}" alt="">
      <div class="sugg-meta">
        <div class="sugg-title">${m.title}</div>
        <div class="sugg-year">${year}</div>
      </div>
    `;
    li.addEventListener('click', async ()=> { await selectSuggestion(m); hideSuggestions(); });
    list.appendChild(li);
  });
  list.style.display = 'block';
}
function hideSuggestions(){ $('suggList').style.display = 'none'; activeIndex = -1; }

/* ===== Select suggestion ===== */
async function selectSuggestion(m){
  const r = await fetch(`${API_BASE}/movie/${m.id}`);
  const detail = await r.json();

  currentMovie = {
    title: detail.title,
    year: (detail.release_date||'').slice(0,4),
    genre: (detail.genres||[]).map(g => g.name).join(', ') || '—',
    rating: detail.vote_average ? detail.vote_average.toFixed(1) : '—',
    review: detail.overview || '-',
    poster: detail.poster_path ? `https://image.tmdb.org/t/p/w500${detail.poster_path}` : '',
    posterThumb: detail.poster_path ? `https://image.tmdb.org/t/p/w92${detail.poster_path}` : ''
  };

  $('title').value = currentMovie.title;
  $('previewTitle').textContent  = currentMovie.title;
  $('previewGenre').textContent  = currentMovie.genre;
  $('previewRating').textContent = currentMovie.rating;
  $('previewReview').textContent = currentMovie.review;
  if(currentMovie.poster){ $('previewPoster').src=currentMovie.poster; }
  $('previewBox').classList.remove('hidden');
}

// Add after selectSuggestion or at bottom of file
$('addBtn').addEventListener('click', () => {
  addMovie();
});

/* ===== Add Movie ===== */
function addMovie(){
  const newTitle = normalize(currentMovie.title);
  const isDup = movieList.some(m => normalize(m.title) === newTitle);
  if(isDup){ alert("Already in list."); return; }

  movieList.push(currentMovie);
  renderMovieList();
  updateRecommendation();

  currentMovie = null;
  $('title').value='';
  $('previewBox').classList.add('hidden');
}

function renderMovieList(){
  const tb = $('movieList');
  tb.innerHTML = '';
  movieList.forEach((m,i)=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><div class="name-cell">
        <img class="name-thumb" src="${m.posterThumb||''}" alt="">
        <span class="name-title">${m.title}</span>
      </div></td>
      <td>${m.genre}</td>
      <td>${m.rating}</td>
      <td><button onclick="deleteMovie(${i})">🗑️</button></td>
    `;
    tb.appendChild(tr);
  });
}
function deleteMovie(i){ movieList.splice(i,1); renderMovieList(); updateRecommendation(); }

/* ===== Recommendations via backend ===== */
async function updateRecommendation(){
  const ai = $('aiRecommendation');
  if(!movieList.length){
    ai.innerText = "Add movies to get smart recommendations here!";
    return;
  }
  ai.innerHTML = `<div style="opacity:.9">🔄 Generating Gemini recommendations...</div>`;

  try{
    const r = await fetch(`${API_BASE}/recommend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ list: movieList })
    });
    const data = await r.json();

    // Parse Gemini JSON
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
    }
    const recs = Array.isArray(parsed?.recommendations) ? parsed.recommendations : [];

    // Enrich with TMDb details
    const enriched = [];
    for(const r of recs){
      const search = await fetch(`${API_BASE}/search?q=${encodeURIComponent(r.title)}`);
      const sj = await search.json();
      const found = (sj.results||[])[0];
      if(found){
        const detail = await fetch(`${API_BASE}/movie/${found.id}`);
        const dj = await detail.json();
        enriched.push({
          title: dj.title,
          genre: (dj.genres||[]).map(g=>g.name).join(', ') || '—',
          rating: dj.vote_average ? dj.vote_average.toFixed(1) : '—',
          overview: dj.overview || r.reason || '-',
          poster: dj.poster_path ? `https://image.tmdb.org/t/p/w500${dj.poster_path}` : ''
        });
      }
      if(enriched.length >= 3) break;
    }

    renderRecommendationCards(enriched);
  }catch(err){
    ai.innerHTML = `<div>⚠️ Error: ${err.message}</div>`;
  }
}

/* ===== Render Recommendation Cards ===== */
function renderRecommendationCards(cards){
  const box = $('aiRecommendation');
  if(!cards || !cards.length){
    box.innerText = 'Add movies to get smart recommendations here!';
    return;
  }
  box.innerHTML = `
    <div class="rec-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;">
      ${cards.map(c => `
        <div class="rec-card" style="background:var(--input-bg);border:1px solid var(--border-color);border-radius:14px;overflow:hidden;box-shadow:0 8px 18px rgba(0,0,0,.25)">
          ${c.poster ? `<img src="${c.poster}" alt="${c.title} poster" style="width:100%;height:360px;object-fit:cover;display:block;">` : ''}
          <div style="padding:12px 14px">
            <div style="font-weight:800;font-size:1.05rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${c.title}</div>
            <div style="opacity:.9;margin:6px 0;"><b>📘 Genre:</b> ${c.genre||'—'}</div>
            <div style="opacity:.9;margin:6px 0;"><b>⭐ Rating:</b> ${c.rating||'—'}</div>
            <div style="opacity:.95;line-height:1.35;"><b>📝 Overview:</b> ${c.overview||'-'}</div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

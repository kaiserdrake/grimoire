/**
 * Exports game list and playthrough information as a JSON file download.
 *
 * The exported structure is an array of game objects, each containing
 * their full playthrough and session data as returned by the API.
 *
 * @param {Object[]} games    - Array of game objects from the API
 * @param {string}   [filename='games-export.json']
 */
export function downloadGamesJson(games, filename = 'games-export.json') {
  const json   = JSON.stringify(games, null, 2);
  const blob   = new Blob([json], { type: 'application/json;charset=utf-8;' });
  const url    = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href     = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

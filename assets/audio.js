// Recitation player of the Quran reader: plays one ayah file after the other
// from EveryAyah.com (see AUDIO in sources.js), marks the ayah being recited
// and shows a small bar to pause or stop.

import { AUDIO } from './sources.js';

let opts = null; // { t, reciter, toast }
let audio = null;
let bar = null;
let now = null; // { s, a, total }

const ICON = {
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg>',
  pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor"/></svg>',
  stop: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
};

export function initAudio(options) {
  opts = options;
}

const reciter = () => AUDIO.reciters[opts.reciter()] || AUDIO.reciters[AUDIO.default];
export const audioUrl = (s, a) => AUDIO.base + AUDIO.file(reciter().folder, s, a);

function mark() {
  document.querySelectorAll('.ayah.playing').forEach((n) => n.classList.remove('playing'));
  if (!now) return;
  const item = document.getElementById(`a-${now.a}`);
  if (!item) return;
  item.classList.add('playing');
  const r = item.getBoundingClientRect();
  if (r.top < 70 || r.bottom > window.innerHeight - 90) {
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    item.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'center' });
  }
}

function paint() {
  if (!bar) return;
  const playing = audio && !audio.paused;
  const lang = document.documentElement.lang;
  bar.hidden = !now;
  if (!now) return;
  bar.querySelector('.player-key').textContent = `${now.s}:${now.a}`;
  bar.querySelector('.player-name').textContent = lang === 'ar' ? reciter().ar : reciter().name;
  const toggle = bar.querySelector('.player-toggle');
  toggle.innerHTML = playing ? ICON.pause : ICON.play; // static icons from this file
  toggle.setAttribute('aria-label', playing ? opts.t('audioPause') : opts.t('audioResume'));
  bar.querySelector('.player-stop').setAttribute('aria-label', opts.t('audioStop'));
}

function ensure() {
  if (audio) return;
  audio = new Audio();
  audio.preload = 'auto';
  audio.addEventListener('ended', () => {
    if (!now) return;
    if (now.a < now.total) start(now.s, now.a + 1, now.total);
    else stopAudio();
  });
  audio.addEventListener('error', () => {
    if (!now) return;
    opts.toast(opts.t('audioError'));
    stopAudio();
  });
  audio.addEventListener('play', paint);
  audio.addEventListener('pause', paint);

  bar = document.createElement('div');
  bar.className = 'player';
  bar.hidden = true;
  bar.innerHTML =
    '<button type="button" class="player-toggle"></button>' +
    '<span class="player-text"><strong class="player-key"></strong> <span class="player-name"></span></span>' +
    `<button type="button" class="player-stop">${ICON.stop}</button>`;
  bar.querySelector('.player-toggle').addEventListener('click', () => {
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
  });
  bar.querySelector('.player-stop').addEventListener('click', stopAudio);
  document.body.append(bar);
}

function start(s, a, total) {
  now = { s, a, total };
  audio.src = audioUrl(s, a);
  audio.play().catch((error) => {
    // A refused autoplay keeps the bar so one more tap starts it.
    if (error && error.name !== 'NotAllowedError' && error.name !== 'AbortError') {
      opts.toast(opts.t('audioError'));
      stopAudio();
    }
  });
  mark();
  paint();
}

// Plays ayah `a` of surah `s`, then the following ayat to the end of the surah.
// Tapping the ayah that is playing pauses it.
export function playFrom(s, a, total) {
  ensure();
  if (now && now.s === s && now.a === a) {
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
    return;
  }
  start(s, a, total);
}

export function stopAudio() {
  if (!audio) return;
  now = null;
  audio.pause();
  audio.removeAttribute('src');
  mark();
  paint();
}

// After the page was drawn again (settings changed): mark the ayah again.
export function refreshAudio() {
  mark();
  paint();
}

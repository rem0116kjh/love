(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const root = $('experience');
  const canvas = $('winter-canvas');
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const storageKey = 'noel.private-wish.v1';
  const paletteNames = ['Evergreen', 'Champagne', 'Aurora'];
  let scene;
  let savedWish = '';
  let toastTimer;
  let wishTimers = [];
  let audio;
  let soundPending = false;

  function notify(message, duration = 3600) {
    clearTimeout(toastTimer);
    $('toast').textContent = message;
    $('toast').classList.add('visible');
    toastTimer = setTimeout(() => $('toast').classList.remove('visible'), duration);
  }
  function announce(message) { $('scene-announcement').textContent = message; }
  function updateGestureHint() {
    $('gesture-hint').querySelector('span').textContent = window.innerWidth <= 760 ? '한 손가락으로 회전 · 두 손가락으로 확대' : '드래그하여 회전 · 스크롤하여 가까이';
  }
  updateGestureHint();
  window.addEventListener('resize', updateGestureHint);
  function updatePauseButton() {
    if (!scene) return;
    const button = $('pause-button');
    const label = scene.paused ? '움직임 재생하기' : '움직임 멈추기';
    button.setAttribute('aria-label', label);
    button.setAttribute('aria-pressed', String(scene.paused));
    button.title = label + ' (Space)';
    button.querySelector('use').setAttribute('href', scene.paused ? '#i-play' : '#i-pause');
  }
  function sceneError(message) {
    root.classList.add('scene-error');
    $('loading').hidden = true;
    $('fallback').hidden = false;
    if (message) $('fallback').querySelector('p').textContent = message;
    announce('작품을 표시하지 못했습니다. 다시 시도할 수 있습니다.');
  }
  try {
    scene = new window.WinterScene(canvas, {
      reducedMotion: motionPreference.matches,
      onReady() {
        root.classList.add('is-ready');
        $('loading').setAttribute('aria-hidden', 'true');
        updatePauseButton();
      },
      onError: sceneError,
      onRestore() { root.classList.remove('scene-error'); $('fallback').hidden = true; notify('겨울의 빛이 돌아왔어요.'); },
      onInteract() { $('gesture-hint').style.opacity = '0'; },
    });
  } catch (error) {
    console.error('NOËL renderer:', error);
    sceneError('브라우저의 하드웨어 가속을 켜거나 다른 브라우저에서 이 겨울을 열어 주세요.');
  }
  $('retry-button').addEventListener('click', () => window.location.reload());
  motionPreference.addEventListener('change', event => {
    if (!scene) return;
    scene.reducedMotion = event.matches;
    if (event.matches) { scene.setPaused(true); scene.formation = 1; updatePauseButton(); }
  });

  document.querySelectorAll('[data-palette]').forEach(button => {
    button.addEventListener('click', () => {
      const palette = Number(button.dataset.palette);
      scene?.setPalette(palette);
      document.querySelectorAll('[data-palette]').forEach(item => {
        const selected = item === button;
        item.classList.toggle('selected', selected);
        item.setAttribute('aria-pressed', String(selected));
      });
      $('palette-label').textContent = paletteNames[palette];
      announce(paletteNames[palette] + ' 색상으로 바뀌었습니다.');
    });
  });
  document.querySelectorAll('[data-mode]').forEach(button => {
    button.addEventListener('click', () => {
      scene?.setMode(Number(button.dataset.mode));
      document.querySelectorAll('[data-mode]').forEach(item => {
        const selected = item === button;
        item.classList.toggle('active', selected);
        item.setAttribute('aria-pressed', String(selected));
      });
      announce(button.dataset.mode === '0' ? '문자로 그린 겨울입니다.' : '별빛으로 그린 겨울입니다.');
    });
  });
  $('pause-button').addEventListener('click', () => {
    if (!scene) return;
    scene.setPaused(!scene.paused); updatePauseButton();
    announce(scene.paused ? '움직임을 멈췄습니다.' : '움직임을 재생합니다.');
  });

  function clearWishEffect() {
    wishTimers.forEach(clearTimeout); wishTimers = [];
    $('wish-floating').classList.remove('visible'); root.classList.remove('wish-active');
    scene?.cancelWish();
  }
  $('replay-button').addEventListener('click', () => {
    clearWishEffect(); scene?.replay(); updatePauseButton();
    announce('트리가 다시 피어납니다.');
  });
  $('burst-button').addEventListener('click', () => { scene?.burst(); audio?.chime(); announce('별빛이 흩날립니다.'); });

  // An original, quiet pentatonic score. All sound is synthesized locally.
  class WinterAudio {
    constructor() {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) throw new Error('이 브라우저는 음악 재생을 지원하지 않아요.');
      this.context = new AudioContext();
      this.enabled = false;
      this.step = 0;
      this.nextNote = 0;
      this.timer = null;
      this.master = this.context.createGain(); this.master.gain.value = 0;
      const compressor = this.context.createDynamicsCompressor();
      compressor.threshold.value = -20; compressor.ratio.value = 5;
      this.master.connect(compressor); compressor.connect(this.context.destination);
      this.reverb = this.context.createConvolver();
      const length = Math.floor(this.context.sampleRate * 3.2);
      const impulse = this.context.createBuffer(2, length, this.context.sampleRate);
      for (let channel = 0; channel < 2; channel++) {
        const data = impulse.getChannelData(channel);
        for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 3.4) * 0.36;
      }
      this.reverb.buffer = impulse;
      const wet = this.context.createGain(); wet.gain.value = 0.55;
      this.reverb.connect(wet); wet.connect(this.master);
      this.melody = [74, null, 81, 78, null, 76, 69, null, 74, 78, null, 85, 81, null, 78, 76, 71, null, 78, 81, null, 76, 74, null, 69, 74, null, 78, 76, null, 74, null];
    }
    bell(midi, time, velocity = 0.1, length = 3.2) {
      const frequency = 440 * Math.pow(2, (midi - 69) / 12);
      [1, 2.003, 3.997].forEach((ratio, i) => {
        const oscillator = this.context.createOscillator();
        const gain = this.context.createGain();
        oscillator.type = 'sine'; oscillator.frequency.value = frequency * ratio;
        const level = velocity * [1, 0.21, 0.045][i];
        gain.gain.setValueAtTime(0.0001, time);
        gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, level), time + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + length / (1 + i * 0.6));
        oscillator.connect(gain); gain.connect(this.master); gain.connect(this.reverb);
        oscillator.start(time); oscillator.stop(time + length + 0.1);
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
      });
    }
    schedule() {
      if (!this.enabled || document.hidden || this.context.state !== 'running') return;
      const now = this.context.currentTime;
      if (this.nextNote < now) this.nextNote = now + 0.06;
      while (this.nextNote < now + 0.22) {
        const note = this.melody[this.step % this.melody.length];
        if (note) this.bell(note, this.nextNote, 0.085);
        if (this.step % 8 === 0) {
          const root = [50, 47, 43, 45][Math.floor(this.step / 8) % 4];
          this.bell(root, this.nextNote, 0.09, 5.3);
          this.bell(root + 7, this.nextNote + 0.08, 0.045, 4.8);
        }
        this.nextNote += 0.73; this.step++;
      }
    }
    async toggle() {
      if (!this.enabled) {
        await this.context.resume();
        if (this.context.state !== 'running') throw new Error('재생 버튼을 한 번 더 눌러 주세요.');
        this.enabled = true;
        this.master.gain.cancelScheduledValues(this.context.currentTime);
        this.master.gain.setTargetAtTime(0.65, this.context.currentTime, 0.35);
        this.nextNote = this.context.currentTime + 0.12;
        this.timer = window.setInterval(() => this.schedule(), 100);
        this.schedule();
      } else {
        this.enabled = false; clearInterval(this.timer);
        this.master.gain.cancelScheduledValues(this.context.currentTime);
        this.master.gain.setTargetAtTime(0, this.context.currentTime, 0.15);
      }
      return this.enabled;
    }
    chime() {
      if (!this.enabled || this.context.state !== 'running') return;
      [86, 90, 93].forEach((note, index) => this.bell(note, this.context.currentTime + index * 0.13, 0.075));
    }
    async visibilityChanged() {
      if (!this.enabled) return;
      if (document.hidden) await this.context.suspend();
      else { await this.context.resume(); this.nextNote = this.context.currentTime + 0.1; }
    }
    destroy() { clearInterval(this.timer); this.context.close().catch(() => {}); }
  }
  function updateSoundButton() {
    const enabled = !!audio?.enabled;
    const label = enabled ? '겨울 음악 끄기' : '겨울 음악 켜기';
    $('sound-button').setAttribute('aria-pressed', String(enabled));
    $('sound-button').setAttribute('aria-label', label);
    $('sound-button').title = label + ' (M)';
    $('sound-label').textContent = enabled ? 'SOUND ON' : 'SOUND OFF';
  }
  $('sound-button').addEventListener('click', async () => {
    if (soundPending) return;
    soundPending = true;
    try { audio ||= new WinterAudio(); await audio.toggle(); updateSoundButton(); }
    catch (error) { notify(error.message || '음악을 켜지 못했어요. 다시 눌러 주세요.'); }
    finally { soundPending = false; }
  });
  document.addEventListener('visibilitychange', () => audio?.visibilityChanged().catch(() => {
    if (audio) audio.enabled = false;
    updateSoundButton();
  }));

  function openDialog(id, trigger) {
    const dialog = $(id);
    dialog.returnFocus = trigger;
    dialog.showModal();
  }
  document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => $(button.dataset.close).close()));
  document.querySelectorAll('dialog').forEach(dialog => {
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const bounds = dialog.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
    });
    dialog.addEventListener('close', () => dialog.returnFocus?.focus({ preventScroll: true }));
  });
  try { savedWish = (localStorage.getItem(storageKey) || '').slice(0, 80); } catch { /* Storage is optional; the artwork remains fully usable. */ }
  $('letter-button').addEventListener('click', () => {
    clearWishEffect();
    scene?.love(); audio?.chime();
    root.classList.add('letter-active');
    openDialog('letter-dialog', $('letter-button'));
  });
  $('letter-dialog').addEventListener('close', () => {
    root.classList.remove('letter-active');
    scene?.endLove();
  });
  $('wish-button').addEventListener('click', () => {
    $('letter-dialog').close();
    $('wish-input').value = savedWish;
    $('wish-input').setCustomValidity('');
    $('wish-count').textContent = String(savedWish.length);
    $('forget-wish').hidden = !savedWish;
    openDialog('wish-dialog', $('letter-button'));
    $('wish-input').focus();
  });
  $('about-button').addEventListener('click', () => openDialog('about-dialog', $('about-button')));
  $('wish-input').addEventListener('input', () => {
    $('wish-count').textContent = String($('wish-input').value.length);
    $('wish-input').setCustomValidity('');
  });
  $('wish-form').addEventListener('submit', event => {
    event.preventDefault();
    const wish = $('wish-input').value.trim();
    if (!wish) { $('wish-input').setCustomValidity('작은 소원을 한 글자라도 적어 주세요.'); $('wish-input').reportValidity(); return; }
    savedWish = wish;
    let stored = true;
    try { localStorage.setItem(storageKey, wish); } catch { stored = false; }
    $('wish-dialog').close();
    clearWishEffect();
    $('wish-floating').querySelector('p').textContent = wish;
    root.classList.add('wish-active');
    scene?.wish(); audio?.chime();
    const delay = scene?.paused || motionPreference.matches ? 0 : 1800;
    wishTimers.push(setTimeout(() => $('wish-floating').classList.add('visible'), delay));
    wishTimers.push(setTimeout(() => $('wish-floating').classList.remove('visible'), 9800));
    wishTimers.push(setTimeout(() => root.classList.remove('wish-active'), 13300));
    announce('당신의 소원이 빛이 되었습니다. ' + wish);
    if (!stored) notify('소원을 빛으로 피웠어요. 브라우저 저장은 사용할 수 없어 이번 화면에서만 간직해요.', 6000);
  });
  $('forget-wish').addEventListener('click', () => {
    try { localStorage.removeItem(storageKey); }
    catch { notify('저장소에 접근할 수 없어 이전 소원을 지우지 못했어요. 브라우저의 사이트 데이터에서 삭제할 수 있어요.', 6000); return; }
    savedWish = ''; $('wish-input').value = ''; $('wish-count').textContent = '0'; $('forget-wish').hidden = true;
    clearWishEffect(); $('wish-floating').querySelector('p').textContent = '';
    $('wish-dialog').close(); notify('간직한 소원을 지웠어요.');
  });

  $('fullscreen-button').addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (root.requestFullscreen) await root.requestFullscreen();
      else { notify('이 브라우저에서는 전체 화면을 지원하지 않아요.'); }
    } catch { notify('전체 화면으로 바꾸지 못했어요. 브라우저 창을 넓혀 감상해 보세요.'); }
  });
  document.addEventListener('fullscreenchange', () => {
    const label = document.fullscreenElement ? '전체 화면 나가기' : '전체 화면';
    $('fullscreen-button').setAttribute('aria-label', label); $('fullscreen-button').title = label + ' (F)';
  });

  $('save-button').addEventListener('click', async () => {
    if (!scene?.ready || scene.lost) { notify('작품이 준비된 뒤 다시 저장해 주세요.'); return; }
    const button = $('save-button'); button.disabled = true;
    try {
      await document.fonts.ready;
      scene.draw();
      const postcard = document.createElement('canvas');
      postcard.width = canvas.width; postcard.height = canvas.height;
      const ctx = postcard.getContext('2d');
      ctx.drawImage(canvas, 0, 0);
      const ratio = canvas.width / scene.width;
      ctx.scale(ratio, ratio);
      const w = scene.width, h = scene.height;
      ctx.strokeStyle = 'rgba(215,188,131,.2)'; ctx.lineWidth = 0.7;
      ctx.strokeRect(22, 22, w - 44, h - 44);
      ctx.fillStyle = '#e7e4d5'; ctx.font = '500 29px "Winter Serif", Georgia, serif';
      ctx.fillText('NOËL', 42, 64);
      ctx.font = '10px sans-serif'; ctx.fillStyle = '#bba981'; ctx.textAlign = 'right';
      ctx.fillText('A LITTLE WINTER WONDER', w - 42, 58);
      ctx.textAlign = 'left';
      if (w > 760) {
        const x = w * 0.071, y = h * 0.36;
        const size = Math.min(87, w * 0.0525);
        ctx.font = `400 ${size}px "Winter Serif", Georgia, serif`; ctx.fillStyle = '#f0efe6';
        ctx.fillText('For you,', x, y); ctx.fillText('my dearest', x, y + size);
        ctx.font = `italic 400 ${size}px "Winter Serif", Georgia, serif`; ctx.fillStyle = '#d7bc83';
        ctx.fillText('Si-eun.', x, y + size * 2);
      }
      ctx.textAlign = 'center'; ctx.font = 'italic 20px "Winter Serif", Georgia, serif'; ctx.fillStyle = '#cfc5aa';
      ctx.fillText('Every little light holds a wish.', w / 2, h - 70);
      ctx.font = '8px sans-serif'; ctx.fillStyle = '#89947d';
      ctx.fillText('FOR SI-EUN, WITH ALL MY HEART.  ·  NOËL', w / 2, h - 43);
      const blob = await new Promise((resolve, reject) => postcard.toBlob(result => result ? resolve(result) : reject(new Error('이미지를 만들지 못했어요.')), 'image/png'));
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url; link.download = 'noel-a-little-winter-wonder.png';
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      notify('이 겨울을 PNG 이미지로 담았어요. 다운로드를 확인해 주세요.');
    } catch { notify('이미지를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.'); }
    finally { button.disabled = false; }
  });

  document.addEventListener('keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
    if (document.querySelector('dialog[open]') || event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
    const key = event.key.toLowerCase();
    if (key === ' ' && !event.target.closest('button, a')) { event.preventDefault(); $('pause-button').click(); }
    else if (key === 'r') $('replay-button').click();
    else if (key === 'b') $('burst-button').click();
    else if (key === 'm') $('sound-button').click();
    else if (key === 'f') $('fullscreen-button').click();
    else if (key === 'arrowleft') { event.preventDefault(); scene?.rotate(-0.22); }
    else if (key === 'arrowright') { event.preventDefault(); scene?.rotate(0.22); }
    else if (key === '+' || key === '=') { event.preventDefault(); scene?.adjustZoom(0.08); }
    else if (key === '-' || key === '_') { event.preventDefault(); scene?.adjustZoom(-0.08); }
  });
  window.addEventListener('pagehide', event => {
    if (event.persisted) return;
    scene?.destroy(); audio?.destroy(); wishTimers.forEach(clearTimeout); clearTimeout(toastTimer);
  });
  // Small read-only diagnostics for verifying real renderer and audio state.
  Object.defineProperty(window, 'noel', { value: Object.freeze({
    getState: () => ({ ...scene?.getState(), audio: audio ? { enabled: audio.enabled, state: audio.context.state } : { enabled: false, state: 'not-created' }, letterOpen: $('letter-dialog').open, wishOpen: $('wish-dialog').open, aboutOpen: $('about-dialog').open }),
  }), writable: false });
})();

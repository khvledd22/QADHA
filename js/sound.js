(function () {
  const Q = (window.Qadha = window.Qadha || {});
  let context = null;
  let musicTimer = null;

  function ctx() {
    if (!context) context = new (window.AudioContext || window.webkitAudioContext)();
    if (context.state === "suspended") context.resume();
    return context;
  }

  function tone(frequency, duration = 0.08, type = "sine", gain = 0.08) {
    const state = Q.app?.state;
    if (!state?.sound) return;
    const audio = ctx();
    const oscillator = audio.createOscillator();
    const volume = audio.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    volume.gain.setValueAtTime(gain * (state.volume ?? 0.45), audio.currentTime);
    volume.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
    oscillator.connect(volume).connect(audio.destination);
    oscillator.start();
    oscillator.stop(audio.currentTime + duration);
  }

  const sounds = {
    click() { tone(380, 0.05, "sine", 0.05); },
    move() { tone(220, 0.04, "triangle", 0.035); },
    collect() { tone(660, 0.08, "sine", 0.08); setTimeout(() => tone(880, 0.08, "sine", 0.06), 55); },
    match() { tone(520, 0.08, "triangle", 0.07); setTimeout(() => tone(710, 0.1, "triangle", 0.06), 65); },
    fail() { tone(180, 0.14, "sawtooth", 0.035); },
    success() { [523, 659, 784].forEach((note, index) => setTimeout(() => tone(note, 0.16, "sine", 0.08), index * 90)); },
    clue() { tone(440, 0.08, "triangle", 0.05); setTimeout(() => tone(587, 0.12, "triangle", 0.05), 70); },
  };

  function startMusic() {
    stopMusic();
    if (!Q.app?.state.music) return;
    const notes = [262, 330, 392, 330];
    let index = 0;
    musicTimer = setInterval(() => {
      if (!Q.app?.state.music) return stopMusic();
      tone(notes[index % notes.length], 0.55, "sine", 0.018);
      index += 1;
    }, 650);
  }

  function stopMusic() {
    clearInterval(musicTimer);
    musicTimer = null;
  }

  Q.sound = { ...sounds, startMusic, stopMusic };
})();

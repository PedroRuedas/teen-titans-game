// Arquivos de áudio próprios (opcional). Coloque os arquivos na pasta audio/ e escreva o caminho aqui,
// relativo ao index.html. Deixe '' para usar o som gerado pelo próprio jogo.
// Formatos: .mp3, .ogg ou .wav. Arquivo que não for encontrado volta automaticamente para o som sintetizado.
window.TT_AUDIO_FILES = {
  // Abertura de Teen Titans (toca no título e nas fases). Ex.: 'audio/tema.mp3'
  tema: '',

  // Outras trilhas por nome: boss, overload, plasmus, victory. Ex.: boss: 'audio/chefe.mp3'
  musica: {},

  // Falas dos Titãs: 'titã:texto exato da fala' -> arquivo. 'titã:*' vale para todas as falas daquele Titã.
  // Titãs: robin, starfire, cyborg, raven, beastboy.
  vozes: {
    // 'raven:Azarath Metrion Zinthos!': 'audio/vozes/azarath.mp3',
    // 'cyborg:BOOYAH!': 'audio/vozes/booyah.mp3',
    // 'robin:Titãs, AVANTE!': 'audio/vozes/titas-ao-ataque.mp3',
    // 'starfire:Raios oculares!': 'audio/vozes/estelar.mp3',
    // 'beastboy:Rinoceronte!': 'audio/vozes/mutano.mp3',
  },
};

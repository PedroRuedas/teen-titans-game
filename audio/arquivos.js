// Arquivos de áudio próprios (opcional). Coloque os arquivos na pasta audio/ e escreva o caminho aqui,
// relativo ao index.html. Deixe '' para usar o som gerado pelo próprio jogo.
// Formatos: .mp3, .ogg ou .wav. Arquivo que não for encontrado volta automaticamente para o som sintetizado.
window.TT_AUDIO_FILES = {
  // Abertura de Teen Titans (toca no título e nas fases). Ex.: 'audio/tema.mp3'
  tema: '',

  // Outras trilhas por nome: boss, overload, plasmus, blood, victory. Ex.: boss: 'audio/chefe.mp3'
  musica: {},

  // Falas: 'titã:texto exato da fala' -> arquivo. 'titã:*' vale para todas as falas daquele Titã.
  // Por enquanto só a Ravena fala (lista TT.VOICED em js/audio.js).
  vozes: {
    'raven:Azarath Metrion Zinthos!': 'audio/vozes/ravena-azarath.mp3',
  },
};

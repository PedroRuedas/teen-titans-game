'use strict';
// Definição das fases. camX = posição da câmera em que a arena trava.
(function () {
  const TT = window.TT;
  TT.STAGES = [
    {
      id: 1,
      name: 'FASE 1 — TORRE TITÃ',
      subtitle: 'A H.I.V.E. invadiu a Torre dos Titãs!',
      length: 6600,
      song: 'theme',
      crates: [[1150, 560, 'pizza'], [2050, 640, 'energy'], [3350, 600, 'pizza'], [4300, 540, 'energy'], [4800, 640, 'pizza']],
      sections: [
        { type: 'arena', camX: 380, waves: [['hive', 'hive', 'hive'], ['hive', 'slade', 'hive']] },
        { type: 'arena', camX: 1450, waves: [['slade', 'hive', 'drone'], ['hive', 'hive', 'slade', 'drone']] },
        { type: 'arena', camX: 2850, waves: [['hive', 'hive', 'hive', 'hive'], ['slade', 'slade', 'drone']] },
        { type: 'arena', camX: 3950, waves: [['drone', 'drone', 'hive', 'slade'], ['slade', 'slade', 'hive', 'hive']] },
        { type: 'boss', camX: 5300, boss: 'cinderblock', intro: 'O brutamontes de pedra' },
      ],
    },
    {
      id: 2,
      name: 'FASE 2 — PERFURATRIZ DO TERROR',
      subtitle: 'Gizmo está perfurando os túneis sob Jump City!',
      length: 8000,
      song: 'theme',
      crates: [[1100, 600, 'pizza'], [2300, 540, 'energy'], [5300, 600, 'pizza'], [6300, 560, 'energy']],
      sections: [
        { type: 'arena', camX: 380, waves: [['hive', 'drone', 'hive'], ['slade', 'hive', 'drone']] },
        { type: 'arena', camX: 1450, waves: [['slade', 'slade', 'hive'], ['drone', 'drone', 'slade', 'hive']] },
        { type: 'chase', start: 2700, end: 4950, speed: 2.4, every: 140, pool: ['hive', 'hive', 'drone', 'slade'] },
        { type: 'arena', camX: 5350, waves: [['slade', 'slade', 'drone', 'hive'], ['hive', 'hive', 'hive', 'slade', 'drone']] },
        { type: 'boss', camX: 6650, boss: 'gizmo', intro: 'O gênio do mal da H.I.V.E.' },
      ],
    },
    {
      id: 3,
      name: 'FASE 3 — USINA DE ENERGIA',
      subtitle: 'Overload está sugando a energia de Jump City!',
      length: 7400,
      song: 'theme',
      bossSong: 'overload',
      crates: [[1200, 600, 'pizza'], [2400, 650, 'energy'], [3700, 560, 'pizza'], [5000, 620, 'energy'], [5500, 560, 'pizza']],
      sections: [
        { type: 'arena', camX: 380, waves: [['hive', 'shock', 'hive'], ['shock', 'slade', 'drone']] },
        { type: 'arena', camX: 1500, waves: [['shock', 'shock', 'hive'], ['drone', 'drone', 'slade', 'shock']] },
        { type: 'arena', camX: 2950, waves: [['slade', 'shock', 'hive', 'hive'], ['shock', 'shock', 'drone', 'slade']] },
        { type: 'arena', camX: 4300, waves: [['shock', 'slade', 'slade', 'drone'], ['hive', 'hive', 'shock', 'shock', 'drone']] },
        { type: 'boss', camX: 6000, boss: 'overload', intro: 'A criatura elétrica' },
      ],
    },
    {
      id: 4,
      name: 'FASE 4 — FÁBRICA QUÍMICA',
      subtitle: 'Plasmus escapou do tanque de contenção!',
      length: 7400,
      song: 'theme',
      bossSong: 'plasmus',
      crates: [[1150, 620, 'pizza'], [2350, 560, 'energy'], [3650, 640, 'pizza'], [4950, 560, 'energy'], [5500, 620, 'pizza']],
      sections: [
        { type: 'arena', camX: 380, waves: [['hive', 'hive', 'slade'], ['shock', 'hive', 'drone']] },
        { type: 'arena', camX: 1500, waves: [['slade', 'shock', 'hive'], ['drone', 'drone', 'slade', 'hive']] },
        { type: 'arena', camX: 2950, waves: [['shock', 'slade', 'hive', 'hive'], ['slade', 'slade', 'drone', 'shock']] },
        { type: 'arena', camX: 4300, waves: [['slade', 'slade', 'shock', 'drone'], ['hive', 'hive', 'slade', 'shock', 'drone']] },
        { type: 'boss', camX: 6000, boss: 'plasmus', intro: 'O monstro de lodo' },
      ],
    },
  ];
})();

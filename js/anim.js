'use strict';
// Poses e animações: quadros-chave, locomoção própria de cada Titã (correr, pular, esquivar) e golpes.
// Ângulos dos membros: 0 = para baixo, +PI/2 = para a frente, PI = para cima, -PI/2 = para trás.
// Cada membro tem [segmento de cima, segmento de baixo] (coxa/canela, braço/antebraço).
(function () {
  const TT = window.TT;
  const PI = Math.PI, TAU = PI * 2;

  const BASE = {
    lean: 0.05, bob: 0, tilt: 0, rot: 0, spin: 0, squash: 0, staff: 0, staffLen: 1,
    auraF: 0, auraB: 0, circleF: 0, circleB: 0, piston: 0,
    legB: [-0.2, -0.3], legF: [0.25, 0.05], armB: [0.35, 1.9], armF: [0.55, 2.25],
  };
  const NUM_KEYS = ['lean', 'bob', 'tilt', 'rot', 'spin', 'squash', 'staff', 'staffLen', 'auraF', 'auraB', 'circleF', 'circleB', 'piston'];
  const ARR_KEYS = ['legB', 'legF', 'armB', 'armF'];

  function newPose() {
    const p = { mouth: null, weapon: null, glow: null, form: null, cape: 0, eyes: null, handF: null, handB: null };
    for (const k of NUM_KEYS) p[k] = BASE[k];
    for (const k of ARR_KEYS) p[k] = [BASE[k][0], BASE[k][1]];
    return p;
  }
  TT.newPose = newPose;

  function setPose(dst, src) {
    for (const k of NUM_KEYS) dst[k] = src[k] != null ? src[k] : BASE[k];
    for (const k of ARR_KEYS) {
      const s = src[k] || BASE[k];
      dst[k][0] = s[0]; dst[k][1] = s[1];
    }
    return dst;
  }
  function blendPose(dst, a, b, t) {
    for (const k of NUM_KEYS) {
      const va = a[k] != null ? a[k] : BASE[k], vb = b[k] != null ? b[k] : BASE[k];
      dst[k] = va + (vb - va) * t;
    }
    for (const k of ARR_KEYS) {
      const sa = a[k] || BASE[k], sb = b[k] || BASE[k];
      dst[k][0] = sa[0] + (sb[0] - sa[0]) * t;
      dst[k][1] = sa[1] + (sb[1] - sa[1]) * t;
    }
    return dst;
  }
  TT.setPose = setPose; TT.blendPose = blendPose;

  const EASE = { lin: (t) => t, out: TT.easeOut, in: (t) => t * t, io: TT.easeInOut };
  // Avalia uma trilha de quadros-chave [[quadro, pose, easing?], ...] no quadro t.
  function evalKeys(out, keys, t) {
    if (t <= keys[0][0]) return setPose(out, keys[0][1]);
    for (let i = 0; i < keys.length - 1; i++) {
      const k0 = keys[i], k1 = keys[i + 1];
      if (t < k1[0]) return blendPose(out, k0[1], k1[1], (EASE[k0[2]] || EASE.io)((t - k0[0]) / (k1[0] - k0[0])));
    }
    return setPose(out, keys[keys.length - 1][1]);
  }
  TT.evalKeys = evalKeys;
  const M = (...objs) => Object.assign({}, ...objs); // mescla poses parciais

  // ---------------------------------------------------------------- Poses genéricas (inimigos e chefes)
  const ATK = {
    jab: { w: { lean: -0.05, armF: [0.2, 2.6] }, h: { lean: 0.22, armF: [1.55, 1.57], armB: [0.1, 1.5], legF: [0.5, 0.25], legB: [-0.5, -0.6] } },
    cross: { w: { lean: -0.1, armB: [0.1, 2.4] }, h: { lean: 0.32, armB: [1.6, 1.6], armF: [0.2, 2.5], legF: [0.55, 0.3], legB: [-0.5, -0.7] } },
    uppercut: { w: { bob: 6, armF: [0.1, 0.5], lean: 0.1 }, h: { bob: -6, lean: -0.05, armF: [2.7, 3.0], legF: [0.35, 0.05], legB: [-0.4, -0.6] } },
    kick: { w: { legF: [1.0, 0.0], lean: -0.15 }, h: { legF: [1.6, 1.6], lean: -0.3, armF: [-0.4, 0.3], armB: [0.8, 1.7] } },
    flyKick: { w: { legF: [0.9, -0.3], legB: [0.2, -0.6], lean: -0.1 }, h: { lean: -0.15, legF: [1.65, 1.65], legB: [-0.4, -1.0], armF: [-0.9, -0.5], armB: [-1.1, -0.7] } },
    dive: { w: { legF: [1.0, 0.2] }, h: { lean: 0.3, legF: [0.75, 0.75], legB: [-0.2, -0.9], armF: [2.5, 2.8], armB: [-2.4, -2.7] } },
    swing: { w: { armF: [-2.6, -2.9], armB: [-2.4, -2.6], lean: -0.25, bob: -2 }, h: { armF: [1.0, 1.35], armB: [0.9, 1.25], lean: 0.32, bob: 4, legF: [0.6, 0.3], legB: [-0.5, -0.8] } },
    swipe: { w: { armF: [-1.3, -1.1], lean: -0.15 }, h: { armF: [1.65, 1.7], armB: [0.5, 1.2], lean: 0.25, legF: [0.5, 0.3], legB: [-0.45, -0.6] } },
    cast: { w: { armF: [0.2, 2.4], armB: [0.2, 2.2], lean: -0.12 }, h: { armF: [1.55, 1.6], armB: [1.4, 1.5], lean: 0.15, legF: [0.45, 0.25], legB: [-0.45, -0.55] } },
    castUp: { w: { armF: [0.3, 0.6], armB: [0.2, 0.5], bob: 4 }, h: { armF: [2.9, 3.1], armB: [2.8, 3.0], bob: -3, lean: -0.05 } },
    slam: { w: { armF: [2.9, 3.1], armB: [2.8, 3.0], bob: -4, lean: -0.2 }, h: { armF: [0.9, 0.6], armB: [0.8, 0.5], bob: 8, lean: 0.45, legF: [0.7, 0.2], legB: [-0.6, -0.9] } },
    throw: { w: { armF: [-2.2, -2.6], lean: -0.2 }, h: { armF: [1.45, 1.55], lean: 0.28, legF: [0.5, 0.3], legB: [-0.45, -0.6] } },
    beam: { w: { armF: [0.8, 1.2], lean: -0.05 }, h: { armF: [1.57, 1.57], armB: [1.1, 1.6], lean: -0.12, legF: [0.55, 0.35], legB: [-0.55, -0.7] } },
    claw: { w: { armF: [-1.6, -1.2], armB: [-1.4, -1.0], lean: -0.2 }, h: { armF: [1.9, 2.1], armB: [1.7, 1.9], lean: 0.3, legF: [0.5, 0.3], legB: [-0.5, -0.6] } },
    spin: { w: { armF: [1.5, 1.5], armB: [-1.5, -1.5] }, h: { armF: [1.5, 1.5], armB: [-1.5, -1.5], lean: 0.1 } },
    // Poses exageradas dos chefes (preparação bem visível)
    bigSwing: { w: { armF: [-2.9, -3.2], armB: [-2.6, -3.0], lean: -0.5, bob: 6, tilt: -0.25, legF: [0.5, 0.2], legB: [-0.5, -0.7] }, h: { armF: [1.25, 1.5], armB: [1.0, 1.4], lean: 0.5, bob: 6, legF: [0.7, 0.3], legB: [-0.6, -0.9] } },
    bigSlam: { w: { armF: [3.0, 3.1], armB: [2.9, 3.0], bob: 10, lean: -0.3, legF: [0.6, -0.4], legB: [-0.5, -1.0] }, h: { armF: [0.9, 0.5], armB: [0.8, 0.4], bob: 12, lean: 0.55, legF: [0.8, 0.2], legB: [-0.7, -1.0] } },
    bigCharge: { w: { lean: -0.35, bob: 8, armF: [-0.9, -0.2], armB: [-1.1, -0.4], legF: [0.7, -0.2], legB: [-0.6, -1.1] }, h: { lean: 0.7, bob: 4, armF: [1.2, 1.4], armB: [-1.2, -0.8], legF: [0.9, 0.3], legB: [-0.8, -1.2] } },
    bigThrow: { w: { armF: [-2.7, -3.0], armB: [-2.5, -2.9], lean: -0.4, bob: 4, tilt: -0.2 }, h: { armF: [1.5, 1.6], armB: [1.2, 1.4], lean: 0.4, legF: [0.6, 0.3], legB: [-0.5, -0.7] } },
  };
  TT.ATK_POSES = ATK;

  // ---------------------------------------------------------------- Bases de pose de cada Titã
  const STANCE = { lean: 0.08, legF: [0.38, 0.12], legB: [-0.32, -0.45], armF: [0.75, 2.55], armB: [0.55, 2.45] }; // guarda de luta
  const RV = { bob: -14, lean: 0.02, legF: [0.12, -0.12], legB: [0.02, -0.28], armF: [0.2, 0.45], armB: [0.12, 0.35] }; // Ravena flutuando
  const SF = { bob: -12, lean: 0.06, legF: [0.2, 0.05], legB: [-0.15, -0.95], armF: [0.45, 1.2], armB: [0.3, 1.0] };  // Estelar pairando
  const CY = { lean: 0.1, legF: [0.42, 0.15], legB: [-0.38, -0.5], armF: [0.6, 2.0], armB: [0.45, 1.9] };          // Ciborgue firme
  const BBS = { lean: 0.16, bob: 3, legF: [0.45, 0.05], legB: [-0.4, -0.7], armF: [0.6, 1.9], armB: [0.4, 1.7] };     // Mutano agachadinho

  // ---------------------------------------------------------------- Golpes dos Titãs (quadros-chave)
  // Convenção: o quadro do impacto é o "s" do golpe definido em entities.js.
  const ANIMS = {
    // ===== Robin: bastão e acrobacias
    robinJab: [
      [0, M(STANCE, { staffLen: 0.3 })],
      [3, { lean: -0.06, armF: [-0.35, 0.95], armB: [0.6, 2.1], legF: [0.35, 0.15], legB: [-0.35, -0.45], staffLen: 0.2 }, 'out'],
      [4, { lean: 0.28, armF: [1.45, 1.57], armB: [0.15, 1.3], legF: [0.62, 0.3], legB: [-0.58, -0.72], staffLen: 1 }],
      [9, { lean: 0.26, armF: [1.42, 1.55], armB: [0.15, 1.3], legF: [0.6, 0.3], legB: [-0.56, -0.7], staffLen: 1 }],
      [15, M(STANCE, { staffLen: 0.6 })],
    ],
    robinSwing: [ // golpe lateral com o bastão (de trás do ombro para a frente)
      [0, M(STANCE, { staffLen: 0.7 })],
      [4, { lean: -0.18, bob: 1, armF: [-1.7, -1.1], armB: [0.5, 1.6], legF: [0.42, 0.12], legB: [-0.38, -0.5], staffLen: 1 }, 'out'],
      [5, { lean: 0.3, armF: [1.35, 1.75], armB: [0.7, 1.4], legF: [0.62, 0.28], legB: [-0.55, -0.72], staffLen: 1 }],
      [10, { lean: 0.28, armF: [1.3, 1.85], armB: [0.7, 1.4], legF: [0.6, 0.28], legB: [-0.54, -0.7], staffLen: 1 }],
      [18, M(STANCE, { staffLen: 0.8 })],
    ],
    robinSlam: [ // passo à frente e bastão de cima para baixo
      [0, M(STANCE, { staffLen: 0.8 })],
      [6, { lean: -0.22, bob: -2, armF: [2.95, 3.1], armB: [2.75, 2.95], legF: [0.3, 0.05], legB: [-0.32, -0.45], staffLen: 1 }, 'out'],
      [9, { lean: 0.45, bob: 4, armF: [1.15, 1.0], armB: [1.0, 0.9], legF: [0.78, 0.25], legB: [-0.66, -0.95], staffLen: 1, squash: 0.05 }],
      [15, { lean: 0.42, bob: 4, armF: [1.12, 1.0], armB: [1.0, 0.9], legF: [0.76, 0.25], legB: [-0.64, -0.92], staffLen: 1 }],
      [27, M(STANCE, { staffLen: 1 })],
    ],
    robinKick: [ // chute lateral forte
      [0, STANCE],
      [5, { lean: -0.2, legF: [1.25, -0.6], legB: [-0.15, -0.3], armF: [0.6, 2.4], armB: [0.2, 2.0] }, 'out'],
      [7, { lean: -0.38, legF: [1.66, 1.6], legB: [-0.1, -0.25], armF: [-0.4, 0.5], armB: [0.9, 1.9] }],
      [13, { lean: -0.36, legF: [1.62, 1.56], legB: [-0.1, -0.25], armF: [-0.4, 0.5], armB: [0.9, 1.9] }],
      [24, STANCE],
    ],
    robinAir: [
      [0, { legF: [0.9, -0.2], legB: [0.3, -0.7], armF: [2.4, 2.7], armB: [-0.6, 0.2] }],
      [3, { lean: 0.38, legF: [0.8, 0.8], legB: [-0.2, -0.95], armF: [2.5, 2.8], armB: [-2.4, -2.7] }],
      [23, { lean: 0.38, legF: [0.8, 0.8], legB: [-0.2, -0.95], armF: [2.5, 2.8], armB: [-2.4, -2.7] }],
    ],
    robinDashKick: [ // voadora reta
      [0, { lean: 0.4, legF: [1.0, 0.3], legB: [-0.6, -1.2] }],
      [3, { bob: -8, lean: -0.15, legF: [1.65, 1.65], legB: [-0.4, -1.0], armF: [-0.9, -0.5], armB: [-1.1, -0.7] }],
      [15, { bob: -8, lean: -0.15, legF: [1.65, 1.65], legB: [-0.4, -1.0], armF: [-0.9, -0.5], armB: [-1.1, -0.7] }],
      [27, STANCE],
    ],
    robinThrow: [ // arremesso de três birdarangues
      [0, STANCE],
      [8, { lean: -0.25, armF: [-2.2, -2.6], armB: [0.8, 1.7], legF: [0.42, 0.15], legB: [-0.4, -0.55] }, 'out'],
      [14, { lean: 0.3, armF: [1.45, 1.55], armB: [-0.4, 0.2], legF: [0.55, 0.3], legB: [-0.5, -0.65] }],
      [29, STANCE],
    ],

    // ===== Mutano
    bbJab: [
      [0, BBS],
      [3, { lean: -0.08, bob: 3, armF: [0.1, 2.7], legF: [0.45, 0.05], legB: [-0.4, -0.7] }, 'out'],
      [4, { lean: 0.3, armF: [1.55, 1.57], armB: [0.1, 1.5], legF: [0.58, 0.25], legB: [-0.52, -0.66] }],
      [8, { lean: 0.3, armF: [1.52, 1.55], armB: [0.1, 1.5], legF: [0.58, 0.25], legB: [-0.52, -0.66] }],
      [14, BBS],
    ],
    bbKick: [ // chute giratório
      [0, BBS],
      [4, { lean: -0.2, spin: -0.35, legF: [1.0, 0.0], armF: [0.3, 1.2], armB: [-0.4, 0.4] }, 'out'],
      [5, { lean: -0.38, spin: -0.12, legF: [1.68, 1.62], legB: [-0.1, -0.3], armF: [-0.5, 0.3], armB: [0.9, 1.7] }],
      [10, { lean: -0.34, spin: -0.1, legF: [1.6, 1.55], legB: [-0.1, -0.3], armF: [-0.5, 0.3], armB: [0.9, 1.7] }],
      [18, BBS],
    ],
    bbClaw: [
      [0, BBS],
      [6, { lean: -0.2, armF: [-1.6, -1.2], armB: [-1.4, -1.0] }, 'out'],
      [7, { lean: 0.32, armF: [1.9, 2.1], armB: [1.7, 1.9], legF: [0.55, 0.3], legB: [-0.5, -0.62] }],
      [26, BBS],
    ],

    // ===== Ciborgue: punhos hidráulicos e canhão
    cyPiston: [
      [0, CY],
      [4, { lean: -0.08, armF: [-0.35, 1.0], armB: [0.5, 2.2], legF: [0.42, 0.15], legB: [-0.38, -0.5] }, 'out'],
      [5, { lean: 0.26, armF: [1.5, 1.57], armB: [0.2, 1.5], legF: [0.58, 0.25], legB: [-0.52, -0.72], piston: 1 }],
      [10, { lean: 0.24, armF: [1.5, 1.57], armB: [0.2, 1.5], legF: [0.56, 0.25], legB: [-0.5, -0.7], piston: 1 }],
      [13, { lean: 0.15, armF: [1.2, 1.9], armB: [0.3, 1.7], piston: 0 }],
      [18, CY],
    ],
    cyHook: [ // gancho giratório
      [0, CY],
      [5, { lean: -0.25, spin: -0.12, armF: [-1.3, -0.6], armB: [0.9, 2.2], legF: [0.42, 0.12], legB: [-0.4, -0.55] }, 'out'],
      [6, { lean: 0.36, spin: 0.05, armF: [1.42, 2.5], armB: [-0.2, 1.0], legF: [0.62, 0.3], legB: [-0.56, -0.72] }],
      [11, { lean: 0.34, spin: 0.05, armF: [1.4, 2.45], armB: [-0.2, 1.0], legF: [0.6, 0.3], legB: [-0.55, -0.7] }],
      [22, CY],
    ],
    cyBlast: [ // braço vira canhão: rajada sônica à queima-roupa
      [0, CY],
      [8, { lean: 0.05, armF: [1.4, 1.5], armB: [0.9, 1.6], legF: [0.58, 0.3], legB: [-0.5, -0.72] }],
      [11, { lean: -0.24, bob: 2, armF: [1.57, 1.57], armB: [0.9, 1.6], legF: [0.62, 0.3], legB: [-0.55, -0.78] }, 'out'],
      [16, { lean: -0.2, armF: [1.55, 1.57], armB: [0.9, 1.6], legF: [0.6, 0.3], legB: [-0.55, -0.76] }],
      [31, CY],
    ],
    cySlam: [ // martelo duplo no chão
      [0, CY],
      [8, { bob: -10, lean: -0.25, armF: [3.0, 3.1], armB: [2.9, 3.0], legF: [0.4, 0.1], legB: [-0.3, -0.5] }],
      [13, { bob: -16, lean: -0.3, armF: [3.05, 3.15], armB: [2.95, 3.05], legF: [0.35, 0.0], legB: [-0.3, -0.6] }],
      [15, { bob: 10, lean: 0.5, squash: 0.12, armF: [1.0, 0.7], armB: [0.9, 0.6], legF: [0.8, 0.3], legB: [-0.7, -1.0] }, 'out'],
      [20, { bob: 9, lean: 0.48, squash: 0.08, armF: [1.0, 0.7], armB: [0.9, 0.6], legF: [0.8, 0.3], legB: [-0.7, -1.0] }],
      [33, CY],
    ],
    cyAir: [
      [0, { legF: [1.3, -0.2], legB: [1.1, -0.4], armF: [2.8, 3.0], armB: [2.7, 2.9] }],
      [4, { lean: 0.4, legF: [0.4, 0.2], legB: [-0.2, -0.4], armF: [1.0, 0.7], armB: [0.9, 0.6] }],
      [24, { lean: 0.4, legF: [0.4, 0.2], legB: [-0.2, -0.4], armF: [1.0, 0.7], armB: [0.9, 0.6] }],
    ],
    cyTackle: [ // ombrada com propulsores
      [0, { lean: 0.4, legF: [0.8, 0.4], legB: [-0.7, -1.3] }],
      [4, { bob: 4, lean: 0.6, armF: [0.4, 1.9], armB: [-0.5, 0.4], legF: [0.85, 0.3], legB: [-0.85, -1.25] }],
      [16, { bob: 4, lean: 0.58, armF: [0.4, 1.9], armB: [-0.5, 0.4], legF: [0.85, 0.3], legB: [-0.85, -1.25] }],
      [30, CY],
    ],
    cyCannon: [ // especial: canhão sônico
      [0, CY],
      [14, { lean: -0.05, armF: [1.5, 1.55], armB: [1.0, 1.6], legF: [0.6, 0.35], legB: [-0.6, -0.75] }],
      [20, { lean: -0.14, armF: [1.57, 1.57], armB: [1.1, 1.6], legF: [0.62, 0.35], legB: [-0.62, -0.78] }],
      [52, { lean: -0.16, bob: 1, armF: [1.57, 1.57], armB: [1.1, 1.6], legF: [0.62, 0.35], legB: [-0.62, -0.78] }],
      [68, CY],
    ],

    // ===== Ravena: mãos de energia negra com círculos mágicos
    rvPalm: [
      [0, RV],
      [4, M(RV, { lean: -0.06, armF: [0.1, 1.0], auraF: 0.7 }), 'out'],
      [5, M(RV, { lean: 0.14, armF: [1.5, 1.57], armB: [0.15, 0.6], auraF: 1, circleF: 0.75 })],
      [10, M(RV, { lean: 0.12, armF: [1.48, 1.55], armB: [0.15, 0.6], auraF: 1, circleF: 0.95 })],
      [18, M(RV, { auraF: 0, circleF: 0 })],
    ],
    rvSweep: [
      [0, RV],
      [5, M(RV, { lean: -0.12, armB: [-1.1, -0.6], armF: [0.6, 1.2], auraB: 0.8, auraF: 0.3 }), 'out'],
      [6, M(RV, { lean: 0.2, armB: [1.5, 1.6], armF: [-0.4, 0.3], auraB: 1, circleB: 0.85 })],
      [11, M(RV, { lean: 0.18, armB: [1.45, 1.55], armF: [-0.4, 0.3], auraB: 1, circleB: 1 })],
      [20, M(RV, { auraB: 0, circleB: 0 })],
    ],
    rvPortal: [ // as duas mãos abrem um portal e a garra sai dele
      [0, RV],
      [6, M(RV, { lean: -0.12, armF: [0.4, 0.9], armB: [0.3, 0.8], auraF: 0.8, auraB: 0.8, bob: -20 })],
      [10, M(RV, { lean: 0.16, armF: [1.52, 1.57], armB: [1.38, 1.5], auraF: 1, auraB: 1, circleF: 1.5, bob: -18 }), 'out'],
      [16, M(RV, { lean: 0.14, armF: [1.5, 1.57], armB: [1.36, 1.5], auraF: 1, auraB: 1, circleF: 1.6, bob: -18 })],
      [30, M(RV, { auraF: 0, auraB: 0, circleF: 0 })],
    ],
    rvHeavy: [ // lança um corvo de energia
      [0, RV],
      [8, M(RV, { lean: -0.15, armF: [2.9, 3.0], armB: [2.8, 2.95], auraF: 1, auraB: 1, bob: -22 })],
      [11, M(RV, { lean: 0.2, armF: [1.5, 1.57], armB: [1.4, 1.5], auraF: 1, auraB: 1, circleF: 1.2, bob: -16 }), 'out'],
      [18, M(RV, { lean: 0.18, armF: [1.48, 1.55], armB: [1.38, 1.5], auraF: 0.8, auraB: 0.8, circleF: 1.3 })],
      [30, M(RV, { auraF: 0, auraB: 0, circleF: 0 })],
    ],
    rvAir: [
      [0, M(RV, { legF: [1.3, -0.9], legB: [1.2, -1.0] })],
      [4, M(RV, { lean: 0.3, armF: [0.9, 0.7], auraF: 1, circleF: 0.9, legF: [1.3, -0.9], legB: [1.2, -1.0] })],
      [22, M(RV, { lean: 0.3, armF: [0.9, 0.7], auraF: 0.6, circleF: 0.4, legF: [1.3, -0.9], legB: [1.2, -1.0] })],
    ],
    rvDash: [
      [0, M(RV, { lean: 0.4 })],
      [3, M(RV, { lean: 0.35, armF: [1.65, 1.7], armB: [0.5, 1.2], auraF: 1, circleF: 0.6 })],
      [25, M(RV, { auraF: 0, circleF: 0 })],
    ],
    rvSpecial: [
      [0, RV],
      [12, M(RV, { bob: -30, armF: [2.6, 2.4], armB: [2.5, 2.3], auraF: 1, auraB: 1, circleF: 0.8, circleB: 0.8 })],
      [20, M(RV, { bob: -36, armF: [2.95, 3.1], armB: [2.85, 3.0], auraF: 1, auraB: 1, circleF: 1.4, circleB: 1.4 }), 'out'],
      [46, M(RV, { auraF: 0, auraB: 0 })],
    ],

    // ===== Estelar: punhos de energia verde
    sfPunch: [
      [0, SF],
      [3, M(SF, { lean: -0.05, armF: [0.2, 2.6], auraF: 0.7 }), 'out'],
      [4, M(SF, { lean: 0.3, armF: [1.55, 1.57], armB: [0.1, 1.4], auraF: 1, circleF: 0.45 })],
      [9, M(SF, { lean: 0.28, armF: [1.52, 1.55], armB: [0.1, 1.4], auraF: 1, circleF: 0.6 })],
      [15, M(SF, { auraF: 0, circleF: 0 })],
    ],
    sfCross: [
      [0, SF],
      [3, M(SF, { lean: -0.1, armB: [0.1, 2.4], auraB: 0.7 }), 'out'],
      [4, M(SF, { lean: 0.34, armB: [1.6, 1.6], armF: [0.2, 2.5], auraB: 1, circleB: 0.45 })],
      [9, M(SF, { lean: 0.32, armB: [1.58, 1.6], armF: [0.2, 2.5], auraB: 1, circleB: 0.6 })],
      [16, M(SF, { auraB: 0, circleB: 0 })],
    ],
    sfBolt: [ // palmas abertas: starbolt à queima-roupa
      [0, SF],
      [6, M(SF, { lean: -0.12, armF: [0.3, 1.2], armB: [0.2, 1.1], auraF: 1, auraB: 1, bob: -18 })],
      [8, M(SF, { lean: 0.2, armF: [1.55, 1.6], armB: [1.4, 1.5], auraF: 1, auraB: 1, circleF: 1.1 }), 'out'],
      [13, M(SF, { lean: 0.16, armF: [1.52, 1.58], armB: [1.38, 1.5], auraF: 0.8, auraB: 0.8, circleF: 1.2 })],
      [22, M(SF, { auraF: 0, auraB: 0, circleF: 0 })],
    ],
    sfCharge: [ // starbolt carregado com as duas mãos juntas
      [0, SF],
      [12, M(SF, { lean: -0.15, bob: -16, armF: [1.2, 1.9], armB: [1.1, 1.9], auraF: 1, auraB: 1, circleF: 0.9 })],
      [15, M(SF, { lean: 0.25, armF: [1.57, 1.57], armB: [1.45, 1.52], auraF: 1, auraB: 1, circleF: 1.5 }), 'out'],
      [20, M(SF, { lean: 0.22, armF: [1.55, 1.57], armB: [1.42, 1.5], auraF: 0.7, auraB: 0.7, circleF: 1.2 })],
      [32, M(SF, { auraF: 0, auraB: 0, circleF: 0 })],
    ],
    sfAir: [
      [0, M(SF, { bob: 0 })],
      [5, M(SF, { bob: 0, lean: 0.35, armF: [1.0, 0.9], armB: [0.9, 0.8], auraF: 1, auraB: 1, circleF: 0.9 })],
      [18, M(SF, { bob: 0, auraF: 0, auraB: 0, circleF: 0 })],
    ],
    sfDash: [ // soco voando
      [0, M(SF, { lean: 0.9, bob: -18 })],
      [3, M(SF, { lean: 0.85, bob: -18, armF: [1.62, 1.6], armB: [-0.6, -0.3], legF: [-0.7, -0.75], legB: [-0.9, -1.0], auraF: 1, circleF: 0.6 })],
      [15, M(SF, { lean: 0.8, bob: -18, armF: [1.6, 1.58], armB: [-0.6, -0.3], legF: [-0.7, -0.75], legB: [-0.9, -1.0], auraF: 1, circleF: 0.7 })],
      [27, M(SF, { auraF: 0, circleF: 0 })],
    ],
    sfEyes: [
      [0, SF],
      [14, M(SF, { lean: -0.1, bob: -16, armF: [0.9, 1.5], armB: [0.8, 1.4], auraF: 0.6, auraB: 0.6 })],
      [56, M(SF, { lean: -0.12, bob: -18, armF: [0.95, 1.5], armB: [0.85, 1.4], auraF: 0.6, auraB: 0.6 })],
      [70, SF],
    ],
  };
  TT.ANIMS = ANIMS;

  // ---------------------------------------------------------------- Locomoção
  // Ciclo de corrida parametrizado. o: rate, stride, knee, arm, elbow, lean, bounce, lift.
  function runCycle(out, t, o) {
    const ph = t * o.rate, s = Math.sin(ph), c = Math.cos(ph);
    setPose(out, BASE);
    out.lean = o.lean; out.bob = -Math.abs(c) * o.bounce + (o.lift || 0);
    const st = o.stride, kn = o.knee;
    out.legF[0] = s * st; out.legF[1] = s * st - 0.2 - Math.max(0, -c) * kn;
    out.legB[0] = -s * st; out.legB[1] = -s * st - 0.2 - Math.max(0, c) * kn;
    out.armF[0] = -s * o.arm; out.armF[1] = -s * o.arm + o.elbow;
    out.armB[0] = s * o.arm; out.armB[1] = s * o.arm + o.elbow;
    out.cape = 0.8;
    return out;
  }
  // Fase do pulo: 0 no início, 1 no fim (estimado pela velocidade vertical).
  const jumpK = (f) => TT.clamp((f.jumpT != null ? f.jumpT : f.animT) / 34, 0, 1);

  const MOVES = {
    robin: {
      idle(out, f, t) { setPose(out, STANCE); out.bob = Math.sin(t * 0.08) * 1.2; out.armF[1] += Math.sin(t * 0.08) * 0.05; },
      walk(out, f, t) { runCycle(out, t, { rate: 0.23, stride: 0.78, knee: 1.05, arm: 0.75, elbow: 1.35, lean: 0.22, bounce: 4 }); out.cape = 1; },
      dash(out) { // arrancada baixa e rápida
        setPose(out, { lean: 0.55, bob: 5, legF: [1.05, 0.35], legB: [-0.85, -1.45], armF: [-0.9, -0.3], armB: [-1.1, -0.5] });
        out.cape = 1;
      },
      jump(out, f) { // pulo atlético (sem mortal)
        setPose(out, f.vz > 0
          ? { lean: 0.08, legF: [1.05, -0.35], legB: [0.25, -0.85], armF: [2.5, 2.8], armB: [-0.7, 0.2] }
          : { lean: 0.12, legF: [0.55, 0.1], legB: [-0.25, -0.6], armF: [1.3, 1.9], armB: [-1.2, -0.8] });
        out.cape = 1;
      },
      victory(out, f, t) { setPose(out, { lean: -0.06, bob: -Math.abs(Math.sin(t * 0.15)) * 5, armF: [2.0, 2.5], armB: [0.4, 1.8], legF: [0.35, 0.1], legB: [-0.35, -0.45] }); out.mouth = 'smile'; },
    },
    beastboy: {
      idle(out, f, t) { const b = Math.sin(t * 0.12); setPose(out, BBS); out.bob = 3 + b * 2.2; out.armF[1] += b * 0.1; out.armB[1] -= b * 0.1; },
      walk(out, f, t) { runCycle(out, t, { rate: 0.28, stride: 0.88, knee: 1.25, arm: 0.95, elbow: 1.2, lean: 0.3, bounce: 5.5 }); },
      jump(out, f) { // pulo desengonçado com braços abertos
        const k = jumpK(f), w = Math.sin(f.animT * 0.5) * 0.25;
        setPose(out, k < 0.5
          ? { legF: [1.1, -0.4], legB: [0.6, -1.2], armF: [2.4 + w, 2.0], armB: [2.2 - w, 1.8], lean: -0.1 }
          : { legF: [0.6, 0.2], legB: [-0.2, -0.6], armF: [1.9 + w, 2.4], armB: [1.6 - w, 2.2], lean: 0.1 });
        out.spin = Math.sin(k * PI) * -0.35; out.mouth = 'smile';
      },
    },
    cyborg: {
      idle(out, f, t) { const b = Math.sin(t * 0.06); setPose(out, CY); out.bob = b * 1.5; },
      walk(out, f, t) { // passada pesada
        runCycle(out, t, { rate: 0.17, stride: 0.6, knee: 0.85, arm: 0.48, elbow: 1.05, lean: 0.14, bounce: 6 });
        out.squash = Math.max(0, Math.cos(t * 0.34)) * 0.035;
      },
      dash(out) { // desliza com propulsores nos pés
        setPose(out, { lean: 0.38, bob: 8, legF: [0.95, 0.75], legB: [-0.6, -1.45], armF: [-0.7, -0.2], armB: [-0.9, -0.4] });
      },
      jump(out, f) {
        const up = f.vz > 0;
        setPose(out, up ? { legF: [1.35, -0.2], legB: [1.1, -0.45], armF: [2.6, 2.9], armB: [2.4, 2.7], lean: 0.05 }
          : { legF: [0.3, 0.1], legB: [-0.2, -0.3], armF: [1.4, 1.9], armB: [-1.3, -0.9], lean: 0.12 });
      },
    },
    raven: {
      idle(out, f, t) { setPose(out, RV); out.bob = -14 + Math.sin(t * 0.06) * 3; out.cape = 0.25 + Math.sin(t * 0.05) * 0.1; },
      walk(out, f, t) { // desliza flutuando
        setPose(out, M(RV, { lean: 0.3, legF: [-0.35, -0.5], legB: [-0.45, -0.68], armF: [-0.35, -0.2], armB: [-0.45, -0.25] }));
        out.bob = -18 + Math.sin(t * 0.12) * 2; out.cape = 1;
      },
      jump(out, f, t) { // levita em posição de meditação
        setPose(out, M(RV, { bob: 0, legF: [1.35, -0.95], legB: [1.25, -1.05], armF: [1.0, 1.65], armB: [0.9, 1.55], auraF: 0.35, auraB: 0.35 }));
        out.handF = out.handB = 'open'; out.cape = 0.6 + Math.sin(t * 0.2) * 0.1;
      },
    },
    starfire: {
      idle(out, f, t) { setPose(out, SF); out.bob = -12 + Math.sin(t * 0.07) * 3; out.legB[1] += Math.sin(t * 0.07) * 0.1; out.cape = 0.3; },
      walk(out, f, t) { // voando
        setPose(out, M(SF, { lean: 0.58, legF: [-0.45, -0.6], legB: [-0.65, -0.95], armF: [1.3, 1.5], armB: [-0.5, -0.2] }));
        out.bob = -26 + Math.sin(t * 0.1) * 3; out.legB[1] += Math.sin(t * 0.2) * 0.12; out.cape = 1;
      },
      dash(out) { // cometa verde
        setPose(out, { lean: 1.25, bob: -24, legF: [-0.8, -0.85], legB: [-1.0, -1.05], armF: [1.55, 1.57], armB: [1.45, 1.5], auraF: 1, auraB: 1 });
        out.cape = 1;
      },
      jump(out, f) {
        const k = jumpK(f);
        setPose(out, { bob: 0, legF: [-0.2, -0.5], legB: [-0.4, -0.8], armF: [2.8, 3.0], armB: [2.6, 2.9], lean: -0.05 });
        out.spin = Math.sin(k * PI) * 0.25; out.cape = 1;
      },
    },
  };
  TT.MOVES = MOVES;

  // ---------------------------------------------------------------- Pose a partir do estado do lutador
  const IDLE = { lean: 0.05 };
  const tmpA = newPose(), tmpB = newPose();

  function attackPose(out, f) {
    const a = f.atk, def = a ? a.def : null, ft = a ? a.t : 0;
    const keys = def && def.anim && ANIMS[def.anim];
    if (keys) evalKeys(out, keys, ft);
    else {
      const P = def && ATK[def.pose] ? ATK[def.pose] : ATK.jab;
      const s = def ? def.s : 6, act = def ? def.a : 4, r = def ? def.r : 8;
      setPose(tmpA, IDLE); setPose(tmpB, P.w);
      if (ft < s) blendPose(out, tmpA, tmpB, TT.easeOut(ft / s));
      else if (ft < s + act) blendPose(out, P.w, P.h, Math.min(1, (ft - s + 1) / 2));
      else blendPose(out, P.h, IDLE, TT.easeInOut(Math.min(1, (ft - s - act) / Math.max(1, r))));
    }
    if (def) {
      out.weapon = def.weapon || null;
      out.glow = def.glow || null;
      out.form = def.form || null;
      out.handF = out.handB = def.hands || null;
      if (def.shout || ft >= def.s) out.mouth = def.mouth || 'shout';
    }
    out.cape = Math.max(out.cape, 0.5);
  }

  TT.computePose = function (f, out) {
    const t = f.animT;
    out.mouth = null; out.weapon = null; out.glow = null; out.form = null; out.eyes = null; out.handF = null; out.handB = null;
    out.cape = TT.clamp(Math.abs(f.vx) / 6, 0, 1);
    const mv = f.key ? MOVES[f.key] : null;
    if (f.anim === 'attack') attackPose(out, f);
    else if (mv && mv[f.anim]) mv[f.anim](out, f, t);
    else generic(out, f, t);
    return out;
  };

  function generic(out, f, t) {
    switch (f.anim) {
      case 'walk': runCycle(out, t, { rate: 0.21, stride: 0.6, knee: 0.7, arm: 0.55, elbow: 1.1, lean: 0.12, bounce: 3 }); out.cape = 0.6; break;
      case 'dash':
        setPose(out, { lean: 0.5, bob: 2, legF: [0.9, 0.3], legB: [-0.9, -1.5], armF: [-0.8, -0.3], armB: [-1.0, -0.5] });
        out.cape = 1;
        break;
      case 'jump':
        setPose(out, f.vz > 0
          ? { lean: 0.05, legF: [0.9, -0.2], legB: [0.3, -0.7], armF: [2.4, 2.7], armB: [-0.6, 0.2] }
          : { lean: 0.1, legF: [0.4, 0.0], legB: [-0.3, -0.6], armF: [1.2, 1.6], armB: [-1.3, -1.0] });
        out.cape = 0.8;
        break;
      case 'hurt':
        blendPose(out, IDLE, { lean: -0.4, tilt: -0.35, armF: [-0.7, -0.3], armB: [-1.0, -0.6], legF: [0.4, 0.1], legB: [-0.3, -0.5] }, Math.min(1, t / 6));
        out.mouth = 'open'; out.eyes = 'shut';
        break;
      case 'down':
        setPose(out, { lean: 0, tilt: 0.2, armF: [-2.2, -2.6], armB: [-2.0, -2.3], legF: [0.3, 0.1], legB: [-0.2, -0.3] });
        out.rot = f.z > 1 ? -0.9 - Math.min(0.6, t * 0.03) : -PI / 2;
        out.mouth = 'open'; out.eyes = 'shut';
        break;
      case 'getup': {
        const k = Math.min(1, t / 18);
        setPose(out, { bob: 10 * (1 - k), lean: 0.4 * (1 - k), legF: [0.9, -0.4], legB: [-0.2, -0.9], armF: [0.6, 0.6], armB: [0.3, 0.3] });
        out.rot = -PI / 2 * Math.max(0, 1 - k * 2);
        break;
      }
      case 'ko':
        setPose(out, { tilt: 0.3, armF: [-2.4, -2.6], armB: [-2.2, -2.4], legF: [0.2, 0.0], legB: [-0.1, -0.2] });
        out.rot = -PI / 2; out.eyes = 'x';
        break;
      case 'victory': {
        const s = Math.sin(t * 0.15);
        setPose(out, { lean: -0.08, bob: -Math.abs(s) * 5, armF: [2.0 + s * 0.1, 2.5 + s * 0.1], armB: [-0.4, 0.5], legF: [0.3, 0.1], legB: [-0.3, -0.4] });
        out.mouth = 'smile';
        break;
      }
      default: { // parado
        const b = Math.sin(t * 0.08);
        setPose(out, IDLE);
        out.bob = b * 1.4;
        out.armF[1] += b * 0.05;
        out.armB[1] -= b * 0.05;
      }
    }
    if (f.style && f.style.airIdle && f.z > 0 && f.anim !== 'down') out.legB[1] -= 0.3;
  }
})();

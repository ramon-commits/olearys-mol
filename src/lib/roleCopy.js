// Teksten voor de rolkaart.
//
// LET OP. De twee rollen moeten er IDENTIEK uitzien: zelfde aantal tips,
// vergelijkbare lengte, zelfde opmaak. Kleur en vorm mogen niets verraden,
// want in een volle bar kijkt iedereen bij elkaar mee en een afwijkend scherm
// is van vijf meter afstand te lezen.
//
// Voeg dus nooit een kleur, icoon of extra tip toe aan maar één van de twee.

export const HOUSE_RULES = [
  'Er zit precies één mol in jouw team.',
  'Bij elk van de vier check-ins beschrijf je wie jij verdenkt.',
  'Hoe vaker je team ernaast zit, hoe meer punten het inlevert.',
  'Je kunt je rol hier altijd terugkijken. Hou hem voor je.',
];

export const ROLE_COPY = {
  mole: {
    heading: 'Jij bent de mol.',
    body: 'Je teamgenoten beantwoorden bij elke check-in acht vragen over jou: leeftijd, lengte, haarkleur, schoenmaat. Elk antwoord dat ze fout hebben, kost hun team punten. Blijf onzichtbaar.',
    tips: [
      'Praat weinig over jezelf. Elk detail dat ze onthouden, kost je punten.',
      'Denk hardop mee over wie de mol zou zijn. Wie meezoekt, lijkt onschuldig.',
      'Overdrijf niet. Wie te veel afleidt, valt juist op.',
      'Laat af en toe twijfel zien. Wie te zeker is van zichzelf, is verdacht.',
    ],
  },
  player: {
    heading: 'Jij bent speler.',
    body: 'Er zit een mol in jouw team. Bij elke check-in beschrijf je acht kenmerken van de persoon die jij verdenkt: leeftijd, lengte, haarkleur, schoenmaat. Hoe beter je gokt, hoe minder punten je team verliest.',
    tips: [
      'Kijk goed rond. Lengte en schoenmaat schat je zo in.',
      'Let op wie het gesprek wegstuurt zodra het over uiterlijk gaat.',
      'Overleg niet hardop met je team. De mol luistert gewoon mee.',
      'Wissel niet zomaar van verdachte. Twijfel kost je punten.',
    ],
  },
};

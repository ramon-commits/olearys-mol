// De 8 keuzevragen. Deze `key`s worden 1-op-1 gebruikt in de SQL-scoring
// (mol_match_count). Wijzig een key hier, dan moet de SQL mee.
//
// `self` = vraag bij registratie (over jezelf)
// `mol`  = vraag bij een check-in (over de mol in jouw team)

export const QUESTIONS = [
  {
    key: 'age',
    self: 'Wat is je leeftijd?',
    mol: 'Welke leeftijdscategorie heeft de mol?',
    options: ['15-25', '26-35', '36-45', '46-55', '55+'],
  },
  {
    key: 'tenure',
    self: 'Hoe lang werk je hier al?',
    mol: 'Hoe lang werkt de mol hier al?',
    options: ['minder dan 1 jaar', '1-3 jaar', '3-5 jaar', '5-10 jaar', '10+ jaar'],
  },
  {
    key: 'hair',
    self: 'Wat is je haarkleur?',
    mol: 'Welke haarkleur heeft de mol?',
    options: ['blond', 'bruin', 'zwart', 'rood', 'grijs', 'anders'],
  },
  {
    key: 'height',
    self: 'Hoe lang ben je?',
    mol: 'Hoe lang is de mol?',
    options: ['korter dan 1.65m', '1.65-1.75m', '1.75-1.85m', 'langer dan 1.85m'],
  },
  {
    key: 'glasses',
    self: 'Draag je een bril?',
    mol: 'Draagt de mol een bril?',
    options: ['ja', 'nee'],
  },
  {
    key: 'shoe',
    self: 'Wat is je schoenmaat?',
    mol: 'Welke schoenmaat heeft de mol?',
    options: ['kleiner dan 38', '38-41', '42-44', 'groter dan 44'],
  },
  {
    key: 'pet',
    self: 'Welk huisdier heb je?',
    mol: 'Welk huisdier heeft de mol?',
    options: ['hond', 'kat', 'ander huisdier', 'geen huisdier'],
  },
  {
    key: 'drink',
    self: 'Wat drink je het liefst?',
    mol: 'Wat drinkt de mol het liefst?',
    options: ['koffie', 'thee', 'water', 'fris', 'bier of wijn'],
  },
];

export function allAnswered(answers) {
  return QUESTIONS.every((q) => answers[q.key]);
}

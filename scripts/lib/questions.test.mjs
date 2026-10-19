import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizedPrompt, parseQuestionados, questionId, validateQuestion } from './questions.mjs';

function sample() {
  return {
    id: 'sample:geography:1',
    category: 'geography',
    locale: 'pt-BR',
    type: 'multiple',
    prompt: 'Qual é a capital do Brasil?',
    options: ['Brasília', 'Recife', 'Manaus', 'Santos'].map((text, index) => ({
      id: `option-${index}`,
      text,
    })),
    correctOptionId: 'option-0',
    difficulty: 'unrated',
    status: 'needs-review',
    source: { id: 'sample', url: 'https://example.com/questions', recordIndex: 0, license: 'MIT' },
  };
}

test('lê literais com aspas distintas e vírgula final, preservando conteúdo das strings', () => {
  const records = parseQuestionados(`const DATA = [
    { question: 'Qual "question:" aparece?', choices: ["A", 'B', 'C', 'D',], answer: 1, },
    { question: 'D\\'água', choices: ['A', 'B', 'C', 'D'], answer: 0 }
  ];`);
  assert.equal(records[0].question, 'Qual "question:" aparece?');
  assert.equal(records[1].question, "D'água");
  assert.deepEqual(records[0].choices, ['A', 'B', 'C', 'D']);
});

test('recusa código executável em vez de avaliar a fonte remota', () => {
  assert.throws(() => parseQuestionados('const DATA = [{question: process.exit(0)}];'));
  assert.throws(() => parseQuestionados('const DATA = []; console.log("execução");'));
});

test('não adivinha gabarito quando a fonte usa campo incorreto', () => {
  const [record] = parseQuestionados('const DATA = [{question: "Q?", correta: 2}];');
  assert.equal(record.answer, undefined);
  assert.equal(record.correta, 2);
});

test('aceita registro íntegro e recusa gabarito fora das alternativas', () => {
  assert.deepEqual(validateQuestion(sample()), []);
  assert.ok(
    validateQuestion({ ...sample(), correctOptionId: 'option-7' }).includes('Gabarito inválido'),
  );
});

test('detecta alternativas equivalentes apesar de acento, caixa e pontuação', () => {
  const question = sample();
  question.options[1].text = 'BRASILIA!';
  assert.ok(validateQuestion(question).includes('Texto de alternativa repetido'));
  assert.equal(normalizedPrompt('  São Paulo?! '), normalizedPrompt('sao paulo'));
});

test('exige dois itens para verdadeiro/falso e quatro para múltipla escolha', () => {
  assert.ok(
    validateQuestion({ ...sample(), type: 'boolean' }).includes('Esperadas 2 alternativas'),
  );
  const question = { ...sample(), type: 'boolean', options: sample().options.slice(0, 2) };
  assert.deepEqual(validateQuestion(question), []);
});

test('aprovação exige português, referência factual e data de revisão', () => {
  assert.ok(validateQuestion({ ...sample(), status: 'approved' }).length > 0);
  assert.deepEqual(
    validateQuestion({
      ...sample(),
      status: 'approved',
      difficulty: 'easy',
      review: {
        referenceUrl: 'https://example.com/fact',
        reviewedAt: '2026-10-16',
        checks: { factual: true, language: true, uniqueAnswer: true },
      },
    }),
    [],
  );
  assert.ok(validateQuestion({ ...sample(), status: 'approved', locale: 'en' }).length > 0);
});

test('IDs permanecem estáveis diante de diferenças superficiais no enunciado', () => {
  assert.equal(questionId('source', 'theme', 'Qual é?'), questionId('source', 'theme', 'QUAL E!'));
  assert.notEqual(questionId('source', 'theme', 'Um?'), questionId('source', 'theme', 'Dois?'));
});

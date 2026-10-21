import type { MatchStage } from '@penshow/shared';
import { strings } from '../../strings/pt-BR';
import { Button } from '../../ui/button';

type Option = Extract<MatchStage, { phase: 'question-open' }>['question']['options'][number];

export function AnswerOptions({
  options,
  selected,
  disabled,
  helpId,
  onAnswer,
}: {
  options: readonly Option[];
  selected: string | undefined;
  disabled: boolean;
  helpId: string;
  onAnswer: (optionId: Option['optionId']) => void;
}) {
  return (
    <div
      className="quiz-options"
      role="group"
      aria-label={strings.match.answer}
      aria-describedby={helpId}
    >
      {options.map((option, index) => (
        <Button
          key={option.optionId}
          data-answer-key={index + 1}
          aria-keyshortcuts={disabled ? undefined : String(index + 1)}
          aria-pressed={selected === option.optionId}
          disabled={disabled}
          onClick={() => onAnswer(option.optionId)}
        >
          <span className="answer-key" aria-hidden="true">
            {index + 1}
          </span>
          <span>{option.text}</span>
        </Button>
      ))}
    </div>
  );
}

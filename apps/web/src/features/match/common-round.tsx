import { strings } from '../../strings/pt-BR';
import { Timer } from '../../ui/timer';
import { CategoryChoice, Instructions } from './preparation';
import { QuestionAnswer, QuestionReading, QuestionReveal } from './question';
import type { RoundProps } from './round-props';
import { WagerSelection } from './wager-selection';
import { TheftTarget } from './theft-target';

export function CommonRound(props: RoundProps) {
  const stage = props.match.stage;
  switch (stage.phase) {
    case 'instructions':
      return <Instructions {...props} stage={stage} />;
    case 'category-selection':
      return <CategoryChoice {...props} stage={stage} />;
    case 'wager-selection':
      return <WagerSelection {...props} stage={stage} />;
    case 'theft-target-selection':
      return <TheftTarget {...props} stage={stage} />;
    case 'question-reading':
      return <QuestionReading {...props} stage={stage} />;
    case 'question-open':
      return <QuestionAnswer {...props} stage={stage} />;
    case 'reveal':
      return <QuestionReveal {...props} stage={stage} />;
    case 'round-results':
      return (
        <>
          <h2 tabIndex={-1}>{strings.match.results}</h2>
          <p>{strings.match.resultsHelp}</p>
          <Timer deadline={stage.deadlineAt} now={props.now} offset={props.controls.offset} />
        </>
      );
    default:
      return <p role="status">{strings.match.unsupported}</p>;
  }
}

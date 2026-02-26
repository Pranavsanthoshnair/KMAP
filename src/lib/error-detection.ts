// Simple error detection for math operations - runs entirely in browser
export interface ErrorDetection {
  errorType: string;
  suggestedCapsule: string;
  message: string;
}

export function detectMathError(
  question: string,
  userAnswer: string,
  correctAnswer: string
): ErrorDetection | null {
  if (userAnswer === correctAnswer) return null;

  const userNum = parseInt(userAnswer);
  const correctNum = parseInt(correctAnswer);

  if (isNaN(userNum)) {
    return { errorType: 'invalid_input', suggestedCapsule: '', message: 'Please enter a number.' };
  }

  // Detect carry error in addition
  if (question.includes('+')) {
    const parts = question.replace('?', '').split('+').map(s => parseInt(s.trim()));
    if (parts.length === 2) {
      const [a, b] = parts;
      const unitsSum = (a % 10) + (b % 10);
      if (unitsSum >= 10 && correctNum - userNum === 10) {
        return {
          errorType: 'carry_missing',
          suggestedCapsule: 'KC_CARRY_01',
          message: 'It looks like you forgot to carry. When digits sum ≥ 10, carry 1 to the next place.',
        };
      }
    }
  }

  // Detect borrow error in subtraction
  if (question.includes('-')) {
    const parts = question.replace('?', '').split('-').map(s => parseInt(s.trim()));
    if (parts.length === 2) {
      const [a, b] = parts;
      const unitA = a % 10;
      const unitB = b % 10;
      if (unitA < unitB && userNum - correctNum === 10) {
        return {
          errorType: 'borrow_missing',
          suggestedCapsule: 'KC_BORROW_01',
          message: 'It looks like you forgot to borrow. When the top digit is smaller, borrow from the next place.',
        };
      }
    }
  }

  return {
    errorType: 'wrong_answer',
    suggestedCapsule: '',
    message: `Not quite. The correct answer is ${correctAnswer}.`,
  };
}

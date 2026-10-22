export type LineStatus = 'valid' | 'ambiguous' | 'ignored';

export interface LineResult {
	line: string;
	status: LineStatus;
	amount: number | null;
	amountScaled: string | null;
	hasDecimal: boolean;
	reason?: string;
}

export interface CalculationResult {
	lines: LineResult[];
	total: number;
	totalScaled: string;
	hasDecimal: boolean;
	formattedTotal: string;
}

const SCALE = 1_000_000n;
const MAX_DECIMAL_PLACES = 6;

const NUMBER_SOURCE = String.raw`[+-]?\d+(?:\.\d+)?`;

const NUMBER_TOKEN = new RegExp(String.raw`(?<![A-Za-z0-9_])[+-]?\d+(?:\.\d+)?`, 'g');

// Matches contiguous arithmetic expressions such as:
// 2 x 50, -2 * 50, 100 / -4, and unsupported 2 + 3.
const EXPRESSION = new RegExp(
	String.raw`(?<![A-Za-z0-9_])${NUMBER_SOURCE}(?:\s*[xX×*/+-]\s*${NUMBER_SOURCE})+`,
	'g'
);

interface ParsedNumber {
	scaled: bigint;
	hasDecimal: boolean;
}

interface ParsedExpression {
	first: ParsedNumber;
	operations: Array<{
		operator: string;
		operand: ParsedNumber;
	}>;
}

function parseNumber(raw: string): ParsedNumber | null {
	const normalized = raw.replace(/−/g, '-');
	const match = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(normalized);

	if (!match) return null;

	const sign = match[1] === '-' ? -1n : 1n;
	const integerPart = match[2];
	const fractionPart = match[3] ?? '';

	if (fractionPart.length > MAX_DECIMAL_PLACES) {
		return null;
	}

	const fraction = fractionPart.padEnd(MAX_DECIMAL_PLACES, '0');
	const scaled = BigInt(integerPart) * SCALE + BigInt(fraction || '0');

	return {
		scaled: sign * scaled,
		hasDecimal: fractionPart.length > 0
	};
}

function roundDivision(numerator: bigint, denominator: bigint): bigint {
	if (denominator === 0n) {
		throw new Error('Division by zero');
	}

	const negative = numerator < 0n !== denominator < 0n;
	const n = numerator < 0n ? -numerator : numerator;
	const d = denominator < 0n ? -denominator : denominator;

	const quotient = n / d;
	const remainder = n % d;
	const rounded = quotient + (remainder * 2n >= d ? 1n : 0n);

	return negative ? -rounded : rounded;
}

function isLeapYear(year: number): boolean {
	return year % 400 === 0 || (year % 4 === 0 && year % 100 !== 0);
}

function isValidDateParts(year: number, month: number, day: number): boolean {
	if (year < 1 || month < 1 || month > 12 || day < 1) {
		return false;
	}

	const daysInMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

	return day <= daysInMonth[month - 1];
}

function isRecognizableNumericDate(raw: string): boolean {
	const parts = raw.split(/[./-]/);

	if (parts.length !== 3) return false;

	const [first, second, third] = parts;

	// Recognize year-first dates such as 2026-10-20.
	if (first.length === 4) {
		return isValidDateParts(Number(first), Number(second), Number(third));
	}

	// Otherwise require a two- or four-digit year.
	if (third.length !== 2 && third.length !== 4) {
		return false;
	}

	const year = third.length === 2 ? 2000 + Number(third) : Number(third);

	// Accept day/month/year or month/day/year.
	return (
		isValidDateParts(year, Number(second), Number(first)) ||
		isValidDateParts(year, Number(first), Number(second))
	);
}

function removeRecognizableDates(text: string): string {
	const datePattern = /(?<!\d)(\d{1,4}[./-]\d{1,2}[./-]\d{2,4})(?!\d)/g;

	return text.replace(datePattern, (match) => (isRecognizableNumericDate(match) ? ' ' : match));
}

function parseExpression(raw: string): ParsedExpression | null {
	const numberPattern = /^[+-]?\d+(?:\.\d+)?/;
	const firstMatch = numberPattern.exec(raw);

	if (!firstMatch) return null;

	const first = parseNumber(firstMatch[0]);

	if (!first) return null;

	const operations: ParsedExpression['operations'] = [];
	let position = firstMatch[0].length;

	while (position < raw.length) {
		while (/\s/.test(raw[position] ?? '')) position++;

		if (position >= raw.length) break;

		const operator = raw[position];

		if (!'xX×*/+-'.includes(operator)) return null;

		position++;

		while (/\s/.test(raw[position] ?? '')) position++;

		const remaining = raw.slice(position);
		const operandMatch = numberPattern.exec(remaining);

		if (!operandMatch) return null;

		const operand = parseNumber(operandMatch[0]);

		if (!operand) return null;

		operations.push({ operator, operand });
		position += operandMatch[0].length;
	}

	return { first, operations };
}

function evaluateBinaryExpression(
	expression: ParsedExpression
): { scaled: bigint; hasDecimal: boolean } | null {
	// Only exactly one binary operation is supported.
	if (expression.operations.length !== 1) {
		return null;
	}

	const { operator, operand } = expression.operations[0];

	let scaled: bigint;

	switch (operator) {
		case 'x':
		case 'X':
		case '×':
		case '*':
			scaled = roundDivision(expression.first.scaled * operand.scaled, SCALE);
			break;

		case '/':
			if (operand.scaled === 0n) return null;

			scaled = roundDivision(expression.first.scaled * SCALE, operand.scaled);
			break;

		default:
			// Addition and subtraction expressions are not supported
			// within a line. Use separate lines to add or subtract.
			return null;
	}

	return {
		scaled,
		hasDecimal: expression.first.hasDecimal || operand.hasDecimal || scaled % SCALE !== 0n
	};
}

function toNumber(scaled: bigint): number {
	return Number(scaled) / Number(SCALE);
}

function formatScaled(scaled: bigint, decimalMode: boolean): string {
	if (!decimalMode) {
		return roundDivision(scaled, SCALE).toString();
	}

	// Round to two decimal places.
	const cents = roundDivision(scaled, SCALE / 100n);
	const negative = cents < 0n;
	const absolute = negative ? -cents : cents;

	const whole = absolute / 100n;
	const fraction = (absolute % 100n).toString().padStart(2, '0');

	return `${negative ? '-' : ''}${whole}.${fraction}`;
}

function resultForLine(
	line: string,
	status: LineStatus,
	scaled: bigint | null,
	hasDecimal = false,
	reason?: string
): LineResult {
	return {
		line,
		status,
		amount: scaled === null ? null : toNumber(scaled),
		amountScaled: scaled === null ? null : scaled.toString(),
		hasDecimal,
		...(reason ? { reason } : {})
	};
}

export function calculateLine(originalLine: string): LineResult {
	const line = originalLine.trim();

	if (!line) {
		return resultForLine(originalLine, 'ignored', null);
	}

	const cleaned = removeRecognizableDates(line);

	const incompleteExpression = new RegExp(
		String.raw`(?<![A-Za-z0-9_])${NUMBER_SOURCE}\s*[xX×*/+-]\s*$`
	);

	if (incompleteExpression.test(cleaned)) {
		return resultForLine(
			originalLine,
			'ambiguous',
			null,
			false,
			'The arithmetic expression is incomplete.'
		);
	}

	// Prefer a final binary expression over an isolated number.
	const expressions = [...cleaned.matchAll(EXPRESSION)];

	if (expressions.length > 0) {
		const lastExpression = expressions[expressions.length - 1];
		const rawExpression = lastExpression[0];
		const parsed = parseExpression(rawExpression);

		if (!parsed) {
			return resultForLine(
				originalLine,
				'ambiguous',
				null,
				false,
				'Could not interpret the arithmetic expression.'
			);
		}

		if (parsed.operations.length !== 1) {
			return resultForLine(
				originalLine,
				'ambiguous',
				null,
				false,
				'Only one binary operation per expression is supported.'
			);
		}

		const evaluated = evaluateBinaryExpression(parsed);

		if (!evaluated) {
			const operator = parsed.operations[0].operator;
			const reason =
				operator === '/'
					? 'Division by zero or invalid division.'
					: 'Only multiplication and division are supported within a line.';

			return resultForLine(originalLine, 'ambiguous', null, false, reason);
		}

		return resultForLine(originalLine, 'valid', evaluated.scaled, evaluated.hasDecimal);
	}

	// No binary expression: use the last standalone number.
	const tokens = [...cleaned.matchAll(NUMBER_TOKEN)];

	if (tokens.length === 0) {
		return resultForLine(originalLine, 'valid', 0n);
	}

	const lastToken = tokens[tokens.length - 1][0];
	const parsed = parseNumber(lastToken);

	if (!parsed) {
		return resultForLine(
			originalLine,
			'ambiguous',
			null,
			false,
			`Numbers may contain at most ${MAX_DECIMAL_PLACES} decimal places.`
		);
	}

	return resultForLine(originalLine, 'valid', parsed.scaled, parsed.hasDecimal);
}

export function calculateNote(text: string): CalculationResult {
	const lines = text.split(/\r?\n/).map(calculateLine);

	let totalScaled = 0n;
	let hasDecimal = false;

	for (const line of lines) {
		if (line.status !== 'valid' || line.amountScaled === null) {
			continue;
		}

		totalScaled += BigInt(line.amountScaled);

		if (line.hasDecimal || BigInt(line.amountScaled) % SCALE !== 0n) {
			hasDecimal = true;
		}
	}

	return {
		lines,
		total: toNumber(totalScaled),
		totalScaled: totalScaled.toString(),
		hasDecimal,
		formattedTotal: formatScaled(totalScaled, hasDecimal)
	};
}

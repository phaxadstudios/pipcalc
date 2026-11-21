/**
 * pipcalc: pip value, position size, risk/reward and drawdown maths for traders.
 * Zero dependencies. Every result is in the account currency (US dollars).
 *
 * The same maths runs the order ticket and free calculators at https://candleben.com/tools
 */

export interface Instrument {
  symbol: string;
  /** The price move that counts as one pip (or point): 0.0001 for EUR/USD, 0.01 for USD/JPY. */
  pipSize: number;
  /** Units in one standard lot: 100,000 for forex, 100 oz for gold. */
  contractSize: number;
}

/** Common markets, with the pip size and lot size most brokers use. Check yours: some differ. */
export const INSTRUMENTS: Readonly<Record<string, Instrument>> = Object.freeze({
  XAUUSD: { symbol: "XAUUSD", pipSize: 0.1, contractSize: 100 },
  XAGUSD: { symbol: "XAGUSD", pipSize: 0.01, contractSize: 5000 },
  USOIL: { symbol: "USOIL", pipSize: 0.01, contractSize: 1000 },
  US30: { symbol: "US30", pipSize: 1, contractSize: 1 },
  NAS100: { symbol: "NAS100", pipSize: 1, contractSize: 1 },
  SPX500: { symbol: "SPX500", pipSize: 0.25, contractSize: 1 },
  GER40: { symbol: "GER40", pipSize: 1, contractSize: 1 },
  BTCUSD: { symbol: "BTCUSD", pipSize: 1, contractSize: 1 },
  ETHUSD: { symbol: "ETHUSD", pipSize: 0.1, contractSize: 1 },
});

export const LOT = Object.freeze({ standard: 1, mini: 0.1, micro: 0.01, nano: 0.001 });

const clean = (symbol: string) => symbol.toUpperCase().replace(/[^A-Z0-9]/g, "");

/**
 * The instrument for a symbol. Any six-letter forex pair works ("EURUSD", "eur/jpy"):
 * pairs quoted in yen use 0.01 pips, the rest 0.0001. Other markets come from INSTRUMENTS.
 */
export function instrument(symbol: string): Instrument | null {
  const s = clean(symbol);
  if (INSTRUMENTS[s]) return INSTRUMENTS[s];
  if (/^[A-Z]{6}$/.test(s)) return { symbol: s, pipSize: s.endsWith("JPY") ? 0.01 : 0.0001, contractSize: 100_000 };
  return null;
}

/** The other market whose price turns this pair's quote currency into dollars, if one is needed. */
export function conversionPair(symbol: string): string | null {
  const s = clean(symbol);
  if (!/^[A-Z]{6}$/.test(s) || s.startsWith("USD") || s.endsWith("USD")) return null;
  return `USD${s.slice(3)}`;
}

/**
 * What one unit of the quote currency is worth in dollars.
 * - Quoted in dollars (EUR/USD, gold, indices): 1.
 * - Dollar first (USD/JPY): 1 / its own price.
 * - Crosses (EUR/JPY): needs the dollar rate, e.g. `{ USDJPY: 150 }`, or `{ GBPUSD: 1.3 }` for EUR/GBP.
 * Returns null when a rate it needs is missing.
 */
export function usdPerQuoteUnit(symbol: string, price: number, rates: Record<string, number> = {}): number | null {
  const s = clean(symbol);
  if (/^USD[A-Z]{3}$/.test(s)) return price > 0 ? 1 / price : null;
  const pair = conversionPair(s);
  if (!pair) return 1;
  const quote = s.slice(3);
  if (rates[pair] > 0) return 1 / rates[pair];
  if (rates[`${quote}USD`] > 0) return rates[`${quote}USD`];
  return null;
}

/** Dollars per pip for this many lots. */
export function pipValue(inst: Instrument, lots: number, usdPerQuote = 1): number {
  return inst.pipSize * inst.contractSize * lots * usdPerQuote;
}

/** How many pips lie between two prices (always positive). */
export function pips(inst: Instrument, from: number, to: number): number {
  return Math.round((Math.abs(to - from) / inst.pipSize) * 1e6) / 1e6;
}

export interface PositionSize {
  /** Rounded down to the lot step, so the risk is never more than asked. */
  lots: number;
  units: number;
  /** What the rounded size really risks. */
  riskUsd: number;
  /** What was asked to be risked. */
  targetRiskUsd: number;
}

/**
 * The biggest size that loses no more than `riskPercent` of the balance if the stop is hit.
 * `pipValuePerLot` is what one pip is worth on one lot: `pipValue(inst, 1, usdPerQuote)`.
 */
export function positionSize(
  balance: number,
  riskPercent: number,
  stopPips: number,
  pipValuePerLot: number,
  contractSize: number,
  lotStep = 0.01
): PositionSize | null {
  if (!(balance > 0) || !(riskPercent > 0) || !(stopPips > 0) || !(pipValuePerLot > 0) || !(lotStep > 0)) return null;
  const targetRiskUsd = (balance * riskPercent) / 100;
  const steps = Math.floor(targetRiskUsd / (stopPips * pipValuePerLot) / lotStep + 1e-9);
  const lots = Number((steps * lotStep).toFixed(6));
  return {
    lots,
    units: Math.round(lots * contractSize),
    riskUsd: Number((lots * stopPips * pipValuePerLot).toFixed(2)),
    targetRiskUsd: Number(targetRiskUsd.toFixed(2)),
  };
}

export interface SizeInput {
  symbol: string;
  balance: number;
  riskPercent: number;
  /** The stop in pips, or give `entry` and `stop` prices instead. */
  stopPips?: number;
  entry?: number;
  stop?: number;
  /** The market's current price: needed for pairs like USD/JPY. Defaults to `entry`. */
  price?: number;
  /** Dollar rates for crosses, e.g. `{ USDJPY: 150 }`. */
  rates?: Record<string, number>;
  lotStep?: number;
}

/** Position size in one call, from a symbol. Null if something it needs is missing. */
export function sizeFor(input: SizeInput): PositionSize | null {
  const inst = instrument(input.symbol);
  if (!inst) return null;
  const stopPips = input.stopPips ?? (input.entry !== undefined && input.stop !== undefined ? pips(inst, input.entry, input.stop) : undefined);
  const price = input.price ?? input.entry ?? 0;
  const perQuote = usdPerQuoteUnit(inst.symbol, price, input.rates);
  if (stopPips === undefined || perQuote === null) return null;
  return positionSize(input.balance, input.riskPercent, stopPips, pipValue(inst, 1, perQuote), inst.contractSize, input.lotStep);
}

export interface RiskReward {
  side: "BUY" | "SELL";
  risk: number;
  reward: number;
  /** Reward for each 1 risked. */
  ratio: number;
  /** The share of trades that must win just to break even at this ratio (0 to 1). */
  breakevenWinRate: number;
}

/** Risk and reward from an entry, stop and target. A stop below the entry means a buy. */
export function riskReward(entry: number, stop: number, target: number): RiskReward | null {
  if (!(entry > 0) || !(stop > 0) || !(target > 0) || stop === entry) return null;
  const side = stop < entry ? "BUY" : "SELL";
  const risk = Math.abs(entry - stop);
  const reward = side === "BUY" ? target - entry : entry - target;
  if (!(reward > 0)) return null;
  const ratio = reward / risk;
  return { side, risk, reward, ratio, breakevenWinRate: 1 / (1 + ratio) };
}

/**
 * Average result per trade, in R (multiples of the amount risked).
 * `winRate` is 0 to 1; `avgWinR` is the average winner in R; losers lose `avgLossR` (1 by default).
 * Above 0 means the strategy makes money over many trades.
 */
export function expectancy(winRate: number, avgWinR: number, avgLossR = 1): number | null {
  if (!(winRate >= 0 && winRate <= 1) || !(avgWinR >= 0) || !(avgLossR >= 0)) return null;
  return winRate * avgWinR - (1 - winRate) * avgLossR;
}

/** The gain needed to get back to where you were after losing `drawdownPercent`: 50% down needs 100% up. */
export function recoveryNeeded(drawdownPercent: number): number | null {
  if (!(drawdownPercent >= 0 && drawdownPercent < 100)) return null;
  return (drawdownPercent / (100 - drawdownPercent)) * 100;
}

/** The balance after losing `losses` trades in a row, risking `riskPercent` of what's left each time. */
export function afterLosingStreak(balance: number, riskPercent: number, losses: number): number | null {
  if (!(balance > 0) || !(riskPercent >= 0 && riskPercent < 100) || !(Number.isInteger(losses) && losses >= 0)) return null;
  return balance * Math.pow(1 - riskPercent / 100, losses);
}

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  afterLosingStreak,
  conversionPair,
  expectancy,
  instrument,
  pipValue,
  pips,
  positionSize,
  recoveryNeeded,
  riskReward,
  sizeFor,
  usdPerQuoteUnit,
} from "../src/index.ts";

const EURUSD = instrument("EURUSD")!;
const USDJPY = instrument("usd/jpy")!;

test("forex pairs are recognised from any spelling", () => {
  assert.deepEqual(EURUSD, { symbol: "EURUSD", pipSize: 0.0001, contractSize: 100000 });
  assert.equal(USDJPY.pipSize, 0.01);
  assert.equal(instrument("xauusd")?.contractSize, 100);
  assert.equal(instrument("NOPE"), null);
});

test("a standard lot of EUR/USD is $10 a pip", () => {
  assert.equal(usdPerQuoteUnit("EURUSD", 1.08), 1);
  assert.equal(Number(pipValue(EURUSD, 1).toFixed(2)), 10);
  assert.equal(Number(pipValue(EURUSD, 0.1).toFixed(2)), 1);
});

test("USD/JPY's pip value comes from its own price", () => {
  assert.equal(Number(pipValue(USDJPY, 1, usdPerQuoteUnit("USDJPY", 150)!).toFixed(2)), 6.67);
});

test("a cross needs the dollar rate of its quote currency", () => {
  assert.equal(conversionPair("EURJPY"), "USDJPY");
  assert.equal(conversionPair("EURUSD"), null);
  assert.equal(usdPerQuoteUnit("EURJPY", 162), null);
  assert.equal(usdPerQuoteUnit("EURJPY", 162, { USDJPY: 150 }), 1 / 150);
  assert.equal(usdPerQuoteUnit("EURGBP", 0.85, { GBPUSD: 1.3 }), 1.3);
  assert.equal(usdPerQuoteUnit("XAUUSD", 2400), 1);
});

test("gold: 1 lot is $10 per $0.10 move", () => {
  assert.equal(Number(pipValue(instrument("XAUUSD")!, 1).toFixed(2)), 10);
  assert.equal(pips(instrument("XAUUSD")!, 2400, 2395), 50);
});

test("position size never risks more than asked", () => {
  assert.deepEqual(positionSize(10000, 1, 20, 10, 100000), { lots: 0.5, units: 50000, riskUsd: 100, targetRiskUsd: 100 });
  const small = positionSize(1000, 2, 30, 10, 100000)!;
  assert.equal(small.lots, 0.06);
  assert.ok(small.riskUsd <= small.targetRiskUsd);
  assert.equal(positionSize(1000, 1, 0, 10, 100000), null);
  assert.equal(positionSize(10000, 1, 20, 10, 100000, 0.1)?.lots, 0.5);
});

test("sizeFor works straight from a symbol and prices", () => {
  assert.equal(sizeFor({ symbol: "EURUSD", balance: 10000, riskPercent: 1, entry: 1.1, stop: 1.098 })?.lots, 0.5);
  assert.equal(sizeFor({ symbol: "USDJPY", balance: 10000, riskPercent: 1, stopPips: 30, price: 150 })?.lots, 0.5);
  assert.equal(sizeFor({ symbol: "EURJPY", balance: 10000, riskPercent: 1, stopPips: 30 }), null);
  assert.equal(sizeFor({ symbol: "EURJPY", balance: 10000, riskPercent: 1, stopPips: 30, rates: { USDJPY: 150 } })?.lots, 0.5);
});

test("risk/reward reads the side from the stop", () => {
  const long = riskReward(1.1, 1.095, 1.11)!;
  assert.equal(long.side, "BUY");
  assert.equal(Number(long.ratio.toFixed(2)), 2);
  assert.equal(Number(long.breakevenWinRate.toFixed(4)), 0.3333);
  assert.equal(riskReward(150, 151, 147)?.side, "SELL");
  assert.equal(riskReward(1.1, 1.095, 1.09), null);
});

test("expectancy, recovery and losing streaks", () => {
  assert.equal(Number(expectancy(0.4, 2)!.toFixed(2)), 0.2);
  assert.equal(expectancy(1.2, 2), null);
  assert.equal(recoveryNeeded(50), 100);
  assert.equal(Number(recoveryNeeded(20)!.toFixed(2)), 25);
  assert.equal(recoveryNeeded(100), null);
  assert.equal(Number(afterLosingStreak(10000, 2, 10)!.toFixed(2)), 8170.73);
});

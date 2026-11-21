# pipcalc

**Pip value, position size, risk/reward and drawdown maths for traders.** Forex, gold, indices and crypto. Zero dependencies, fully typed, with a command-line tool.

[![CI](https://github.com/phaxadstudios/pipcalc/actions/workflows/ci.yml/badge.svg)](https://github.com/phaxadstudios/pipcalc/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/pipcalc.svg)](https://www.npmjs.com/package/pipcalc)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

```
$ npx pipcalc size EURUSD --balance 10000 --risk 1 --stop-pips 20
0.5 lots (50,000 units) risks $100.00 of the $100.00 you set.
```

The same maths runs the order ticket and the free calculators on **[Candleben](https://candleben.com)**, where you can practise trading on real past charts.

## Why

Most blown accounts aren't bad entries. They're the wrong size. `pipcalc` answers the questions you should ask before every trade:

- How many lots can I take so a stop-out costs exactly 1%?
- What is one pip worth on this pair, at this size?
- With this stop and target, how often do I need to win just to break even?
- I'm down 30%. What do I need to get back?

## Install

```bash
npm install pipcalc
```

Or use the CLI without installing: `npx pipcalc help`.

## Library

```ts
import { sizeFor, instrument, pipValue, usdPerQuoteUnit, riskReward, recoveryNeeded } from "pipcalc";

// Position size straight from prices: risk 1% of $10,000 with a 20-pip stop.
sizeFor({ symbol: "EURUSD", balance: 10_000, riskPercent: 1, entry: 1.1, stop: 1.098 });
// → { lots: 0.5, units: 50000, riskUsd: 100, targetRiskUsd: 100 }

// Gold, with the stop $10 away.
sizeFor({ symbol: "XAUUSD", balance: 5_000, riskPercent: 1, entry: 2400, stop: 2390 });
// → { lots: 0.05, units: 5, riskUsd: 50, targetRiskUsd: 50 }

// Pairs quoted in another currency need a price or a rate.
sizeFor({ symbol: "USDJPY", balance: 10_000, riskPercent: 1, stopPips: 30, price: 150 });
sizeFor({ symbol: "EURJPY", balance: 10_000, riskPercent: 1, stopPips: 30, rates: { USDJPY: 150 } });

// Pip value
pipValue(instrument("EURUSD")!, 1);                                    // → 10   ($ per pip, 1 lot)
pipValue(instrument("USDJPY")!, 1, usdPerQuoteUnit("USDJPY", 150)!);   // → 6.67

// Risk/reward
riskReward(1.1, 1.095, 1.11);
// → { side: "BUY", risk: 0.005, reward: 0.01, ratio: 2, breakevenWinRate: 0.333 }

// Drawdown
recoveryNeeded(50); // → 100 (lose half, you need to double)
```

### API

| Function | What it gives you |
| --- | --- |
| `sizeFor({ symbol, balance, riskPercent, stopPips \| entry+stop, price?, rates?, lotStep? })` | The largest lot size that risks no more than `riskPercent`. Rounded **down** to the lot step (0.01 by default). |
| `positionSize(balance, riskPercent, stopPips, pipValuePerLot, contractSize, lotStep?)` | The same, from raw numbers. |
| `instrument(symbol)` | Pip size and lot size. Any six-letter forex pair, plus gold, silver, oil, US30, NAS100, SPX500, GER40, BTCUSD and ETHUSD. |
| `pipValue(instrument, lots, usdPerQuote?)` | Dollars per pip. |
| `pips(instrument, from, to)` | Pips between two prices. |
| `usdPerQuoteUnit(symbol, price, rates?)` | What one unit of the quote currency is worth in dollars. Returns `null` if a cross needs a rate you didn't give. |
| `riskReward(entry, stop, target)` | Side, ratio and the break-even win rate. |
| `expectancy(winRate, avgWinR, avgLossR?)` | Average result per trade in R. Above 0 is an edge. |
| `recoveryNeeded(drawdownPercent)` | Percentage gain needed to get back to even. |
| `afterLosingStreak(balance, riskPercent, losses)` | Balance after a run of losses. |
| `INSTRUMENTS`, `LOT` | The built-in markets, and lot names (standard, mini, micro, nano). |

Functions return `null` rather than throwing when an input doesn't make sense, such as a zero stop or a target on the losing side.

> **Check your broker's contract specs.** Pip and lot sizes for gold, indices and crypto vary between brokers. The built-ins are common defaults, and you can pass your own `{ symbol, pipSize, contractSize }` to any function.

## CLI

```bash
pipcalc size XAUUSD --balance 5000 --risk 1 --entry 2400 --stop 2390
# 0.05 lots (5 units) risks $50.00 of the $50.00 you set.

pipcalc value USDJPY --price 150
# $6.67 per pip on 1 lot of USDJPY (1 pip = 0.01).

pipcalc rr 1.1000 1.0950 1.1100
# BUY: 1 : 2.00 risk/reward. You need to win 33.3% of trades to break even.

pipcalc expectancy --win-rate 40 --avg-win 2
# +0.20R per trade on average. That's an edge.

pipcalc recover 30
# After a 30% loss you need +42.9% to get back to even.

pipcalc streak --balance 10000 --risk 2 --losses 10
# After 10 losses in a row: $8,170.73.
```

Results are in US dollars. Crosses take a rate: `--rate USDJPY=150`.

## Try it without code

Prefer a web page? Use the free calculators at **[candleben.com/tools](https://candleben.com/tools)**: position size, pip value and risk/reward. When you're ready, practise the sizing on real past charts on the [Candleben replay](https://candleben.com/replay).

## Contributing

Issues and pull requests are welcome, especially more instruments and checks against broker specs.

```bash
npm install
npm test      # node --test, needs Node 22.18+ to run the TypeScript tests directly
npm run build
```

## Licence

[MIT](LICENSE) © Apaxaa Technologies Ltd, makers of [Candleben](https://candleben.com).

*For education. Not financial advice. Trading carries a risk of loss.*

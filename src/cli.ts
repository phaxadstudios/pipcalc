#!/usr/bin/env node
import { afterLosingStreak, expectancy, instrument, pipValue, recoveryNeeded, riskReward, sizeFor, usdPerQuoteUnit } from "./index.ts";

const HELP = `pipcalc: trading maths in your terminal

  pipcalc size <symbol> --balance <usd> --risk <percent> (--stop-pips <n> | --entry <price> --stop <price>)
      [--price <price>] [--rate USDJPY=150]
      Lot size that risks exactly that much.  e.g.  pipcalc size EURUSD --balance 10000 --risk 1 --stop-pips 20

  pipcalc value <symbol> [--lots 1] [--price <price>] [--rate USDJPY=150]
      Dollars per pip.  e.g.  pipcalc value USDJPY --price 150

  pipcalc rr <entry> <stop> <target>
      Risk/reward and the win rate you need to break even.  e.g.  pipcalc rr 1.1000 1.0950 1.1100

  pipcalc expectancy --win-rate <percent> --avg-win <R> [--avg-loss <R>]
      Average result per trade in R.  e.g.  pipcalc expectancy --win-rate 40 --avg-win 2

  pipcalc recover <drawdown percent>
      Gain needed to get back to even.  e.g.  pipcalc recover 30

  pipcalc streak --balance <usd> --risk <percent> --losses <n>
      Balance after a losing streak.  e.g.  pipcalc streak --balance 10000 --risk 2 --losses 10

Practise these on real past charts at https://candleben.com`;

function parse(argv: string[]) {
  const args: string[] = [];
  const flags: Record<string, string> = {};
  const rates: Record<string, number> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) {
      args.push(a);
      continue;
    }
    const [key, inline] = a.slice(2).split("=", 2);
    const value = inline ?? argv[++i] ?? "";
    if (key === "rate") {
      const [pair, rate] = value.split("=");
      rates[(pair || "").toUpperCase()] = Number(rate);
    } else flags[key] = value;
  }
  return { args, flags, rates };
}

const num = (v: string | undefined) => (v === undefined || v === "" ? undefined : Number(v));
const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fail = (msg: string): never => {
  console.error(`pipcalc: ${msg}\nRun "pipcalc help" for examples.`);
  process.exit(1);
};

const { args, flags, rates } = parse(process.argv.slice(2));
const [command, ...rest] = args;

switch (command) {
  case "size": {
    const symbol = rest[0] ?? fail("which market? e.g. pipcalc size EURUSD ...");
    const r = sizeFor({
      symbol,
      balance: num(flags.balance) ?? fail("add --balance"),
      riskPercent: num(flags.risk) ?? fail("add --risk (percent of balance)"),
      stopPips: num(flags["stop-pips"]),
      entry: num(flags.entry),
      stop: num(flags.stop),
      price: num(flags.price),
      rates,
    });
    if (!r) fail(`couldn't size ${symbol}: check the numbers. Pairs like USD/JPY need --price, crosses need --rate (e.g. --rate USDJPY=150).`);
    console.log(`${r!.lots} lots (${r!.units.toLocaleString("en-US")} units) risks ${money(r!.riskUsd)} of the ${money(r!.targetRiskUsd)} you set.`);
    break;
  }
  case "value": {
    const symbol = rest[0] ?? fail("which market? e.g. pipcalc value EURUSD");
    const inst = instrument(symbol) ?? fail(`unknown market ${symbol}`);
    const perQuote = usdPerQuoteUnit(inst.symbol, num(flags.price) ?? 0, rates) ?? fail(`${inst.symbol} needs --price, or --rate for a cross`);
    const lots = num(flags.lots) ?? 1;
    console.log(`${money(pipValue(inst, lots, perQuote))} per pip on ${lots} lot${lots === 1 ? "" : "s"} of ${inst.symbol} (1 pip = ${inst.pipSize}).`);
    break;
  }
  case "rr": {
    const [entry, stop, target] = rest.map(Number);
    const r = riskReward(entry, stop, target) ?? fail("give an entry, a stop and a target, with the target on the winning side");
    console.log(`${r.side}: 1 : ${r.ratio.toFixed(2)} risk/reward. You need to win ${(r.breakevenWinRate * 100).toFixed(1)}% of trades to break even.`);
    break;
  }
  case "expectancy": {
    const winRate = (num(flags["win-rate"]) ?? fail("add --win-rate (percent)")) / 100;
    const e = expectancy(winRate, num(flags["avg-win"]) ?? fail("add --avg-win (in R)"), num(flags["avg-loss"]) ?? 1) ?? fail("win rate must be 0 to 100");
    console.log(`${e >= 0 ? "+" : ""}${e.toFixed(2)}R per trade on average. ${e > 0 ? "That's an edge." : "That loses over time."}`);
    break;
  }
  case "recover": {
    const dd = Number(rest[0]);
    const g = recoveryNeeded(dd) ?? fail("give a drawdown from 0 to 99.99 percent");
    console.log(`After a ${dd}% loss you need +${g.toFixed(1)}% to get back to even.`);
    break;
  }
  case "streak": {
    const losses = num(flags.losses) ?? fail("add --losses");
    const left = afterLosingStreak(num(flags.balance) ?? fail("add --balance"), num(flags.risk) ?? fail("add --risk"), losses) ?? fail("check the numbers");
    console.log(`After ${losses} losses in a row: ${money(left)}.`);
    break;
  }
  default:
    console.log(HELP);
}

const compact=new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:2});
// Recharts may choose fractional ticks for empty or low-value datasets.
export const formatChartTick=value=>Math.abs(value)<1000?String(Number(value.toFixed(6))):compact.format(value).replace('K','k');

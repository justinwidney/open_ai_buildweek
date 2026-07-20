import type { HistoricalReturnsDataset } from "./types.js";

/**
 * Real, verified annual total-return series for the historical-backtest
 * returns strategy — not a statistical approximation. Sourced from the
 * NYU Stern (Damodaran) "Returns on Stocks, Bonds and Bills" dataset,
 * extracted by downloading the raw page and parsing its table markup
 * directly (cross-checked against a second independent extraction pass
 * and spot-checked against well-known historical facts, e.g. 2008's
 * ~-36.6% equity return and ~+20% Treasury flight-to-quality return).
 * `totalReturn` is a decimal fraction (0.4381 = 43.81%), matching the
 * `HistoricalAnnualReturn.totalReturn` contract used by `returns/`.
 */
export const sp500TotalReturns1928to2025: HistoricalReturnsDataset = {
  assetClassId: "us-equity-large-cap",
  annualReturns: [
    { year: 1928, totalReturn: 0.4381 }, { year: 1929, totalReturn: -0.083 }, { year: 1930, totalReturn: -0.2512 },
    { year: 1931, totalReturn: -0.4384 }, { year: 1932, totalReturn: -0.0864 }, { year: 1933, totalReturn: 0.4998 },
    { year: 1934, totalReturn: -0.0119 }, { year: 1935, totalReturn: 0.4674 }, { year: 1936, totalReturn: 0.3194 },
    { year: 1937, totalReturn: -0.3534 }, { year: 1938, totalReturn: 0.2928 }, { year: 1939, totalReturn: -0.011 },
    { year: 1940, totalReturn: -0.1067 }, { year: 1941, totalReturn: -0.1277 }, { year: 1942, totalReturn: 0.1917 },
    { year: 1943, totalReturn: 0.2506 }, { year: 1944, totalReturn: 0.1903 }, { year: 1945, totalReturn: 0.3582 },
    { year: 1946, totalReturn: -0.0843 }, { year: 1947, totalReturn: 0.052 }, { year: 1948, totalReturn: 0.057 },
    { year: 1949, totalReturn: 0.183 }, { year: 1950, totalReturn: 0.3081 }, { year: 1951, totalReturn: 0.2368 },
    { year: 1952, totalReturn: 0.1815 }, { year: 1953, totalReturn: -0.0121 }, { year: 1954, totalReturn: 0.5256 },
    { year: 1955, totalReturn: 0.326 }, { year: 1956, totalReturn: 0.0744 }, { year: 1957, totalReturn: -0.1046 },
    { year: 1958, totalReturn: 0.4372 }, { year: 1959, totalReturn: 0.1206 }, { year: 1960, totalReturn: 0.0034 },
    { year: 1961, totalReturn: 0.2664 }, { year: 1962, totalReturn: -0.0881 }, { year: 1963, totalReturn: 0.2261 },
    { year: 1964, totalReturn: 0.1642 }, { year: 1965, totalReturn: 0.124 }, { year: 1966, totalReturn: -0.0997 },
    { year: 1967, totalReturn: 0.238 }, { year: 1968, totalReturn: 0.1081 }, { year: 1969, totalReturn: -0.0824 },
    { year: 1970, totalReturn: 0.0356 }, { year: 1971, totalReturn: 0.1422 }, { year: 1972, totalReturn: 0.1876 },
    { year: 1973, totalReturn: -0.1431 }, { year: 1974, totalReturn: -0.259 }, { year: 1975, totalReturn: 0.37 },
    { year: 1976, totalReturn: 0.2383 }, { year: 1977, totalReturn: -0.0698 }, { year: 1978, totalReturn: 0.0651 },
    { year: 1979, totalReturn: 0.1852 }, { year: 1980, totalReturn: 0.3174 }, { year: 1981, totalReturn: -0.047 },
    { year: 1982, totalReturn: 0.2042 }, { year: 1983, totalReturn: 0.2234 }, { year: 1984, totalReturn: 0.0615 },
    { year: 1985, totalReturn: 0.3124 }, { year: 1986, totalReturn: 0.1849 }, { year: 1987, totalReturn: 0.0581 },
    { year: 1988, totalReturn: 0.1654 }, { year: 1989, totalReturn: 0.3148 }, { year: 1990, totalReturn: -0.0306 },
    { year: 1991, totalReturn: 0.3023 }, { year: 1992, totalReturn: 0.0749 }, { year: 1993, totalReturn: 0.0997 },
    { year: 1994, totalReturn: 0.0133 }, { year: 1995, totalReturn: 0.372 }, { year: 1996, totalReturn: 0.2268 },
    { year: 1997, totalReturn: 0.331 }, { year: 1998, totalReturn: 0.2834 }, { year: 1999, totalReturn: 0.2089 },
    { year: 2000, totalReturn: -0.0903 }, { year: 2001, totalReturn: -0.1185 }, { year: 2002, totalReturn: -0.2197 },
    { year: 2003, totalReturn: 0.2836 }, { year: 2004, totalReturn: 0.1074 }, { year: 2005, totalReturn: 0.0483 },
    { year: 2006, totalReturn: 0.1561 }, { year: 2007, totalReturn: 0.0548 }, { year: 2008, totalReturn: -0.3655 },
    { year: 2009, totalReturn: 0.2594 }, { year: 2010, totalReturn: 0.1482 }, { year: 2011, totalReturn: 0.021 },
    { year: 2012, totalReturn: 0.1589 }, { year: 2013, totalReturn: 0.3215 }, { year: 2014, totalReturn: 0.1352 },
    { year: 2015, totalReturn: 0.0138 }, { year: 2016, totalReturn: 0.1177 }, { year: 2017, totalReturn: 0.2161 },
    { year: 2018, totalReturn: -0.0423 }, { year: 2019, totalReturn: 0.3121 }, { year: 2020, totalReturn: 0.1802 },
    { year: 2021, totalReturn: 0.2847 }, { year: 2022, totalReturn: -0.1804 }, { year: 2023, totalReturn: 0.2606 },
    { year: 2024, totalReturn: 0.2488 }, { year: 2025, totalReturn: 0.1778 },
  ],
  source: "NYU Stern (Aswath Damodaran) — Returns on Stocks, Bonds and Bills, 1928-2025, S&P 500 including reinvested dividends",
  url: "https://pages.stern.nyu.edu/~adamodar/New_Home_Page/datafile/histretSP.html",
  asOf: "2025-12-31",
};

export const treasuryBond10yTotalReturns1928to2025: HistoricalReturnsDataset = {
  assetClassId: "us-treasury-bond-10y",
  annualReturns: [
    { year: 1928, totalReturn: 0.0084 }, { year: 1929, totalReturn: 0.042 }, { year: 1930, totalReturn: 0.0454 },
    { year: 1931, totalReturn: -0.0256 }, { year: 1932, totalReturn: 0.0879 }, { year: 1933, totalReturn: 0.0186 },
    { year: 1934, totalReturn: 0.0796 }, { year: 1935, totalReturn: 0.0447 }, { year: 1936, totalReturn: 0.0502 },
    { year: 1937, totalReturn: 0.0138 }, { year: 1938, totalReturn: 0.0421 }, { year: 1939, totalReturn: 0.0441 },
    { year: 1940, totalReturn: 0.054 }, { year: 1941, totalReturn: -0.0202 }, { year: 1942, totalReturn: 0.0229 },
    { year: 1943, totalReturn: 0.0249 }, { year: 1944, totalReturn: 0.0258 }, { year: 1945, totalReturn: 0.038 },
    { year: 1946, totalReturn: 0.0313 }, { year: 1947, totalReturn: 0.0092 }, { year: 1948, totalReturn: 0.0195 },
    { year: 1949, totalReturn: 0.0466 }, { year: 1950, totalReturn: 0.0043 }, { year: 1951, totalReturn: -0.003 },
    { year: 1952, totalReturn: 0.0227 }, { year: 1953, totalReturn: 0.0414 }, { year: 1954, totalReturn: 0.0329 },
    { year: 1955, totalReturn: -0.0134 }, { year: 1956, totalReturn: -0.0226 }, { year: 1957, totalReturn: 0.068 },
    { year: 1958, totalReturn: -0.021 }, { year: 1959, totalReturn: -0.0265 }, { year: 1960, totalReturn: 0.1164 },
    { year: 1961, totalReturn: 0.0206 }, { year: 1962, totalReturn: 0.0569 }, { year: 1963, totalReturn: 0.0168 },
    { year: 1964, totalReturn: 0.0373 }, { year: 1965, totalReturn: 0.0072 }, { year: 1966, totalReturn: 0.0291 },
    { year: 1967, totalReturn: -0.0158 }, { year: 1968, totalReturn: 0.0327 }, { year: 1969, totalReturn: -0.0501 },
    { year: 1970, totalReturn: 0.1675 }, { year: 1971, totalReturn: 0.0979 }, { year: 1972, totalReturn: 0.0282 },
    { year: 1973, totalReturn: 0.0366 }, { year: 1974, totalReturn: 0.0199 }, { year: 1975, totalReturn: 0.0361 },
    { year: 1976, totalReturn: 0.1598 }, { year: 1977, totalReturn: 0.0129 }, { year: 1978, totalReturn: -0.0078 },
    { year: 1979, totalReturn: 0.0067 }, { year: 1980, totalReturn: -0.0299 }, { year: 1981, totalReturn: 0.082 },
    { year: 1982, totalReturn: 0.3281 }, { year: 1983, totalReturn: 0.032 }, { year: 1984, totalReturn: 0.1373 },
    { year: 1985, totalReturn: 0.2571 }, { year: 1986, totalReturn: 0.2428 }, { year: 1987, totalReturn: -0.0496 },
    { year: 1988, totalReturn: 0.0822 }, { year: 1989, totalReturn: 0.1769 }, { year: 1990, totalReturn: 0.0624 },
    { year: 1991, totalReturn: 0.15 }, { year: 1992, totalReturn: 0.0936 }, { year: 1993, totalReturn: 0.1421 },
    { year: 1994, totalReturn: -0.0804 }, { year: 1995, totalReturn: 0.2348 }, { year: 1996, totalReturn: 0.0143 },
    { year: 1997, totalReturn: 0.0994 }, { year: 1998, totalReturn: 0.1492 }, { year: 1999, totalReturn: -0.0825 },
    { year: 2000, totalReturn: 0.1666 }, { year: 2001, totalReturn: 0.0557 }, { year: 2002, totalReturn: 0.1512 },
    { year: 2003, totalReturn: 0.0038 }, { year: 2004, totalReturn: 0.0449 }, { year: 2005, totalReturn: 0.0287 },
    { year: 2006, totalReturn: 0.0196 }, { year: 2007, totalReturn: 0.1021 }, { year: 2008, totalReturn: 0.201 },
    { year: 2009, totalReturn: -0.1112 }, { year: 2010, totalReturn: 0.0846 }, { year: 2011, totalReturn: 0.1604 },
    { year: 2012, totalReturn: 0.0297 }, { year: 2013, totalReturn: -0.091 }, { year: 2014, totalReturn: 0.1075 },
    { year: 2015, totalReturn: 0.0128 }, { year: 2016, totalReturn: 0.0069 }, { year: 2017, totalReturn: 0.028 },
    { year: 2018, totalReturn: -0.0002 }, { year: 2019, totalReturn: 0.0964 }, { year: 2020, totalReturn: 0.1133 },
    { year: 2021, totalReturn: -0.0442 }, { year: 2022, totalReturn: -0.1783 }, { year: 2023, totalReturn: 0.0388 },
    { year: 2024, totalReturn: -0.0164 }, { year: 2025, totalReturn: 0.078 },
  ],
  source: "NYU Stern (Aswath Damodaran) — Returns on Stocks, Bonds and Bills, 1928-2025, 10-year US Treasury Bond total return",
  url: "https://pages.stern.nyu.edu/~adamodar/New_Home_Page/datafile/histretSP.html",
  asOf: "2025-12-31",
};

export const historicalReturnsByAssetClass: Record<string, HistoricalReturnsDataset> = {
  "us-equity-large-cap": sp500TotalReturns1928to2025,
  "us-treasury-bond-10y": treasuryBond10yTotalReturns1928to2025,
};
